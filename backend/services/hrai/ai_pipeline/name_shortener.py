from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

_VIET_MAP = str.maketrans(
    "àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ"
    "ÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ",
    "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd"
    "AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD",
)


def _remove_diacritics(text: str) -> str:
    return text.translate(_VIET_MAP)


def _abbreviate(name: str, max_parts: int = 3) -> str:
    clean = _remove_diacritics(name.lower())
    parts = clean.split("_")
    
    if len(parts) <= max_parts:
        return clean
    
    abbreviated = "".join(p[:2] for p in parts if p)
    return abbreviated


class NameMapping:
    def __init__(self):
        self.table_map: dict[str, str] = {}
        self.column_map: dict[str, str] = {}
        self.reverse_table: dict[str, str] = {}
        self.reverse_column: dict[str, str] = {}
    
    def add_table(self, original: str, short: str):
        self.table_map[short] = original
        self.reverse_table[original] = short
    
    def add_column(self, original: str, short: str):
        self.column_map[short] = original
        self.reverse_column[original] = short


def shorten_schema(
    schemas: dict[str, Any],
) -> tuple[dict[str, Any], NameMapping]:
    mapping = NameMapping()
    shortened = {}
    used_shorts: set[str] = set()
    
    for table_name, schema_data in schemas.items():
        short_table = _make_unique(
            _abbreviate(table_name), 
            used_shorts,
            prefix="t"
        )
        used_shorts.add(short_table)
        mapping.add_table(table_name, short_table)
        
        col_shorts: set[str] = set()
        new_columns = []
        
        for col in schema_data.get("columns", []):
            original_col = col["name"]
            short_col = _make_unique(
                _abbreviate(original_col),
                col_shorts,
                prefix="c"
            )
            col_shorts.add(short_col)
            mapping.add_column(original_col, short_col)
            
            new_col = {**col, "name": short_col, "_original": original_col}
            new_columns.append(new_col)
        
        shortened[short_table] = {
            **schema_data,
            "table": short_table,
            "_original_table": table_name,
            "columns": new_columns,
        }
    
    logger.info(
        "Schema shortened: %d tables, %d columns mapped",
        len(mapping.table_map),
        len(mapping.column_map),
    )
    
    return shortened, mapping


def _make_unique(short: str, existing: set[str], prefix: str = "") -> str:
    if short not in existing:
        return short
    
    for i in range(2, 100):
        candidate = f"{short}{i}"
        if candidate not in existing:
            return candidate
    
    for i in range(1, 1000):
        candidate = f"{prefix}{i}"
        if candidate not in existing:
            return candidate
    
    return short


def restore_sql(sql: str, mapping: NameMapping) -> str:
    result = sql
    all_replacements = []
    
    for short, original in mapping.table_map.items():
        if short != original:
            all_replacements.append((short, original))
    
    for short, original in mapping.column_map.items():
        if short != original:
            all_replacements.append((short, original))
    
    all_replacements.sort(key=lambda x: len(x[0]), reverse=True)
    
    for short, original in all_replacements:
        pattern = r'\b' + re.escape(short) + r'\b'
        result = re.sub(pattern, original, result)
    
    logger.debug("SQL restored: %s", result[:200])
    return result


def build_schema_prompt(
    shortened_schemas: dict[str, Any],
    mapping: NameMapping,
) -> str:
    lines = []
    
    for short_table, schema in shortened_schemas.items():
        original_table = schema.get("_original_table", short_table)
        desc = schema.get("description", "")
        
        lines.append(f"### Bảng: {short_table} (gốc: {original_table})")
        if desc:
            lines.append(f"Mô tả: {desc}")
        lines.append("Cột:")
        
        for col in schema.get("columns", []):
            original_col = col.get("_original", col["name"])
            col_type = col.get("type", "?")
            parts = [f"  - {col['name']} ({col_type}) [gốc: {original_col}]"]
            
            if "enum_values" in col:
                parts.append(f"    giá trị có thể: {col['enum_values']}")
            elif "sample" in col:
                parts.append(f"    ví dụ: {col['sample']}")
            if "note" in col:
                parts.append(f"    ghi chú: {col['note']}")
            
            lines.append("\n".join(parts))
        
        lines.append("")
    
    return "\n".join(lines)
