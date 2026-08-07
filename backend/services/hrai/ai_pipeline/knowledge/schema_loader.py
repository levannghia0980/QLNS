from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from services.hrai.ai_pipeline.knowledge.cache import set_cache, get_cache

logger = logging.getLogger(__name__)

SCHEMA_CACHE_KEY = "schema_metadata"
SCHEMA_DIR = Path(__file__).resolve().parents[4] / "data" / "schema_metadata"


def load_schema_metadata(directory: Path | None = None) -> dict[str, Any]:
    dir_path = directory or SCHEMA_DIR

    if not dir_path.exists():
        logger.warning("Schema metadata directory not found: %s", dir_path)
        return {}

    schemas = {}
    for json_file in sorted(dir_path.glob("*.json")):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            table_name = data.get("table", json_file.stem)
            schemas[table_name] = data
            logger.debug("Loaded schema: %s (%d columns)", table_name, len(data.get("columns", [])))
        except (json.JSONDecodeError, KeyError) as e:
            logger.error("Failed to load schema %s: %s", json_file.name, e)

    set_cache(SCHEMA_CACHE_KEY, schemas)
    logger.info("Schema metadata loaded: %d tables from %s", len(schemas), dir_path)
    return schemas


def reload_schema_metadata() -> dict[str, Any]:
    logger.info("Reloading schema metadata...")
    return load_schema_metadata()


def get_all_schemas() -> dict[str, Any]:
    cached = get_cache(SCHEMA_CACHE_KEY)
    if cached is None:
        return load_schema_metadata()
    return cached


def get_table_schema(table_name: str) -> dict[str, Any] | None:
    schemas = get_all_schemas()
    return schemas.get(table_name)


def get_valid_columns(table_name: str) -> set[str]:
    schema = get_table_schema(table_name)
    if schema is None:
        return set()
    return {col["name"] for col in schema.get("columns", [])}


def get_all_valid_columns() -> dict[str, set[str]]:
    schemas = get_all_schemas()
    return {
        table: {col["name"] for col in data.get("columns", [])}
        for table, data in schemas.items()
    }


def get_schema_prompt_text() -> str:
    schemas = get_all_schemas()
    if not schemas:
        return "(Không có Schema Metadata)"

    lines = []
    for table_name, schema in schemas.items():
        lines.append(f"### Bảng: {table_name}")
        if "description" in schema:
            lines.append(f"Mô tả: {schema['description']}")
        lines.append("Cột:")
        for col in schema.get("columns", []):
            parts = [f"  - {col['name']} ({col.get('type', '?')})"]
            if "enum_values" in col:
                parts.append(f"    enum: {col['enum_values']}")
            elif "sample" in col:
                parts.append(f"    sample: {col['sample']}")
            if "note" in col:
                parts.append(f"    note: {col['note']}")
            lines.append("\n".join(parts))
        lines.append("")

    return "\n".join(lines)
