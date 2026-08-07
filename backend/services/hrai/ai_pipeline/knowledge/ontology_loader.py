from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

from services.hrai.ai_pipeline.knowledge.cache import set_cache, get_cache

logger = logging.getLogger(__name__)

ONTOLOGY_CACHE_KEY = "business_ontology"
ONTOLOGY_PATH = Path(__file__).resolve().parents[4] / "data" / "business_ontology.yaml"


def load_ontology(path: Path | None = None) -> dict[str, Any]:
    file_path = path or ONTOLOGY_PATH

    if not file_path.exists():
        logger.warning("Ontology file not found: %s", file_path)
        return {}

    with open(file_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    set_cache(ONTOLOGY_CACHE_KEY, data)
    logger.info("Ontology loaded: %d keys from %s", len(data), file_path.name)
    return data


def get_ontology() -> dict[str, Any]:
    cached = get_cache(ONTOLOGY_CACHE_KEY)
    if cached is None:
        return load_ontology()
    return cached


def get_ontology_prompt_text() -> str:
    ontology = get_ontology()
    if not ontology:
        return "(Không có Business Ontology)"

    lines = []

    if "synonyms" in ontology:
        lines.append("## Đồng nghĩa")
        for key, values in ontology["synonyms"].items():
            lines.append(f"- {key} = {', '.join(values)}")

    if "formulas" in ontology:
        lines.append("\n## Công thức")
        for key, formula in ontology["formulas"].items():
            lines.append(f"- {formula}")

    if "rules" in ontology:
        lines.append("\n## Rule nghiệp vụ")
        for key, rule in ontology["rules"].items():
            lines.append(f"- {rule}")

    if "entities" in ontology:
        lines.append("\n## Entity cố định")
        for entity_type, values in ontology["entities"].items():
            lines.append(f"- {entity_type}: {', '.join(values)}")

    if "metric_mapping" in ontology:
        lines.append("\n## Metric → Cột DB")
        for metric, col in ontology["metric_mapping"].items():
            lines.append(f"- {metric} → {col}")

    return "\n".join(lines)


def get_synonym_map() -> dict[str, str]:
    ontology = get_ontology()
    mapping = {}
    for canonical, synonyms in ontology.get("synonyms", {}).items():
        for syn in synonyms:
            mapping[syn.lower()] = canonical
    return mapping
