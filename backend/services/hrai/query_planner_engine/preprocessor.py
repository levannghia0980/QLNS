import re
from pydantic import BaseModel


class PreprocessedQuestion(BaseModel):
    raw_question: str
    normalized_question: str
    is_chat: bool = False


CASUAL_GREETINGS = {
    "chào", "chào bạn", "hi", "hello", "xin chào", "bạn là ai", "hướng dẫn", "tạm biệt", "bye"
}


def normalize_vietnamese_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def preprocess_question(raw_question: str) -> PreprocessedQuestion:
    normalized = normalize_vietnamese_text(raw_question)
    
    is_chat = False
    if normalized in CASUAL_GREETINGS or any(normalized == g or normalized.startswith(g + " ") for g in ["chào", "xin chào", "hi", "hello"]):
        if len(normalized.split()) <= 4:
            is_chat = True

    return PreprocessedQuestion(
        raw_question=raw_question,
        normalized_question=normalized,
        is_chat=is_chat
    )
