from __future__ import annotations

import json
import logging
from typing import Any

try:
    from google import genai
except ImportError:
    genai = None

from services.hrai.config import get_settings
from schemas import (
    LLMResponse,
    PreprocessedInput,
)
from services.hrai.ai_pipeline.knowledge.ontology_loader import get_ontology_prompt_text
from services.hrai.ai_pipeline.knowledge.schema_loader import get_all_schemas
from services.hrai.ai_pipeline.name_shortener import (
    shorten_schema,
    build_schema_prompt,
    NameMapping,
)

logger = logging.getLogger(__name__)

QUESTION_TYPES = [
    "lookup", "aggregate", "ranking", "comparison",
    "trend", "threshold", "rule_check", "special", "general"
]

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if genai is None:
        raise ImportError("google-genai library not installed.")
    import os
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key or not api_key.strip():
        raise ValueError(
            "Chưa cấu hình Gemini API Key! Vui lòng điền GEMINI_API_KEY trong file .env hoặc Cài đặt."
        )

    if _client is None or getattr(_client, "_cached_api_key", None) != api_key:
        _client = genai.Client(api_key=api_key)
        _client._cached_api_key = api_key

    return _client


SYSTEM_PROMPT = """Bạn là HR Data Analyst AI. Nhiệm vụ của bạn:
1. Phân loại câu hỏi HR thuộc loại nào.
2. Viết câu lệnh SQL SELECT phù hợp hoặc chỉ ra bảng/cột cần trích xuất nếu đó là câu hỏi đặc biệt.
3. Giải thích ngắn gọn cho người dùng.

## HƯỚNG DẪN PHÂN LOẠI CÂU HỎI:
- **lookup**: Tra cứu thông tin cụ thể. Hãy viết SQL SELECT lấy các cột liên quan.
- **aggregate**: Tổng hợp dữ liệu (SUM, AVG, COUNT). Hãy viết SQL SELECT tương ứng.
- **ranking**: Xếp hạng (top N, ORDER BY + LIMIT). Hãy viết SQL SELECT tương ứng.
- **comparison**: So sánh giữa các nhóm. Hãy viết SQL SELECT tương ứng.
- **trend**: Xu hướng theo thời gian. Hãy viết SQL SELECT tương ứng.
- **threshold**: Lọc theo ngưỡng. Hãy viết SQL SELECT tương ứng.
- **rule_check**: Kiểm tra quy định. Hãy viết SQL SELECT tương ứng.
- **special**: CÂU HỎI ĐẶC BIỆT yêu cầu trích xuất text tự do từ dữ liệu cột.
  - Hãy điền `special_table` là bảng liên quan (tên rút gọn) và `special_columns` là danh sách các cột (tên rút gọn).
  - Hãy điền `sql` = "SELECT 'special'".
- **general**: Không thuộc loại nào trên.

## RULES BẮT BUỘC:
1. **question_type** PHẢI nằm trong list quy định.
2. **sql** PHẢI là câu lệnh SELECT hợp lệ dùng SQL syntax (hoặc "SELECT 'special'").
   - CHỈ ĐƯỢC dùng SELECT — KHÔNG BAO GIỜ viết INSERT/UPDATE/DELETE/DROP/ALTER.
3. **explanation** là giải thích ngắn bằng tiếng Việt. KHÔNG điền số liệu cụ thể.
4. **display** chọn loại hiển thị phù hợp: table | card | bar_chart | line_chart | text.

## OUTPUT FORMAT — JSON duy nhất:
{
  "question_type": "...",
  "sql": "SELECT ...",
  "explanation": "...",
  "display": "table|card|bar_chart|line_chart|text",
  "special_table": "tên_bảng_rút_gọn_nếu_loại_special_hoặc_null",
  "special_columns": ["danh_sách_cột_rút_gọn_nếu_loại_special_hoặc_null"]
}
"""


def _build_prompt(
    processed: PreprocessedInput,
    schema_prompt: str,
) -> str:
    parts = []

    parts.append("# BUSINESS ONTOLOGY (Đồng nghĩa, quy tắc)")
    parts.append(get_ontology_prompt_text())

    parts.append("\n# SCHEMA METADATA (Tên rút gọn — viết SQL dùng tên này)")
    parts.append(schema_prompt)

    if processed.resolved_time:
        parts.append(
            f"\n# THỜI GIAN ĐÃ PHÂN TÍCH\n"
            f"Khoảng thời gian: {processed.resolved_time['start']} → {processed.resolved_time['end']}"
        )

    parts.append(f"\n# CÂU HỎI\n{processed.original}")

    return "\n\n".join(parts)


async def generate_sql(
    processed: PreprocessedInput,
) -> tuple[LLMResponse, NameMapping]:
    client = _get_client()
    settings = get_settings()
    
    schemas = get_all_schemas()
    shortened, mapping = shorten_schema(schemas)
    schema_prompt = build_schema_prompt(shortened, mapping)
    
    prompt = _build_prompt(processed, schema_prompt)
    
    llm_response = await _call_llm(client, settings.GEMINI_MODEL, prompt)
    
    if llm_response.question_type not in QUESTION_TYPES:
        logger.warning(
            "Invalid question_type '%s', defaulting to 'general'",
            llm_response.question_type,
        )
        llm_response.question_type = "general"
    
    return llm_response, mapping


async def _call_llm(
    client: genai.Client,
    model: str,
    prompt: str,
) -> LLMResponse:
    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,
                max_output_tokens=1024,
            ),
        )

        raw_text = response.text
        logger.debug("LLM raw response: %s", raw_text[:500])

        data = json.loads(raw_text)
        return LLMResponse(**data)

    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s", e)
        return _fallback_response()
    except Exception as e:
        logger.error("LLM call failed: %s", e)
        raise


def _fallback_response() -> LLMResponse:
    return LLMResponse(
        question_type="general",
        sql="SELECT 'Xin lỗi, không thể xử lý câu hỏi này' AS message",
        explanation="Xin lỗi, tôi chưa thể xử lý câu hỏi này. Vui lòng thử lại.",
        display="text",
    )


async def answer_special_question(
    question: str,
    data_context: str,
) -> str:
    client = _get_client()
    settings = get_settings()

    prompt = f"""Bạn là HR Assistant. Dưới đây là dữ liệu thực tế liên quan được trích xuất từ database để trả lời câu hỏi của người dùng.
Hãy đọc kỹ dữ liệu và trả lời câu hỏi một cách ngắn gọn, chính xác bằng tiếng Việt.

# DỮ LIỆU ĐÃ TRÍCH XUẤT:
{data_context}

# CÂU HỎI CỦA NGƯỜI DÙNG:
{question}
"""
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=1024,
            ),
        )
        return response.text.strip()
    except Exception as e:
        logger.error("Failed to answer special question: %s", e)
        return f"Không thể trích xuất câu trả lời do lỗi: {str(e)}"
