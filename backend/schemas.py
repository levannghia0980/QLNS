from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime


# ─── Auth ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_type: str          # intern / employee
    full_name: str
    user_id: int


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class AdminResetPasswordRequest(BaseModel):
    new_password: str


# ─── Position ─────────────────────────────────────────────────────────────────
class PositionResponse(BaseModel):
    id: int
    name: str
    is_manager: bool

    class Config:
        from_attributes = True


# ─── User (shared base) ───────────────────────────────────────────────────────
class UserBase(BaseModel):
    employee_code: str
    full_name: str
    role: Optional[str] = "user"
    user_type: Optional[str] = "intern"
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    viettel_email: Optional[str] = None
    birthday: Optional[date] = None
    hometown: Optional[str] = None
    phone: Optional[str] = None
    cccd: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    project: Optional[str] = None
    position: Optional[str] = None
    position_id: Optional[int] = None
    join_date: Optional[date] = None
    allowance: Optional[str] = "Không"
    employee_type: Optional[str] = "TTS Trung tâm"
    working_status: Optional[str] = "Working"
    employment_type: Optional[str] = "Fulltime"
    account_status: Optional[int] = 1

    # Employee-only
    direct_manager: Optional[str] = None
    computer_serial: Optional[str] = None
    employment_status: Optional[str] = "Thử việc"
    use_company_mac: Optional[str] = "Không"
    staff_category: Optional[str] = "NS trung tâm"
    seat_position: Optional[str] = None
    borrow_end_date: Optional[date] = None
    borrow_project: Optional[str] = None
    borrow_pm: Optional[str] = None
    borrow_center: Optional[str] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    user_type: Optional[str] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    viettel_email: Optional[str] = None
    birthday: Optional[date] = None
    hometown: Optional[str] = None
    phone: Optional[str] = None
    cccd: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    project: Optional[str] = None
    position: Optional[str] = None
    position_id: Optional[int] = None
    join_date: Optional[date] = None
    allowance: Optional[str] = None
    employee_type: Optional[str] = None
    working_status: Optional[str] = None
    employment_type: Optional[str] = None
    account_status: Optional[int] = None
    direct_manager: Optional[str] = None
    computer_serial: Optional[str] = None
    employment_status: Optional[str] = None
    use_company_mac: Optional[str] = None
    staff_category: Optional[str] = None
    seat_position: Optional[str] = None
    borrow_end_date: Optional[date] = None
    borrow_project: Optional[str] = None
    borrow_pm: Optional[str] = None
    borrow_center: Optional[str] = None


class UserResponse(UserBase):
    id: int
    created_at: Optional[datetime] = None
    position_name: Optional[str] = None  # Tên vị trí (joined)

    class Config:
        from_attributes = True


# ─── Employee ─────────────────────────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    """Schema tạo nhân viên mới – defaults phù hợp với employee"""
    employee_code: str
    full_name: str
    role: Optional[str] = "user"
    user_type: Optional[str] = "employee"
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    viettel_email: Optional[str] = None
    birthday: Optional[date] = None
    hometown: Optional[str] = None
    phone: Optional[str] = None
    cccd: Optional[str] = None
    bank_name: Optional[str] = "Viettel Money"
    bank_account: Optional[str] = None
    project: Optional[str] = None
    position: Optional[str] = None
    position_id: Optional[int] = None
    join_date: Optional[date] = None
    direct_manager: Optional[str] = None
    computer_serial: Optional[str] = None
    employment_status: Optional[str] = "Thử việc"
    use_company_mac: Optional[str] = "Không"
    staff_category: Optional[str] = "NS trung tâm"
    seat_position: Optional[str] = None
    borrow_end_date: Optional[date] = None
    borrow_project: Optional[str] = None
    borrow_pm: Optional[str] = None
    borrow_center: Optional[str] = None
    account_status: Optional[int] = 1


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    viettel_email: Optional[str] = None
    birthday: Optional[date] = None
    hometown: Optional[str] = None
    phone: Optional[str] = None
    cccd: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    project: Optional[str] = None
    position: Optional[str] = None
    position_id: Optional[int] = None
    join_date: Optional[date] = None
    direct_manager: Optional[str] = None
    computer_serial: Optional[str] = None
    employment_status: Optional[str] = None
    use_company_mac: Optional[str] = None
    staff_category: Optional[str] = None
    seat_position: Optional[str] = None
    borrow_end_date: Optional[date] = None
    borrow_project: Optional[str] = None
    borrow_pm: Optional[str] = None
    borrow_center: Optional[str] = None
    account_status: Optional[int] = None


class EmployeeResponse(BaseModel):
    id: int
    employee_code: str
    full_name: str
    role: str
    user_type: str
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    viettel_email: Optional[str] = None
    birthday: Optional[date] = None
    hometown: Optional[str] = None
    phone: Optional[str] = None
    cccd: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    project: Optional[str] = None
    position: Optional[str] = None
    position_id: Optional[int] = None
    position_name: Optional[str] = None
    join_date: Optional[date] = None
    direct_manager: Optional[str] = None
    computer_serial: Optional[str] = None
    employment_status: Optional[str] = None
    use_company_mac: Optional[str] = None
    staff_category: Optional[str] = None
    seat_position: Optional[str] = None
    borrow_end_date: Optional[date] = None
    borrow_project: Optional[str] = None
    borrow_pm: Optional[str] = None
    borrow_center: Optional[str] = None
    account_status: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmployeeImportResult(BaseModel):
    success: int
    skipped: int
    renamed: List[dict]  # [{"original": "nv_luongtd", "actual": "nv_luongtd1"}]
    message: str


class ManagerResponse(BaseModel):
    id: int
    full_name: str
    username: Optional[str] = None
    position_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Schedule Period ──────────────────────────────────────────────────────────
class PeriodCreate(BaseModel):
    month: int
    year: int
    open_date: Optional[datetime] = None
    close_date: Optional[datetime] = None
    status: Optional[str] = "closed"


class PeriodUpdate(BaseModel):
    open_date: Optional[datetime] = None
    close_date: Optional[datetime] = None
    status: Optional[str] = None


class PeriodResponse(BaseModel):
    id: int
    month: int
    year: int
    open_date: Optional[datetime] = None
    close_date: Optional[datetime] = None
    status: str

    class Config:
        from_attributes = True


# ─── Schedule ─────────────────────────────────────────────────────────────────
class ScheduleEntry(BaseModel):
    work_day: date
    shift: Optional[str] = None  # S / C / SC / None


class ScheduleSubmit(BaseModel):
    period_id: int
    entries: List[ScheduleEntry]


class ScheduleResponse(BaseModel):
    id: int
    period_id: int
    user_id: int
    work_day: date
    shift: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminScheduleRow(BaseModel):
    user_id: int
    employee_code: str
    full_name: str
    schedules: List[ScheduleResponse]

    class Config:
        from_attributes = True


# ─── Account ──────────────────────────────────────────────────────────────────
class AccountResponse(BaseModel):
    id: int
    user_id: int
    username: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminAccountRow(BaseModel):
    user_id: int
    employee_code: str
    full_name: str
    username: Optional[str] = None
    account_status: int

    class Config:
        from_attributes = True


# ─── Schedule ─────────────────────────────────────────────────────────────────
class SchedulePeriodResponse(BaseModel):
    id: int
    month: int
    year: int
    status: str
    open_date: Optional[datetime] = None
    close_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class SchedulePeriodOpen(BaseModel):
    month: int
    year: int
    close_date: Optional[datetime] = None


class ScheduleRegistrationItem(BaseModel):
    work_day: date
    shift: str  # S / C / SC


class ScheduleRegistration(BaseModel):
    items: List[ScheduleRegistrationItem]


class ScheduleResponse(BaseModel):
    id: int
    work_day: date
    shift: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Overtime ─────────────────────────────────────────────────────────────────
class OvertimePreviewRequest(BaseModel):
    work_date: date
    start_time: str
    end_time: str
    is_holiday: bool = False


class OvertimeCreate(BaseModel):
    work_date: date
    start_time: str          # "HH:MM"
    end_time: str            # "HH:MM"
    is_holiday: bool = False # True nếu ngày lễ
    reason: Optional[str] = None


class OvertimeUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_holiday: Optional[bool] = None
    reason: Optional[str] = None


class OvertimeApprove(BaseModel):
    reject_reason: Optional[str] = None   # chỉ cần khi reject


class OvertimeApproveSelected(BaseModel):
    ids: List[int]


class OvertimeResponse(BaseModel):
    id: int
    user_id: int
    employee_code: Optional[str] = None
    full_name: Optional[str] = None
    project: Optional[str] = None
    work_date: date
    start_time: str
    end_time: str
    raw_hours: float
    factor: float
    weighted_hours: float
    reason: Optional[str] = None
    status: str
    reject_reason: Optional[str] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OvertimeStatsResponse(BaseModel):
    month: int
    year: int
    total_raw_hours: float
    total_weighted_hours: float
    pending_count: int
    approved_count: int
    rejected_count: int


class OvertimeSummaryCell(BaseModel):
    ot_id: int
    start_time: str
    end_time: str
    raw_hours: float
    factor: float
    weighted_hours: float
    reason: Optional[str] = None
    status: str


class OvertimeSummaryRow(BaseModel):
    user_id: int
    employee_code: str
    full_name: str
    project: Optional[str] = None
    days: dict  # {day_number: List[OvertimeSummaryCell]}
    total_by_factor: dict  # {"1.5": hours, "2.0": hours, ...}
    total_raw: float
    total_weighted: float


# ─── HrAi Schemas ─────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    """Request body cho POST /api/hrai/chat."""
    question: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Response body — luôn chứa text + display type + data thật."""
    text: str
    display: str = "text"  # card | table | bar_chart | line_chart | list | text
    data: Optional[List[dict]] = None
    sql: Optional[str] = None
    metadata: dict = {}


class RunSQLRequest(BaseModel):
    """Request body cho POST /api/hrai/chat/run_sql."""
    sql: str


class ExportExcelRequest(BaseModel):
    """Request body cho POST /api/chat/export-excel."""
    title: Optional[str] = "Báo cáo HrAi"
    sql: Optional[str] = None
    data: Optional[List[dict]] = None


class PreprocessedInput(BaseModel):
    original: str
    normalized_text: str
    resolved_time: Optional[dict] = None
    resolved_numbers: Optional[dict] = None
    resolved_entities: Optional[dict] = None


class LLMResponse(BaseModel):
    question_type: str
    sql: str
    explanation: str
    display: str = "table"
    special_table: Optional[str] = None
    special_columns: Optional[List[str]] = None

