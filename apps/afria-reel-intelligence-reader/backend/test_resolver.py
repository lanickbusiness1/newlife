import pytest

import resolver


def test_parse_x_status_url():
    assert resolver.parse_x_status_url(
        "https://x.com/Blessinghls/status/2101019521947451594"
    ) == ("Blessinghls", "2101019521947451594")


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/Blessinghls/status/2101019521947451594",
        "https://x.com/not-a-status",
        "https://x.com/Blessinghls/status/not-a-number",
    ],
)
def test_parse_x_status_url_rejects_noncanonical_inputs(url):
    with pytest.raises(resolver.XSourceError):
        resolver.parse_x_status_url(url)


def test_strategy_urls_are_whitelisted_and_deterministic():
    urls = resolver.build_strategy_urls(
        "https://x.com/Blessinghls/status/2101019521947451594"
    )
    assert [name for name, _ in urls] == [
        "fxtwitter",
        "vxtwitter",
        "x_syndication",
        "x_oembed",
    ]
    for _, url in urls:
        host = resolver.urlparse(url).hostname
        assert host in resolver._ALLOWED_API_HOSTS


def test_extract_media_urls_only_allows_twitter_media_hosts():
    payload = {
        "tweet": {
            "media": {
                "videos": [
                    {
                        "url": "https://video.twimg.com/ext_tw_video/abc/pu/vid/720x1280/demo.mp4"
                    }
                ],
                "photo": {
                    "url": "https://pbs.twimg.com/media/demo.jpg"
                },
            },
            "evil": "https://attacker.example/video.mp4",
        }
    }
    assert resolver.extract_media_urls(payload) == [
        "https://video.twimg.com/ext_tw_video/abc/pu/vid/720x1280/demo.mp4",
        "https://pbs.twimg.com/media/demo.jpg",
    ]


@pytest.mark.asyncio
async def test_resolve_x_media_falls_through_until_media(monkeypatch):
    responses = {
        "api.fxtwitter.com": (403, None, None),
        "api.vxtwitter.com": (
            200,
            {
                "media": {
                    "videos": [
                        {
                            "url": "https://video.twimg.com/ext_tw_video/abc/pu/vid/720x1280/demo.mp4"
                        }
                    ]
                }
            },
            None,
        ),
        "cdn.syndication.twimg.com": (200, {"text": "metadata"}, None),
        "publish.twitter.com": (200, {"html": "<blockquote>Organ foods</blockquote>"}, None),
    }

    async def fake_fetch(client, url):
        return responses[resolver.urlparse(url).hostname]

    monkeypatch.setattr(resolver, "_fetch_json", fake_fetch)
    result = await resolver.resolve_x_media(
        "https://x.com/Blessinghls/status/2101019521947451594"
    )
    assert result["media_state"] == "MEDIA_RESOLVED"
    assert result["resolved_by"] == "vxtwitter"
    assert result["claim_state"] == "CLAIMS_NOT_EXTRACTED"
    assert result["inference_from_caption_allowed"] is False
    assert result["media_candidates"] == [
        "https://video.twimg.com/ext_tw_video/abc/pu/vid/720x1280/demo.mp4"
    ]


@pytest.mark.asyncio
async def test_resolve_x_media_keeps_unresolved_state_when_all_fail(monkeypatch):
    async def fake_fetch(client, url):
        return 403, None, None

    monkeypatch.setattr(resolver, "_fetch_json", fake_fetch)
    result = await resolver.resolve_x_media(
        "https://x.com/Blessinghls/status/2101019521947451594"
    )
    assert result["media_state"] == "MEDIA_NOT_RESOLVED"
    assert result["media_candidates"] == []
    assert len(result["attempts"]) == 4
