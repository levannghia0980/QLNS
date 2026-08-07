from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

logger = logging.getLogger(__name__)

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[4] / "data" / "schema_metadata"


async def generate_schema_metadata(
    database_url: str,
    tables: list[str] | None = None,
    output_dir: Path | None = None,
) -> dict[str, Any]:
    out_dir = output_dir or DEFAULT_OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    engine = create_async_engine(database_url)
    results = {}

    async with engine.connect() as conn:
        if tables is None:
            raw = await conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
            ))
            tables = [row[0] for row in raw.fetchall()]

        for table_name in tables:
            logger.info("Generating metadata for table: %s", table_name)
            schema_data = await _introspect_table(conn, table_name)
            results[table_name] = schema_data

            output_file = out_dir / f"{table_name}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(schema_data, f, ensure_ascii=False, indent=2)
            logger.info("Written: %s", output_file)

    await engine.dispose()
    return results


async def _introspect_table(conn, table_name: str) -> dict[str, Any]:
    col_query = text("""
        SELECT column_name, data_type, is_nullable, column_default,
               character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = :table
        ORDER BY ordinal_position
    """)
    result = await conn.execute(col_query, {"table": table_name})
    raw_columns = result.fetchall()

    columns = []
    for row in raw_columns:
        col_name, data_type, nullable, default, char_len, num_prec, num_scale = row

        type_str = data_type
        if char_len:
            type_str = f"varchar({char_len})"
        elif num_prec and num_scale:
            type_str = f"numeric({num_prec},{num_scale})"

        entry: dict[str, Any] = {
            "name": col_name,
            "type": type_str,
        }

        sample = await _get_sample_value(conn, table_name, col_name)
        if sample is not None:
            entry["sample"] = sample

        distinct_count = await _get_distinct_count(conn, table_name, col_name)
        if distinct_count is not None and 0 < distinct_count <= 10:
            enum_values = await _get_distinct_values(conn, table_name, col_name)
            entry["enum_values"] = enum_values
        else:
            notes = []
            if default and "nextval" in str(default):
                notes.append("PK, auto-increment")
            if nullable == "YES":
                notes.append("nullable")
            if notes:
                entry["note"] = ", ".join(notes)

        columns.append(entry)

    return {
        "table": table_name,
        "columns": columns,
    }


async def _get_sample_value(conn, table_name: str, col_name: str) -> Any:
    try:
        result = await conn.execute(text(
            f'SELECT "{col_name}" FROM "{table_name}" '
            f'WHERE "{col_name}" IS NOT NULL LIMIT 1'
        ))
        row = result.fetchone()
        if row:
            val = row[0]
            if hasattr(val, "isoformat"):
                return val.isoformat()
            return val
    except Exception:
        return None


async def _get_distinct_count(conn, table_name: str, col_name: str) -> int | None:
    try:
        result = await conn.execute(text(
            f'SELECT COUNT(DISTINCT "{col_name}") FROM "{table_name}"'
        ))
        row = result.fetchone()
        return row[0] if row else None
    except Exception:
        return None


async def _get_distinct_values(conn, table_name: str, col_name: str) -> list:
    try:
        result = await conn.execute(text(
            f'SELECT DISTINCT "{col_name}" FROM "{table_name}" '
            f'WHERE "{col_name}" IS NOT NULL ORDER BY "{col_name}"'
        ))
        values = [row[0] for row in result.fetchall()]
        return [v.isoformat() if hasattr(v, "isoformat") else v for v in values]
    except Exception:
        return []
