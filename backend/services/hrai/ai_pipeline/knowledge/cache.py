from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_cache: dict[str, Any] = {}


def set_cache(key: str, value: Any) -> None:
    _cache[key] = value
    logger.debug("Cache SET: %s", key)


def get_cache(key: str) -> Any | None:
    return _cache.get(key)


def has_cache(key: str) -> bool:
    return key in _cache


def clear_cache(key: str | None = None) -> None:
    if key is None:
        _cache.clear()
        logger.info("Cache CLEARED: all keys")
    elif key in _cache:
        del _cache[key]
        logger.info("Cache CLEARED: %s", key)


def get_cache_keys() -> list[str]:
    return list(_cache.keys())
