"""Resilient HTTP client with polite per-host rate limiting, retries, and jitter."""

from __future__ import annotations

import random
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
TRANSIENT_HTTP_CODES = {429, 500, 502, 503, 504}


class HttpError(RuntimeError):
    """Structured HTTP failure preserving status code for callers."""

    def __init__(self, url: str, status: int | None, message: str) -> None:
        super().__init__(message)
        self.url = url
        self.status = status


class PoliteHttpClient:
    """Thread-safe urllib HTTP fetcher enforcing polite delays and transient retries."""

    def __init__(
        self,
        min_delay: float = 1.5,
        max_retries: int = 3,
        timeout: float = 25.0,
        user_agent: str = DEFAULT_UA,
    ) -> None:
        self.min_delay = max(0.0, float(min_delay))
        self.max_retries = max(1, int(max_retries))
        self.timeout = float(timeout)
        self.user_agent = user_agent
        self._lock = threading.Lock()
        self._last_request_by_host: dict[str, float] = {}

    def _wait_polite(self, host: str, extra_delay: float = 0.0) -> None:
        with self._lock:
            now = time.monotonic()
            last = self._last_request_by_host.get(host, 0.0)
            target_gap = self.min_delay + extra_delay
            elapsed = now - last
            if last > 0 and elapsed < target_gap:
                time.sleep(target_gap - elapsed)
            self._last_request_by_host[host] = time.monotonic()

    def get(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        skip_delay: bool = False,
    ) -> str:
        """Fetch UTF-8 text from URL, retrying transient network/server errors."""
        host = urllib.parse.urlparse(url).netloc.lower()
        req_headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
        }
        if headers:
            req_headers.update(headers)

        last_err: Exception | None = None
        for attempt in range(self.max_retries):
            if not skip_delay:
                jitter = random.uniform(0.05, 0.25) if self.min_delay > 0 else 0.0
                self._wait_polite(host, jitter)

            req = urllib.request.Request(url, headers=req_headers)
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    raw = resp.read()
                    charset = resp.headers.get_content_charset() or "utf-8"
                    return raw.decode(charset, errors="replace")
            except urllib.error.HTTPError as exc:
                last_err = HttpError(url, exc.code, f"HTTP {exc.code} for {url}")
                if exc.code not in TRANSIENT_HTTP_CODES or attempt == self.max_retries - 1:
                    raise last_err from exc
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                sleep_s = (
                    min(float(retry_after), 15.0)
                    if retry_after and retry_after.isdigit()
                    else (1.5 ** (attempt + 1)) + random.uniform(0.2, 0.8)
                )
                time.sleep(sleep_s)
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
                last_err = HttpError(url, None, f"Network error for {url}: {exc}")
                if attempt == self.max_retries - 1:
                    raise last_err from exc
                time.sleep((1.5 ** (attempt + 1)) + random.uniform(0.2, 0.8))

        raise last_err or HttpError(url, None, f"Failed to fetch {url}")

