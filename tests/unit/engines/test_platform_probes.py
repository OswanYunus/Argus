"""Unit tests for PlatformProbeEngine."""

import httpx
import pytest
from pytest_httpx import HTTPXMock

from argus.engines.platform_probes import (
    PLATFORM_CATALOGUE,
    PlatformProbeDefinition,
    PlatformProbeEngine,
)


def test_username_permutations():
    permutations = PlatformProbeEngine.generate_username_permutations(["oswan_yunus"])
    assert "oswan_yunus" in permutations
    assert "oswanyunus" in permutations
    assert "oswan-yunus" in permutations
    assert "oswan.yunus" in permutations


def test_username_permutations_clean():
    permutations = PlatformProbeEngine.generate_username_permutations(["  JohnDoe  ", ""])
    assert "johndoe" in permutations
    assert "" not in permutations


@pytest.mark.asyncio
async def test_probe_github_api_success(httpx_mock: HTTPXMock):
    github_def = next(p for p in PLATFORM_CATALOGUE if p.name == "GitHub")
    httpx_mock.add_response(
        url="https://api.github.com/users/octocat",
        status_code=200,
        json={
            "name": "The Octocat",
            "bio": "GitHub mascot",
            "public_repos": 8,
            "email": "octocat@github.com",
            "location": "San Francisco",
            "blog": "https://github.blog",
        },
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        finding = await engine.probe_single_platform(client, github_def, "octocat")

    assert finding is not None
    assert finding.platform_name == "GitHub"
    assert finding.username == "octocat"
    assert finding.extracted_metadata["public_repos"] == 8
    assert finding.confidence >= 0.95


@pytest.mark.asyncio
async def test_probe_github_api_not_found(httpx_mock: HTTPXMock):
    github_def = next(p for p in PLATFORM_CATALOGUE if p.name == "GitHub")
    httpx_mock.add_response(
        url="https://api.github.com/users/nonexistent_user_99999",
        status_code=404,
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        finding = await engine.probe_single_platform(client, github_def, "nonexistent_user_99999")

    assert finding is None


@pytest.mark.asyncio
async def test_probe_chess_api(httpx_mock: HTTPXMock):
    chess_def = next(p for p in PLATFORM_CATALOGUE if p.name == "Chess.com")
    httpx_mock.add_response(
        url="https://api.chess.com/pub/player/magnuscarlsen",
        status_code=200,
        json={"player_id": 12345, "name": "Magnus Carlsen", "status": "premium"},
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        finding = await engine.probe_single_platform(client, chess_def, "magnuscarlsen")

    assert finding is not None
    assert finding.platform_name == "Chess.com"
    assert finding.extracted_metadata["player_id"] == 12345


@pytest.mark.asyncio
async def test_probe_telegram_profile(httpx_mock: HTTPXMock):
    tg_def = next(p for p in PLATFORM_CATALOGUE if p.name == "Telegram")
    httpx_mock.add_response(
        url="https://t.me/durov",
        status_code=200,
        text='<html><body><div class="tgme_page_extra">@durov</div></body></html>',
    )
    httpx_mock.add_response(
        url="https://t.me/fakeuser9999",
        status_code=200,
        text='<html><body><div class="tgme_page_title">Contact @fakeuser9999</div></body></html>',
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        found = await engine.probe_single_platform(client, tg_def, "durov")
        missing = await engine.probe_single_platform(client, tg_def, "fakeuser9999")

    assert found is not None
    assert found.platform_name == "Telegram"
    assert missing is None


@pytest.mark.asyncio
async def test_probe_codeforces_api(httpx_mock: HTTPXMock):
    cf_def = next(p for p in PLATFORM_CATALOGUE if p.name == "Codeforces")
    httpx_mock.add_response(
        url="https://codeforces.com/api/user.info?handles=tourist",
        status_code=200,
        json={"status": "OK", "result": [{"handle": "tourist", "rating": 3800, "rank": "legendary grandmaster"}]},
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        finding = await engine.probe_single_platform(client, cf_def, "tourist")

    assert finding is not None
    assert finding.extracted_metadata["rank"] == "legendary grandmaster"


@pytest.mark.asyncio
async def test_probe_gravatar(httpx_mock: HTTPXMock):
    engine = PlatformProbeEngine()
    import hashlib
    h = hashlib.md5(b"test@example.com").hexdigest()
    httpx_mock.add_response(
        url=f"https://en.gravatar.com/{h}.json",
        status_code=200,
        json={"entry": [{"displayName": "Test User", "profileUrl": "https://gravatar.com/test"}]},
    )

    async with httpx.AsyncClient() as client:
        finding = await engine.probe_gravatar("test@example.com", client)

    assert finding is not None
    assert finding.platform_name == "Gravatar"
    assert finding.extracted_metadata["displayName"] == "Test User"


@pytest.mark.asyncio
async def test_probe_snapchat(httpx_mock: HTTPXMock):
    snap_def = next(p for p in PLATFORM_CATALOGUE if p.name == "Snapchat")
    httpx_mock.add_response(
        url="https://www.snapchat.com/add/teamsnapchat",
        status_code=200,
    )
    httpx_mock.add_response(
        url="https://www.snapchat.com/add/nonexistent_snap99",
        status_code=404,
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        found = await engine.probe_single_platform(client, snap_def, "teamsnapchat")
        missing = await engine.probe_single_platform(client, snap_def, "nonexistent_snap99")

    assert found is not None
    assert found.platform_name == "Snapchat"
    assert missing is None


@pytest.mark.asyncio
async def test_probe_pinterest(httpx_mock: HTTPXMock):
    pin_def = next(p for p in PLATFORM_CATALOGUE if p.name == "Pinterest")
    httpx_mock.add_response(
        url="https://www.pinterest.com/artlover/",
        status_code=200,
        text="<html><head><title>Art Lover (artlover) - Profile | Pinterest</title></head></html>",
    )
    httpx_mock.add_response(
        url="https://www.pinterest.com/fakeuser999/",
        status_code=200,
        text="<html><head><title>User not found</title></head></html>",
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        found = await engine.probe_single_platform(client, pin_def, "artlover")
        missing = await engine.probe_single_platform(client, pin_def, "fakeuser999")

    assert found is not None
    assert found.platform_name == "Pinterest"
    assert missing is None


@pytest.mark.asyncio
async def test_probe_duolingo(httpx_mock: HTTPXMock):
    duo_def = next(p for p in PLATFORM_CATALOGUE if p.name == "Duolingo")
    httpx_mock.add_response(
        url="https://www.duolingo.com/2017-06-30/users?username=polyglot",
        status_code=200,
        json={"users": [{"name": "Polyglot", "streak": 450, "bio": "Learning languages"}]},
    )
    httpx_mock.add_response(
        url="https://www.duolingo.com/2017-06-30/users?username=nobody99",
        status_code=200,
        json={"users": []},
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        found = await engine.probe_single_platform(client, duo_def, "polyglot")
        missing = await engine.probe_single_platform(client, duo_def, "nobody99")

    assert found is not None
    assert found.platform_name == "Duolingo"
    assert found.extracted_metadata["streak"] == 450
    assert missing is None


@pytest.mark.asyncio
async def test_probe_bluesky(httpx_mock: HTTPXMock):
    bsky_def = next(p for p in PLATFORM_CATALOGUE if p.name == "Bluesky")
    httpx_mock.add_response(
        url="https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=alice.bsky.social",
        status_code=200,
        json={"did": "did:plc:123456", "displayName": "Alice", "description": "Hello Bluesky"},
    )
    httpx_mock.add_response(
        url="https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fake.bsky.social",
        status_code=400,
        json={"error": "AccountNotFound"},
    )

    engine = PlatformProbeEngine()
    async with httpx.AsyncClient() as client:
        found = await engine.probe_single_platform(client, bsky_def, "alice")
        missing = await engine.probe_single_platform(client, bsky_def, "fake")

    assert found is not None
    assert found.platform_name == "Bluesky"
    assert found.extracted_metadata["did"] == "did:plc:123456"
    assert missing is None

