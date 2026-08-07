from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Request
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from fastapi.responses import Response
from schemas import ChatRequest, ChatResponse, RunSQLRequest, ExportExcelRequest
from services.hrai.hrai_service import HraiService
import auth
import time

router = APIRouter(prefix="/hrai", tags=["HrAi"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.chat(request, db)


@router.post("/chat/run_sql", response_model=ChatResponse)
async def run_sql(
    request: RunSQLRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.run_sql(request, db)


@router.post("/generate-schema-proposal")
async def generate_schema_proposal(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    question = payload.get("question", "")
    if not question:
        raise HTTPException(status_code=400, detail="Vui lòng nhập nội dung câu hỏi!")
    return await HraiService.generate_schema_proposal(question, db)


@router.post("/create-custom-table")
async def create_custom_table(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    table_name = payload.get("table_name", "")
    title = payload.get("title", "")
    columns = payload.get("columns", [])
    rows = payload.get("rows", [])
    if not table_name or not columns:
        raise HTTPException(status_code=400, detail="Thiếu thông tin tên bảng hoặc danh sách cột!")
    return await HraiService.create_custom_table(table_name, title, columns, rows, db)


@router.post("/tables/{table_name}/auto-create-sheet")
async def auto_create_sheet_for_table(
    table_name: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.auto_create_google_sheet_for_table(table_name, db)


@router.get("/sheets")
@router.get("/sheets/")
async def get_sheets(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.get_sheets(db)


@router.get("/db-tables")
@router.get("/db-tables/")
async def get_db_tables(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.get_db_tables(db)


@router.get("/db-tables/{table_name}/data")
@router.get("/db-tables/{table_name}/data/")
async def get_db_table_data(
    table_name: str,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.get_db_table_data(table_name, limit, db)


@router.get("/sheets/{tab_id}/data")
@router.get("/sheets/{tab_id}/data/")
async def get_sheet_data(
    tab_id: int,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.get_sheet_data(tab_id, limit, db)


@router.post("/sheets/{tab_id}/sync")
@router.post("/sheets/{tab_id}/sync/")
async def sync_sheet(
    tab_id: int,
    request: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.sync_sheet(tab_id, request or {}, db)


@router.post("/sheets/preview")
@router.post("/preview-sheet")
async def preview_sheet(
    request: Request,
    url: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    current_user = Depends(auth.get_current_user)
):
    sheet_url = url
    if not sheet_url:
        try:
            body = await request.json()
            sheet_url = body.get("sheet_url") or body.get("url")
            sheet_name = sheet_name or body.get("sheet_name")
        except Exception:
            pass
    return await HraiService.preview_sheet(sheet_url or "", sheet_name)


@router.post("/sheets/preview-excel")
@router.post("/preview-excel")
async def preview_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    current_user = Depends(auth.get_current_user)
):
    file_bytes = await file.read()
    return await HraiService.preview_excel(file_bytes, file.filename)


@router.post("/sheets/upload")
@router.post("/upload-sheet")
async def upload_sheet(
    request: Request,
    url: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    payload = None
    try:
        payload = await request.json()
    except Exception:
        pass
    
    if not payload:
        payload = {
            "sheet_url": url,
            "tab_name": sheet_name or "",
            "excluded_columns": [],
            "accept_inferred_field": False,
            "inferred_proposal": {}
        }
    return await HraiService.upload_sheet(payload, db)


@router.post("/sheets/upload-excel")
@router.post("/upload-excel")
async def upload_excel(
    file: UploadFile = File(...),
    options: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    file_bytes = await file.read()
    request_data = {}
    if options:
        try:
            import json
            request_data = json.loads(options)
        except Exception:
            pass
    if sheet_name and "tab_name" not in request_data:
        request_data["tab_name"] = sheet_name
    return await HraiService.upload_excel(file.filename, file_bytes, request_data, db)


@router.delete("/sheets/{tab_id}")
async def delete_sheet(
    tab_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    return await HraiService.delete_sheet(tab_id, db)


@router.get("/settings")
@router.get("/settings/")
async def get_settings_route(current_user = Depends(auth.get_current_user)):
    return HraiService.get_settings_data()


@router.post("/settings")
@router.post("/settings/")
async def save_settings_route(
    data: Optional[dict] = Body(default={}),
    current_user = Depends(auth.get_current_user)
):
    req_data = data or {}
    api_key = req_data.get("api_key", "")
    model = req_data.get("model") or req_data.get("model_id") or "gemini-3.1-flash-lite"
    return HraiService.save_settings_data(api_key, model)


@router.post("/settings/test-single")
@router.post("/settings/test-single/")
@router.post("/settings/test-key")
@router.post("/settings/test-key/")
async def test_single_key_route(
    data: Optional[dict] = Body(default={}),
    current_user = Depends(auth.get_current_user)
):
    req_data = data or {}
    api_key = req_data.get("api_key", "")
    model_id = req_data.get("model_id") or req_data.get("model") or "gemini-3.1-flash-lite"
    return HraiService.test_single_key_data(api_key, model_id)
