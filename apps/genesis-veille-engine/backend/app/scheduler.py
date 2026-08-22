from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable, Protocol

from .connectors import ConnectorObservation
from .models import CrawlTarget
from .persistence import SQLiteStateRepository
from .source_registry import SourceRegistry


class ConnectorProtocol(Protocol):
    def fetch(
        self,
        *,
        source,
        url: str,
        country_iso3: str,
        event_type_hint: str,
        sector: str | None = None,
        sensitive: bool = False,
    ) -> ConnectorObservation: ...


class PipelineProtocol(Protocol):
    def process(self, observation: ConnectorObservation): ...


@dataclass(frozen=True)
class CrawlRunResult:
    attempted: int = 0
    succeeded: int = 0
    unchanged: int = 0
    failed: int = 0


class CrawlScheduler:
    """Deterministic scheduler tick; no background loop or implicit network activation."""

    def __init__(
        self,
        *,
        repository: SQLiteStateRepository,
        registry: SourceRegistry,
        connector: ConnectorProtocol,
        pipeline_factory: Callable[[], PipelineProtocol],
        max_backoff_seconds: int = 86400,
    ) -> None:
        self._repository = repository
        self._registry = registry
        self._connector = connector
        self._pipeline_factory = pipeline_factory
        self._max_backoff_seconds = max_backoff_seconds

    def tick(self, now: datetime) -> CrawlRunResult:
        attempted = succeeded = unchanged = failed = 0
        pipeline = self._pipeline_factory()

        for target in self._repository.list_due_crawl_targets(now):
            attempted += 1
            try:
                source = self._registry.get(target.source_id)
                if source is None or not source.active:
                    raise ValueError("unknown or inactive source")

                observation = self._connector.fetch(
                    source=source,
                    url=target.url,
                    country_iso3=target.country_iso3,
                    event_type_hint=target.event_type_hint,
                    sector=target.sector,
                    sensitive=target.sensitive,
                )
                content_digest = self._content_digest(observation)

                if target.last_content_sha256 == content_digest:
                    unchanged += 1
                    self._repository.save_crawl_target(
                        target.model_copy(
                            update={
                                "last_attempt_at": now,
                                "last_success_at": now,
                                "failure_count": 0,
                                "last_error": None,
                                "next_due_at": now + timedelta(seconds=target.interval_seconds),
                            }
                        )
                    )
                    continue

                pipeline.process(observation)
                succeeded += 1
                self._repository.save_crawl_target(
                    target.model_copy(
                        update={
                            "last_attempt_at": now,
                            "last_success_at": now,
                            "failure_count": 0,
                            "last_content_sha256": content_digest,
                            "last_error": None,
                            "next_due_at": now + timedelta(seconds=target.interval_seconds),
                        }
                    )
                )
            except Exception as exc:
                failed += 1
                failures = min(target.failure_count + 1, 1000)
                multiplier = 2 ** min(failures, 8)
                backoff = min(target.interval_seconds * multiplier, self._max_backoff_seconds)
                self._repository.save_crawl_target(
                    target.model_copy(
                        update={
                            "last_attempt_at": now,
                            "failure_count": failures,
                            "last_error": str(exc)[:512],
                            "next_due_at": now + timedelta(seconds=backoff),
                        }
                    )
                )

        return CrawlRunResult(
            attempted=attempted,
            succeeded=succeeded,
            unchanged=unchanged,
            failed=failed,
        )

    @staticmethod
    def _content_digest(observation: ConnectorObservation) -> str:
        payload = "\n".join(
            [
                observation.source_id,
                observation.url,
                observation.title,
                observation.content_text,
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
