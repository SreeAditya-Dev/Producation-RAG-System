import logging
from datetime import datetime

from sqlalchemy import func

from app.config import settings

logger = logging.getLogger(__name__)


def check_daily_budget(db_session) -> bool:
    """
    Returns True if today's cumulative token usage (prompt + completion, across
    all queries) is still under the configured daily budget. A hard backstop
    against cost blowups from bugs like an unbounded retry loop that resends
    full context — checked BEFORE invoking the LLM, not just monitored after
    the fact in a dashboard.
    """
    from app.database import QueryMetrics

    if settings.daily_token_budget <= 0:
        return True

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    prompt_sum, completion_sum = (
        db_session.query(
            func.coalesce(func.sum(QueryMetrics.prompt_tokens), 0),
            func.coalesce(func.sum(QueryMetrics.completion_tokens), 0),
        )
        .filter(QueryMetrics.created_at >= today_start)
        .first()
    )
    total = int(prompt_sum or 0) + int(completion_sum or 0)

    if total >= settings.daily_token_budget:
        logger.warning("Daily token budget exceeded: %d/%d tokens used today", total, settings.daily_token_budget)
        return False
    return True
