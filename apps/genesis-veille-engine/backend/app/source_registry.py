from __future__ import annotations

from collections.abc import Iterable

from .models import SourceRecord


class SourceRegistry:
    def __init__(self, sources: Iterable[SourceRecord] | None = None) -> None:
        self._sources: dict[str, SourceRecord] = {}
        for source in sources or []:
            self.register(source)

    def register(self, source: SourceRecord) -> SourceRecord:
        existing = self._sources.get(source.id)
        if existing is not None:
            if existing == source:
                return existing
            raise ValueError("source id conflict")

        self._sources[source.id] = source
        return source

    def get(self, source_id: str) -> SourceRecord | None:
        return self._sources.get(source_id)

    def list(self) -> list[SourceRecord]:
        return list(self._sources.values())
