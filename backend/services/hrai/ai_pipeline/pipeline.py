from __future__ import annotations

import logging
import time
import json

from sqlalchemy.ext.asyncio import AsyncSession

from schemas import ChatResponse
from services.hrai.ai_pipeline.preprocessor import preprocess
from services.hrai.ai_pipeline.llm_sql_generator import generate_sql, answer_special_question
from services.hrai.ai_pipeline.name_shortener import restore_sql
from services.hrai.ai_pipeline.execution_engine import execute_query, validate_sql
from services.hrai.ai_pipeline.post_processor import post_process

logger = logging.getLogger(__name__)


async def run_pipeline(
    question: str,
    db: AsyncSession,
    session_id: str | None = None,
) -> ChatResponse:
    pipeline_start = time.time()

    logger.info("① Preprocessing: %s", question[:100])
    processed = preprocess(question, session_id)
    logger.debug("Preprocessed: %s", processed.normalized_text[:100])

    logger.info("②③ Calling LLM (single call — classify + generate SQL)...")
    llm_start = time.time()
    try:
        llm_response, mapping = await generate_sql(processed)
    except Exception as e:
        logger.error("②③ LLM call failed: %s", e)
        return ChatResponse(
            text=f"Lỗi khi gọi AI: {e}",
            display="text",
            metadata={"error": True, "error_message": str(e)},
        )
    llm_elapsed = round(time.time() - llm_start, 3)
    logger.info(
        "②③ LLM done in %.3fs | type=%s | display=%s",
        llm_elapsed, llm_response.question_type, llm_response.display,
    )

    if llm_response.question_type == "special":
        logger.info("★ Handling special text extraction path...")
        short_table = llm_response.special_table
        short_cols = llm_response.special_columns or []

        original_table = mapping.table_map.get(short_table, short_table) if short_table else None
        original_cols = [mapping.column_map.get(c, c) for c in short_cols]

        if not original_table or not original_cols:
            logger.warning("No table/cols mapped for special query: table=%s, cols=%s", original_table, original_cols)
            return ChatResponse(
                text="Không tìm thấy các trường thông tin liên quan để trích xuất.",
                display="text",
                metadata={"question_type": "special", "error": True}
            )

        quoted_cols = ", ".join([f'"{c}"' for c in original_cols])
        special_sql = f'SELECT {quoted_cols} FROM "{original_table}" LIMIT 100'
        logger.info("Special SQL: %s", special_sql)

        try:
            sql_result = await execute_query(special_sql, {}, db)
        except Exception as e:
            logger.error("Special SQL query execution failed: %s", e)
            return ChatResponse(
                text=f"Lỗi truy vấn dữ liệu đặc biệt: {e}",
                display="text",
                sql=special_sql,
                metadata={"question_type": "special", "error": True}
            )

        data_context = json.dumps(sql_result, ensure_ascii=False, indent=2)

        logger.info("Calling Gemini for text extraction QA...")
        special_qa_start = time.time()
        answer_text = await answer_special_question(processed.original, data_context)
        special_qa_elapsed = round(time.time() - special_qa_start, 3)
        llm_elapsed += special_qa_elapsed

        total_elapsed = round(time.time() - pipeline_start, 3)

        return ChatResponse(
            text=answer_text,
            display="text",
            data=sql_result,
            sql=special_sql,
            metadata={
                "question_type": "special",
                "row_count": len(sql_result),
                "llm_time_seconds": llm_elapsed,
                "total_pipeline_seconds": total_elapsed
            }
        )

    original_sql = restore_sql(llm_response.sql, mapping)
    logger.info("④ SQL restored: %s", original_sql[:200])

    validation_error = validate_sql(original_sql)
    if validation_error:
        logger.warning("⑤ SQL validation failed: %s", validation_error)
        return ChatResponse(
            text=f"Lỗi bảo mật: {validation_error}",
            display="text",
            metadata={
                "question_type": llm_response.question_type,
                "error": True,
                "blocked_sql": original_sql[:100],
            },
        )

    try:
        sql_result = await execute_query(original_sql, {}, db)
        logger.info("⑥ SQL executed: %d rows", len(sql_result))
    except Exception as e:
        logger.error("⑥ SQL execution failed: %s", e)
        return ChatResponse(
            text=f"Lỗi truy vấn dữ liệu: {e}",
            display="text",
            sql=original_sql,
            metadata={
                "question_type": llm_response.question_type,
                "error": True,
                "error_message": str(e),
            },
        )

    total_elapsed = round(time.time() - pipeline_start, 3)
    response = post_process(llm_response, sql_result, original_sql)
    
    response.metadata["llm_time_seconds"] = llm_elapsed
    response.metadata["total_pipeline_seconds"] = total_elapsed

    logger.info(
        "⑦ Pipeline complete | type=%s | rows=%d | total=%.3fs | llm=%.3fs",
        llm_response.question_type, len(sql_result), total_elapsed, llm_elapsed,
    )

    return response
