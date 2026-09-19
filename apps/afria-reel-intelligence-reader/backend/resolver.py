from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse

import httpx

_X_HOSTS = {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}
_ALLOWED_MEDIA_HOSTS = {
    "video.twimg.com",
    "pbs.twimg.com",
    "ton.twitter.com",
}
_ALLOWED_API_HOSTS = {
    "api.fxtwitter.com",
    "api.vxtwitter.com",
    "cdn.syndication.twimg.com",
    "publish.twitter.com",
}

_STATUS_RE = re.compile(r"^/(?P<handle>[A-Za-z0-9_]+)/status/(?P<tweet_id>\d+)(?:/.*)?$")


class XSourceError(ValueError):
    pass


def parse_x_status_url(source_url: str) -> tuple[str, str]:
    parsed = urlparse(source_url)
    host = (parsed.hostname or "").lower()
    if host not in _X_HOSTS:
        raise XSourceError("source_must_be_x_or_twitter")
    match = _STATUS_RE.match(parsed.path)
    if not match:
        raise XSourceError("invalid_x_status_url")
    return match.group("handle"), match.group("tweet_id")


def build_strategy_urls(source_url: str) -> list[tuple[str, str]]:
    handle, tweet_id = parse_x_status_url(source_url)
    canonical = f"https://x.com/{handle}/status/{tweet_id}"
    return [
        ("fxtwitter", f"https://api.fxtwitter.com/{handle}/status/{tweet_id}"),
        ("vxtwitter", f"https://api.vxtwitter.com/{handle}/status/{tweet_id}"),
        ("x_syndication", f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}&lang=en"),
        ("x_oembed", f"https://publish.twitter.com/oembed?url={canonical}"),
    ]


def _walk(value: Any):
    if isinstance(value, dict):
        for v in value.values():
            yield from _walk(v)
    elif isinstance(value, list):
        for v in value:
            yield from _walk(v)
    elif isinstance(value, str):
        yield value


def extract_media_urls(payload: Any) -> list[str]:
    urls: list[str] = []
    for value in _walk(payload):
        if not value.startswith(("http://", "https://")):
            continue
        try:
            host = (urlparse(value).hostname or "").lower()
        except ValueError:
            continue
        if host in _ALLOWED_MEDIA_HOSTS and value not in urls:
            urls.append(value)
    return urls


async def _fetch_json(client: httpx.AsyncClient, url: str) -> tuple[int, Any | None, str | None]:
    host = (urlparse(url).hostname or "").lower()
    if host not in _ALLOWED_API_HOSTS:
        raise XSourceError("resolver_host_not_allowed")
    try:
        response = await client.get(
            url,
            headers={
                "User-Agent": "AfrIAgenesis-Reel-Intelligence-Reader/0.2",
                "Accept": "application/json,text/html;q=0.8,*/*;q=0.5",
            },
        )
    except httpx.HTTPError as exc:
        return 0, None, exc.__class__.__name__

    body: Any | None = None
    content_type = response.headers.get("content-type", "")
    if "json" in content_type:
        try:
            body = response.json()
        except json.JSONDecodeError:
            body = None
    elif response.text:
        # oEmbed is normally JSON but some intermediaries return text/html.
        try:
            body = response.json()
        except Exception:
            body = {"html": response.text[:20000]}

    return response.status_code, body, None


async def resolve_x_media(source_url: str) -> dict[str, Any]:
    handle, tweet_id = parse_x_status_url(source_url)
    attempts: list[dict[str, Any]] = []
    candidates: list[str] = []
    resolved_by: str | None = None

    timeout = httpx.Timeout(connect=4.0, read=6.0, write=4.0, pool=4.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for strategy, url in build_strategy_urls(source_url):
            status, body, error = await _fetch_json(client, url)
            media = extract_media_urls(body) if body is not None else []
            attempts.append(
                {
                    "strategy": strategy,
                    "endpoint_host": urlparse(url).hostname,
                    "http_status": status,
                    "error": error,
                    "media_candidate_count": len(media),
                }
            )
            for item in media:
                if item not in candidates:
                    candidates.append(item)
            if media and resolved_by is None:
                resolved_by = strategy

    return {
        "source_platform": "X",
        "source_handle": handle,
        "tweet_id": tweet_id,
        "source_url": f"https://x.com/{handle}/status/{tweet_id}",
        "media_state": "MEDIA_RESOLVED" if candidates else "MEDIA_NOT_RESOLVED",
        "resolved_by": resolved_by,
        "media_candidates": candidates,
        "attempts": attempts,
        "claim_state": "CLAIMS_NOT_EXTRACTED",
        "inference_from_caption_allowed": False,
    }
