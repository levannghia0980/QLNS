import time
import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from schemas import ChatResponse
from services.hrai.query_planner_engine.preprocessor import preprocess_question
from services.hrai.query_planner_engine.context_retriever import (
    get_full_multi_table_schema_snapshot,
    execute_multi_table_query_and_compute
)
from services.hrai.query_planner_engine.query_planner import (
    extract_dynamic_spec_llm,
    synthesize_dynamic_response_llm
)

logger = logging.getLogger(__name__)


async def run_query_planner_pipeline(
    question: str,
    db: AsyncSession,
    session_id: str | None = None
) -> ChatResponse:
    pipeline_start = time.time()
    logger.info("=== Starting 2-Request Dynamic Engine (v2) for: %s ===", question[:100])

    # ── Step 1: Preprocess ──
    processed = preprocess_question(question)
    if processed.is_chat:
        total_time = round(time.time() - pipeline_start, 3)
        return ChatResponse(
            text="Xin chào! Tôi là Trợ lý HR AI chuyên hỗ trợ quản lý, tra cứu và phân tích dữ liệu nhân sự. Bạn muốn tra cứu thông tin gì hôm nay?",
            display="text",
            data=None,
            sql=None,
            metadata={
                "engine": "Dynamic2RequestEngine_v2",
                "intent": "chat",
                "total_pipeline_seconds": total_time,
            }
        )

    # ── Step 2: Build Schema Snapshot ──
    multi_schema_snapshot = await get_full_multi_table_schema_snapshot(db)
    table_summary = ", ".join([
        f"{t['table_name']}({t.get('row_count', '?')} rows)"
        for t in multi_schema_snapshot["tables"]
    ])
    logger.info("2. Schema Snapshot built | tables: %s | names_count=%d",
                table_summary, len(multi_schema_snapshot["all_person_names"]))

    # ── Step 3: LLM Request 1 — Extract Spec + Generate SQL ──
    max_spec_retries = 1
    query_spec = None
    last_error = None

    for attempt in range(max_spec_retries + 1):
        try:
            query_spec = await extract_dynamic_spec_llm(question, multi_schema_snapshot)
            logger.info(
                "3. Request 1 Spec (attempt %d): tables=%s | intent=%s | person=%s | calc=%s | has_sql=%s",
                attempt + 1,
                query_spec.selected_tables,
                query_spec.intent_type,
                query_spec.extracted_person_name,
                query_spec.calc_type,
                bool(query_spec.generated_sql)
            )
            if query_spec.generated_sql:
                logger.info("   Generated SQL: %s", query_spec.generated_sql[:200])
            break
        except ValueError as val_err:
            total_time = round(time.time() - pipeline_start, 3)
            return ChatResponse(
                text=str(val_err),
                display="text",
                data=None,
                sql=None,
                metadata={
                    "engine": "Dynamic2RequestEngine_v2",
                    "error_type": "QuotaExceeded",
                    "total_pipeline_seconds": total_time,
                }
            )
        except Exception as e:
            last_error = str(e)
            logger.warning("Spec extraction attempt %d failed: %s", attempt + 1, last_error)

    if query_spec is None:
        total_time = round(time.time() - pipeline_start, 3)
        return ChatResponse(
            text=f"Xin lỗi, đã xảy ra lỗi khi phân tích câu hỏi: {last_error}",
            display="text",
            data=None,
            sql=None,
            metadata={
                "engine": "Dynamic2RequestEngine_v2",
                "error_type": "SpecExtractionFailed",
                "total_pipeline_seconds": total_time,
            }
        )

    # ── Step 4: Execute Query + Compute ──
    computed_result, executed_sql, name_res = await execute_multi_table_query_and_compute(
        query_spec, multi_schema_snapshot, db
    )
    logger.info("4. Execution Completed | rows=%d | sql=%s",
                computed_result.get("row_count", 0), executed_sql[:150] if executed_sql else "N/A")

    # ── Handle ambiguous name ──
    if name_res.is_ambiguous and name_res.candidates:
        candidates_str = ", ".join(name_res.candidates)
        ambiguous_text = (
            f"Tìm thấy nhiều nhân sự khớp với tên '{query_spec.extracted_person_name}': {candidates_str}.\n"
            f"Bạn vui lòng cung cấp thêm họ tên đầy đủ hoặc mã nhân sự để tôi hỗ trợ chính xác hơn nhé!"
        )
        total_time = round(time.time() - pipeline_start, 3)
        return ChatResponse(
            text=ambiguous_text,
            display="text",
            data=computed_result.get("data_preview"),
            sql=executed_sql,
            metadata={
                "engine": "Dynamic2RequestEngine_v2",
                "query_spec": query_spec.model_dump(),
                "total_pipeline_seconds": total_time,
            }
        )

    # ── Step 5: LLM Request 2 — Synthesize Answer ──
    try:
        final_answer = await synthesize_dynamic_response_llm(question, computed_result)
    except ValueError as val_err:
        final_answer = str(val_err)

    total_time = round(time.time() - pipeline_start, 3)

    return ChatResponse(
        text=final_answer,
        display="table" if computed_result.get("data_preview") else "text",
        data=computed_result.get("data_preview"),
        sql=executed_sql,
        metadata={
            "engine": "Dynamic2RequestEngine_v2",
            "query_spec": query_spec.model_dump(),
            "row_count": computed_result.get("row_count", 0),
            "total_pipeline_seconds": total_time,
        }
    )
