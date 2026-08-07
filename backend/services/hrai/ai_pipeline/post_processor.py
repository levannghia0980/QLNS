from __future__ import annotations

import logging
from typing import Any

from schemas import LLMResponse, ChatResponse

logger = logging.getLogger(__name__)


def post_process(
    llm_response: LLMResponse,
    sql_result: list[dict[str, Any]],
    executed_sql: str,
) -> ChatResponse:
    display = llm_response.display
    text = llm_response.explanation

    if not sql_result:
        text = _enhance_no_data(text, llm_response.question_type)
        display = "text"
    else:
        text = _enhance_with_data(text, sql_result, llm_response.question_type)

    return ChatResponse(
        text=text,
        display=display,
        data=sql_result if sql_result else None,
        sql=executed_sql,
        metadata={
            "question_type": llm_response.question_type,
            "row_count": len(sql_result),
        },
    )


def _enhance_with_data(
    explanation: str,
    data: list[dict[str, Any]],
    question_type: str,
) -> str:
    row_count = len(data)
    
    if question_type == "aggregate" and row_count == 1:
        row = data[0]
        values = []
        for key, val in row.items():
            if isinstance(val, (int, float)):
                formatted = f"{val:,.0f}" if val == int(val) else f"{val:,.2f}"
                values.append(f"**{key}**: {formatted}")
            elif val is not None:
                values.append(f"**{key}**: {val}")
        if values:
            explanation += "\n\n" + " | ".join(values)
    
    elif question_type in ("ranking", "threshold") and row_count > 0:
        explanation += f"\n\n📊 Tìm thấy **{row_count}** kết quả."
    
    elif question_type == "lookup" and row_count == 1:
        row = data[0]
        lines = []
        for key, val in row.items():
            if val is not None:
                if isinstance(val, float):
                    val = f"{val:,.2f}" if val != int(val) else f"{int(val):,}"
                lines.append(f"• **{key}**: {val}")
        if lines:
            explanation += "\n\n" + "\n".join(lines)
    
    elif row_count > 1:
        explanation += f"\n\n📋 Tổng cộng **{row_count}** bản ghi."

    return explanation


def _enhance_no_data(explanation: str, question_type: str) -> str:
    return (
        f"{explanation}\n\n"
        "⚠️ Không tìm thấy dữ liệu phù hợp. "
        "Vui lòng kiểm tra lại điều kiện hoặc thử câu hỏi khác."
    )
