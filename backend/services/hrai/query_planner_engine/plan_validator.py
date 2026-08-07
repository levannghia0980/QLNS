import logging
from typing import List, Optional
from services.hrai.query_planner_engine.query_planner import DynamicQuerySpec

logger = logging.getLogger(__name__)


def validate_dynamic_spec(
    spec: DynamicQuerySpec,
    valid_columns: List[str]
) -> Optional[str]:
    return None
