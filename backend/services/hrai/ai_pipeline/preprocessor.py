from __future__ import annotations

import re
import logging
import unicodedata
from datetime import datetime, timedelta
from typing import Any

from schemas import PreprocessedInput

logger = logging.getLogger(__name__)


def preprocess(question: str, session_id: str | None = None) -> PreprocessedInput:
    original = question.strip()
    text = _normalize_text(original)

    resolved_time = _resolve_time_expressions(text)
    resolved_numbers = _resolve_number_expressions(text)

    text = _resolve_basic_synonyms(text)

    return PreprocessedInput(
        original=original,
        normalized_text=text,
        resolved_time=resolved_time,
        resolved_numbers=resolved_numbers,
        resolved_entities=None,
    )


def _normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = text.lower()
    return text


def _resolve_time_expressions(text: str) -> dict[str, str] | None:
    now = datetime.now()
    today = now.date()

    if "hôm nay" in text or "today" in text:
        return {"start": str(today), "end": str(today)}

    if "hôm qua" in text or "yesterday" in text:
        yesterday = today - timedelta(days=1)
        return {"start": str(yesterday), "end": str(yesterday)}

    if "ngày mai" in text or "mai" in text or "tomorrow" in text:
        tomorrow = today + timedelta(days=1)
        return {"start": str(tomorrow), "end": str(tomorrow)}

    if "tuần này" in text or "this week" in text:
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        return {"start": str(start), "end": str(end)}

    if "tuần trước" in text or "last week" in text:
        start = today - timedelta(days=today.weekday() + 7)
        end = start + timedelta(days=6)
        return {"start": str(start), "end": str(end)}

    month_match = re.search(r"tháng\s*(\d{1,2})", text)
    if month_match:
        month_num = int(month_match.group(1))
        if 1 <= month_num <= 12:
            year = now.year
            start = datetime(year, month_num, 1).date()
            if month_num == 12:
                end = datetime(year + 1, 1, 1).date() - timedelta(days=1)
            else:
                end = datetime(year, month_num + 1, 1).date() - timedelta(days=1)
            return {"start": str(start), "end": str(end)}

    if "tháng này" in text or "this month" in text:
        start = today.replace(day=1)
        if today.month == 12:
            end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
        return {"start": str(start), "end": str(end)}

    if "tháng trước" in text or "last month" in text:
        first_this_month = today.replace(day=1)
        end = first_this_month - timedelta(days=1)
        start = end.replace(day=1)
        return {"start": str(start), "end": str(end)}

    quarter_match = re.search(r"q(\d)", text) or re.search(r"quý\s*(\d)", text)
    if quarter_match:
        q = int(quarter_match.group(1))
        if 1 <= q <= 4:
            year = now.year
            start_month = (q - 1) * 3 + 1
            end_month = start_month + 2
            start = datetime(year, start_month, 1).date()
            if end_month == 12:
                end = datetime(year + 1, 1, 1).date() - timedelta(days=1)
            else:
                end = datetime(year, end_month + 1, 1).date() - timedelta(days=1)
            return {"start": str(start), "end": str(end)}

    year_match = re.search(r"năm\s*(20\d{2})", text)
    if year_match:
        year = int(year_match.group(1))
        return {"start": f"{year}-01-01", "end": f"{year}-12-31"}

    if "năm nay" in text or "this year" in text:
        return {"start": f"{now.year}-01-01", "end": f"{now.year}-12-31"}

    return None


_VIET_NUMBERS = {
    "một": 1, "hai": 2, "ba": 3, "bốn": 4, "năm": 5,
    "sáu": 6, "bảy": 7, "tám": 8, "chín": 9, "mười": 10,
    "mười một": 11, "mười hai": 12,
}

_MULTIPLIERS = {
    "trăm": 100, "nghìn": 1000, "ngàn": 1000,
    "triệu": 1_000_000, "tỷ": 1_000_000_000,
    "k": 1000, "m": 1_000_000,
}


def _resolve_number_expressions(text: str) -> dict[str, float] | None:
    results = {}
    short_match = re.findall(r"(\d+(?:\.\d+)?)\s*(k|m|tr|triệu|nghìn|ngàn|trăm|tỷ)", text)
    for num_str, unit in short_match:
        num = float(num_str)
        unit_lower = unit.lower()
        if unit_lower == "tr":
            unit_lower = "triệu"
        multiplier = _MULTIPLIERS.get(unit_lower, 1)
        results[f"{num_str}{unit}"] = num * multiplier

    for word, value in _VIET_NUMBERS.items():
        if word in text:
            results[word] = value

    return results if results else None


_QUICK_SYNONYMS = {
    "đủ kpi": "đủ giờ",
    "đủ công": "đủ giờ",
    "hoàn thành kpi": "đủ giờ",
    "day off": "nghỉ phép",
    "off": "nghỉ phép",
    "ot": "tăng ca",
    "overtime": "tăng ca",
    "late": "đi muộn",
    "đi trễ": "đi muộn",
    "salary": "lương",
    "thu nhập": "lương",
    "bonus": "thưởng",
    "intern": "thực tập",
    "tts": "thực tập",
}


def _resolve_basic_synonyms(text: str) -> str:
    for synonym, canonical in _QUICK_SYNONYMS.items():
        if synonym in text:
            text = text.replace(synonym, canonical)
    return text
