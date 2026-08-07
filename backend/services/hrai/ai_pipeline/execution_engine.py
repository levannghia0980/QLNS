from __future__ import annotations

import logging
import re
import time
from typing import Any

from sqlalchemy import text
from database_utils import db_execute
from services.hrai.config import get_settings

logger = logging.getLogger(__name__)

_DANGEROUS_PATTERNS = [
    re.compile(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b", re.IGNORECASE),
    re.compile(r"\b(EXEC|EXECUTE|CALL)\b", re.IGNORECASE),
    re.compile(r";\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)", re.IGNORECASE),
    re.compile(r"--", re.IGNORECASE),
]


def validate_sql(sql: str) -> str | None:
    if not sql or not sql.strip():
        return "SQL trống"
    
    cleaned = sql.strip()
    
    if not re.match(r"^\s*(SELECT|WITH)\b", cleaned, re.IGNORECASE):
        return "Chỉ cho phép câu lệnh SELECT. Phát hiện lệnh không hợp lệ."
    
    for pattern in _DANGEROUS_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            dangerous_word = match.group(0)
            return f"Phát hiện lệnh nguy hiểm: {dangerous_word}. Chỉ cho phép SELECT."
    
    return None


async def execute_query(
    sql: str,
    params: dict[str, Any],
    db: Any,
) -> list[dict[str, Any]]:
    settings = get_settings()
    start = time.time()

    try:
        is_sqlite = "sqlite" in str(db.bind.url) if hasattr(db, "bind") and db.bind else True
        if not is_sqlite:
            timeout_ms = settings.QUERY_TIMEOUT_SECONDS * 1000
            await db_execute(db, text(f"SET statement_timeout = {timeout_ms}"))

        result = await db_execute(db, text(sql), params)
        rows = result.fetchall()
        columns = list(result.keys()) if hasattr(result, "keys") and result.keys() else []

        data = []
        for row in rows:
            row_dict = {}
            if hasattr(row, "_mapping"):
                row_dict = dict(row._mapping)
            else:
                for i, col in enumerate(columns):
                    val = row[i]
                    if hasattr(val, "isoformat"):
                        val = val.isoformat()
                    elif hasattr(val, "__float__"):
                        val = float(val)
                    row_dict[col] = val
            data.append(row_dict)

        elapsed = round(time.time() - start, 3)
        logger.info(
            "SQL executed | rows=%d | time=%.3fs | sql=%s",
            len(data), elapsed, sql[:150],
        )

        return data

    except Exception as e:
        elapsed = round(time.time() - start, 3)
        logger.error(
            "SQL execution failed after %.3fs: %s | sql=%s",
            elapsed, str(e), sql[:150],
        )
        raise
