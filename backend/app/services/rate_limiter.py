import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from app.config import settings


class RateLimiter:
    """
    In-memory sliding-window rate limiter, keyed per client identity. Caps
    requests per minute so a misbehaving client — or a bug like an unbounded
    retry loop re-sending full context — can't hammer the embedding/LLM APIs
    into a runaway bill before anyone notices.
    """

    def __init__(self):
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, identity: str) -> bool:
        limit = settings.rate_limit_per_minute
        if limit <= 0:
            return True

        now = time.time()
        window_start = now - 60
        with self._lock:
            q = self._hits[identity]
            while q and q[0] < window_start:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


rate_limiter = RateLimiter()
