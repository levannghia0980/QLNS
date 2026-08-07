import json
import logging
import os
import re
from typing import Dict, Any, List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

CACHE_PATH = "data/knowledge_graph_cache.json"


class SchemaKnowledgeGraph:
    def __init__(self):
        self.table_graph: Dict[str, Any] = {}
        self.column_graph: Dict[str, Any] = {}
        self.relation_graph: List[Dict[str, Any]] = []

    async def build_from_db_dynamic(self, db: AsyncSession) -> "SchemaKnowledgeGraph":
        is_sqlite = "sqlite" in str(db.bind.url) if hasattr(db, "bind") and db.bind else True

        if is_sqlite:
            query = text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'alembic_%' AND name NOT LIKE '_sheet_%';")
        else:
            query = text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE '_sheet_%';")

        try:
            res = await db.execute(query)
            tables = [r[0] for r in res.fetchall()]
        except Exception as e:
            logger.error("Lỗi lấy danh sách bảng CSDL: %s", e)
            tables = []

        self.table_graph = {}
        self.column_graph = {}

        for t in tables:
            self.table_graph[t] = {
                "display_name": t.replace("sheet_", "").replace("_", " ").title(),
                "entities": [],
                "attributes": []
            }

            try:
                if is_sqlite:
                    cols_res = await db.execute(text(f'PRAGMA table_info("{t}")'))
                    cols = cols_res.fetchall()
                else:
                    cols_res = await db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :t"), {"t": t})
                    cols = cols_res.fetchall()

                col_list = []
                for col in cols:
                    col_name = col[1] if is_sqlite else col[0]
                    col_type = (col[2] if is_sqlite else col[1]) or "TEXT"
                    col_type_upper = col_type.upper()
                    
                    col_list.append(col_name)
                    c_key = f"{t}.{col_name}"

                    sem_type = "text"
                    if any(t_kw in col_type_upper for t_kw in ["INT", "FLOAT", "DOUBLE", "NUMERIC", "DECIMAL"]):
                        sem_type = "numeric"
                    elif any(t_kw in col_type_upper for t_kw in ["DATE", "TIME", "TIMESTAMP"]):
                        sem_type = "date"

                    ops = ["=", "LIKE"]
                    if sem_type in ["numeric", "date"]:
                        ops.extend(["min", "max", "between", ">", "<", "sort"])

                    self.column_graph[c_key] = {
                        "table_name": t,
                        "column_name": col_name,
                        "data_type": col_type,
                        "semantic_type": sem_type,
                        "aliases": [col_name.lower(), col_name.replace("_", " ").lower()],
                        "operators": ops
                    }

                self.table_graph[t]["entities"] = col_list
            except Exception as e:
                logger.error("Lỗi đọc thông tin cột cho bảng %s: %s", t, e)

        self._detect_relations(tables)
        self.save_to_disk()
        return self

    def _detect_relations(self, tables: List[str]):
        self.relation_graph = []
        for i in range(len(tables)):
            for j in range(i + 1, len(tables)):
                t1 = tables[i]
                t2 = tables[j]
                
                t1_cols = [k.split(".")[1] for k in self.column_graph.keys() if k.startswith(f"{t1}.")]
                t2_cols = [k.split(".")[1] for k in self.column_graph.keys() if k.startswith(f"{t2}.")]

                common = set(t1_cols).intersection(set(t2_cols))
                for c in common:
                    if c.lower() != "id":
                        self.relation_graph.append({
                            "from": t1,
                            "to": t2,
                            "join_type": "INNER JOIN",
                            "condition": f'"{t1}"."{c}" = "{t2}"."{c}"',
                            "common_key": c
                        })

    def save_to_disk(self):
        try:
            os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
            with open(CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump({
                    "tables": self.table_graph,
                    "columns": self.column_graph,
                    "relations": self.relation_graph
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Lỗi lưu cache Knowledge Graph: %s", e)
