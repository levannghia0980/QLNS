import re
import logging
from typing import Dict, Any, List, Tuple
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.hrai.query_planner_engine.query_planner import DynamicQuerySpec

logger = logging.getLogger(__name__)


def sanitize_column_name(col_name: str) -> str:
    clean = col_name.strip('"').strip("'")
    return clean


def validate_sql_security(sql: str) -> str | None:
    clean = sql.strip().upper()
    if not clean.startswith("SELECT") and not clean.startswith("WITH"):
        return "Chỉ cho phép câu lệnh truy vấn SELECT."
    
    forbidden = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE", "EXEC", "CREATE"]
    for kw in forbidden:
        if re.search(r'\b' + kw + r'\b', clean):
            return f"Cảnh báo bảo mật: Không được sử dụng từ khóa '{kw}'."
    return None
