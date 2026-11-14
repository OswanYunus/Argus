"""Platform Probe Engine for ARGUS OSINT Intelligence Platform.

Conducts high-speed, deterministic platform enumeration across identity,
developer, social, and messaging hubs. Uses verified API endpoints and robust
pattern matching to eliminate false positives.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

logger = logging.getLogger("argus.engine.platform_probes")

DEFAULT_PROBE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
}


@dataclass
class PlatformProbeDefinition:
    """Specification for probing an identity platform."""

    name: str
    category: str
    url_template: str
    api_url_template: Optional[str] = None
    check_type: str = "status"  # status, hn_json, gitlab_json, keybase_json, github_api
    expected_status: int = 200


@dataclass
class ProbeFinding:
    """Validated profile or identity asset found during deterministic enumeration."""

    platform_name: str
    category: str
    profile_url: str
    username: str
    status_code: int
    raw_evidence: str
    extracted_metadata: dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.90


# Robust curated catalogue with zero false-positive tolerance
PLATFORM_CATALOGUE: list[PlatformProbeDefinition] = [
    PlatformProbeDefinition(
        name="GitHub",
        category="code",
        url_template="https://github.com/{username}",
        api_url_template="https://api.github.com/users/{username}",
        check_type="github_api",
    ),
    PlatformProbeDefinition(
        name="GitLab",
        category="code",
        url_template="https://gitlab.com/{username}",
        api_url_template="https://gitlab.com/api/v4/users?username={username}",
        check_type="gitlab_json",
    ),
    PlatformProbeDefinition(
        name="HackerNews",
        category="tech",
        url_template="https://news.ycombinator.com/user?id={username}",
        api_url_template="https://hacker-news.firebaseio.com/v0/user/{username}.json",
        check_type="hn_json",
    ),
    PlatformProbeDefinition(
        name="DockerHub",
        category="code",
        url_template="https://hub.docker.com/u/{username}",
        api_url_template="https://hub.docker.com/v2/users/{username}/",
        check_type="status",
        expected_status=200,
    ),
    PlatformProbeDefinition(
        name="Dev.to",
        category="tech",
        url_template="https://dev.to/{username}",
        api_url_template="https://dev.to/api/users/by_username?url={username}",
        check_type="status",
        expected_status=200,
    ),
    PlatformProbeDefinition(
        name="Keybase",
        category="crypto_identity",
        url_template="https://keybase.io/{username}",
        api_url_template="https://keybase.io/_/api/1.0/user/lookup.json?usernames={username}",
        check_type="keybase_json",
    ),
    PlatformProbeDefinition(
        name="Reddit",
        category="social",
        url_template="https://www.reddit.com/user/{username}",
        api_url_template="https://www.reddit.com/user/{username}/about.json",
        check_type="status",
        expected_status=200,
    ),
    PlatformProbeDefinition(
        name="Chess.com",
        category="gaming",
        url_template="https://www.chess.com/member/{username}",
        api_url_template="https://api.chess.com/pub/player/{username}",
        check_type="chess_api",
    ),
    PlatformProbeDefinition(
        name="Telegram",
        category="messaging",
        url_template="https://t.me/{username}",
        check_type="telegram_html",
    ),
    PlatformProbeDefinition(
        name="Codeforces",
        category="code",
        url_template="https://codeforces.com/profile/{username}",
        api_url_template="https://codeforces.com/api/user.info?handles={username}",
        check_type="codeforces_api",
    ),
    PlatformProbeDefinition(
        name="Scratch MIT",
        category="community",
        url_template="https://scratch.mit.edu/users/{username}/",
        check_type="status",
        expected_status=200,
    ),
    PlatformProbeDefinition(
        name="SourceForge",
        category="code",
        url_template="https://sourceforge.net/u/{username}/profile/",
        check_type="status",
        expected_status=200,
    ),
]


class PlatformProbeEngine:
    """Automated direct platform enumeration engine with anti-false-positive validation."""

    def __init__(
        self,
        concurrency: int = 10,
        timeout: float = 6.0,
    ) -> None:
        self.concurrency = concurrency
        self.timeout = timeout

    @staticmethod
    def generate_username_permutations(base_usernames: list[str]) -> list[str]:
        """Generate high-probability OSINT username permutations (e.g. oswan_yunus -> oswanyunus, oswan-yunus)."""
        permutations = set()
        for u in base_usernames:
            clean = u.strip().lower()
            if not clean:
                continue
            permutations.add(clean)
            no_delims = re.sub(r"[-_.]", "", clean)
            if no_delims:
                permutations.add(no_delims)
            if "_" in clean:
                permutations.add(clean.replace("_", "-"))
                permutations.add(clean.replace("_", "."))
            if "-" in clean:
                permutations.add(clean.replace("-", "_"))
                permutations.add(clean.replace("-", "."))
        return list(permutations)

    async def probe_single_platform(
        self,
        client: httpx.AsyncClient,
        platform: PlatformProbeDefinition,
        username: str,
    ) -> Optional[ProbeFinding]:
        """Execute a probe against a single target platform with strict validation."""
        profile_url = platform.url_template.format(username=username)
        probe_target = (
            platform.api_url_template.format(username=username)
            if platform.api_url_template
            else profile_url
        )

        try:
            resp = await client.get(
                probe_target,
                timeout=self.timeout,
                headers=DEFAULT_PROBE_HEADERS,
            )

            # 1. GitHub API Check
            if platform.check_type == "github_api":
                if resp.status_code == 200:
                    data = resp.json()
                    meta = {
                        "name": data.get("name"),
                        "email": data.get("email"),
                        "bio": data.get("bio"),
                        "public_repos": data.get("public_repos"),
                        "location": data.get("location"),
                        "blog": data.get("blog"),
                    }
                    return ProbeFinding(
                        platform_name=platform.name,
                        category=platform.category,
                        profile_url=profile_url,
                        username=username,
                        status_code=resp.status_code,
                        raw_evidence=f"GitHub Profile found. Bio: {data.get('bio')} | Name: {data.get('name')}",
                        extracted_metadata=meta,
                        confidence=0.99,
                    )

            # 2. GitLab API Check
            elif platform.check_type == "gitlab_json":
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        user_obj = data[0]
                        return ProbeFinding(
                            platform_name=platform.name,
                            category=platform.category,
                            profile_url=profile_url,
                            username=username,
                            status_code=resp.status_code,
                            raw_evidence=str(user_obj)[:400],
                            extracted_metadata=user_obj,
                            confidence=0.95,
                        )

            # 3. HackerNews Check
            elif platform.check_type == "hn_json":
                if resp.status_code == 200:
                    data = resp.json()
                    # HN returns JSON null for nonexistent accounts
                    if isinstance(data, dict) and data.get("id"):
                        return ProbeFinding(
                            platform_name=platform.name,
                            category=platform.category,
                            profile_url=profile_url,
                            username=username,
                            status_code=resp.status_code,
                            raw_evidence=f"Hacker News account created {data.get('created')}. Karma: {data.get('karma')}",
                            extracted_metadata=data,
                            confidence=0.95,
                        )

            # 4. Keybase Check
            elif platform.check_type == "keybase_json":
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and data.get("them") and data["them"][0] is not None:
                        them = data["them"][0]
                        return ProbeFinding(
                            platform_name=platform.name,
                            category=platform.category,
                            profile_url=profile_url,
                            username=username,
                            status_code=resp.status_code,
                            raw_evidence=str(them)[:400],
                            extracted_metadata=them,
                            confidence=0.98,
                        )

            # 5. Chess.com API Check
            elif platform.check_type == "chess_api":
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and data.get("player_id"):
                        return ProbeFinding(
                            platform_name=platform.name,
                            category=platform.category,
                            profile_url=profile_url,
                            username=username,
                            status_code=resp.status_code,
                            raw_evidence=f"Chess.com Player ID: {data.get('player_id')}, Name: {data.get('name')}, Status: {data.get('status')}",
                            extracted_metadata=data,
                            confidence=0.96,
                        )

            # 6. Telegram Profile Check
            elif platform.check_type == "telegram_html":
                if resp.status_code == 200 and "tgme_page_extra" in resp.text:
                    return ProbeFinding(
                        platform_name=platform.name,
                        category=platform.category,
                        profile_url=profile_url,
                        username=username,
                        status_code=resp.status_code,
                        raw_evidence=f"Active Telegram profile/channel handle detected at {profile_url}",
                        confidence=0.94,
                    )

            # 7. Codeforces API Check
            elif platform.check_type == "codeforces_api":
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and data.get("status") == "OK" and data.get("result"):
                        user_info = data["result"][0]
                        return ProbeFinding(
                            platform_name=platform.name,
                            category=platform.category,
                            profile_url=profile_url,
                            username=username,
                            status_code=resp.status_code,
                            raw_evidence=f"Codeforces user: rank={user_info.get('rank')}, rating={user_info.get('rating')}",
                            extracted_metadata=user_info,
                            confidence=0.97,
                        )

            # 8. Direct Status Code Check (with 404 distinction)
            elif platform.check_type == "status":
                if resp.status_code == platform.expected_status:
                    return ProbeFinding(
                        platform_name=platform.name,
                        category=platform.category,
                        profile_url=profile_url,
                        username=username,
                        status_code=resp.status_code,
                        raw_evidence=resp.text[:400],
                        confidence=0.88,
                    )

        except Exception as exc:
            logger.debug("Probe error on %s (%s): %s", platform.name, username, exc)

        return None

    async def probe_gravatar(self, email: str, client: httpx.AsyncClient) -> Optional[ProbeFinding]:
        """Probe Gravatar global profile by email MD5 hash."""
        clean_email = email.strip().lower()
        if not clean_email:
            return None
        md5_hash = hashlib.md5(clean_email.encode()).hexdigest()
        url = f"https://en.gravatar.com/{md5_hash}.json"
        profile_page = f"https://gravatar.com/{md5_hash}"

        try:
            resp = await client.get(url, timeout=self.timeout, headers=DEFAULT_PROBE_HEADERS)
            if resp.status_code == 200:
                data = resp.json().get("entry", [{}])[0]
                return ProbeFinding(
                    platform_name="Gravatar",
                    category="identity_hash",
                    profile_url=profile_page,
                    username=data.get("preferredUsername", clean_email),
                    status_code=200,
                    raw_evidence=resp.text[:400],
                    extracted_metadata={
                        "displayName": data.get("displayName"),
                        "aboutMe": data.get("aboutMe"),
                        "currentLocation": data.get("currentLocation"),
                        "urls": data.get("urls", []),
                    },
                    confidence=0.98,
                )
        except Exception:
            pass
        return None

    async def run_probes(
        self,
        usernames: list[str],
        emails: Optional[list[str]] = None,
    ) -> list[ProbeFinding]:
        """Execute concurrent platform probes across all usernames, permutations, and emails."""
        all_usernames = self.generate_username_permutations(usernames)
        findings: list[ProbeFinding] = []
        sem = asyncio.Semaphore(self.concurrency)

        async with httpx.AsyncClient(follow_redirects=True, timeout=self.timeout) as client:
            tasks = []

            if emails:
                for em in emails:
                    tasks.append(self.probe_gravatar(em, client))

            for uname in all_usernames:
                for platform in PLATFORM_CATALOGUE:
                    async def _worker(p=platform, u=uname):
                        async with sem:
                            return await self.probe_single_platform(client, p, u)
                    tasks.append(_worker())

            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, ProbeFinding):
                    findings.append(r)

        return findings
