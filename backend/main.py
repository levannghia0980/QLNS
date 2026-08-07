from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import models
from database import engine, SessionLocal
import auth
import os

# Create tables (including new ones)
models.Base.metadata.create_all(bind=engine)

# ─── Positions seed data ──────────────────────────────────────────────────────
POSITIONS = [
    {"name": "Trợ lý dự án",  "is_manager": False},
    {"name": "PM",             "is_manager": True},
    {"name": "DU Lead",        "is_manager": True},
    {"name": "GDTT",           "is_manager": True},
    {"name": "PGDTT",          "is_manager": True},
    {"name": "Dev",            "is_manager": False},
    {"name": "Dev Lead",       "is_manager": True},
    {"name": "Dev Mobile",     "is_manager": False},
    {"name": "DevOps",         "is_manager": False},
    {"name": "Tester",         "is_manager": False},
    {"name": "Test Lead",      "is_manager": True},
    {"name": "BA",             "is_manager": False},
    {"name": "BA Lead",        "is_manager": True},
    {"name": "QA",             "is_manager": False},
    {"name": "DA",             "is_manager": False},
    {"name": "AI",             "is_manager": False},
]


def seed_positions():
    db = SessionLocal()
    try:
        for p in POSITIONS:
            existing = db.query(models.Position).filter(models.Position.name == p["name"]).first()
            if not existing:
                db.add(models.Position(**p))
        db.commit()
        print("[OK] Positions seeded")
    finally:
        db.close()


def seed_admin():
    db = SessionLocal()
    try:
        # ── Migration: rename role 'intern' → 'user' ──
        old_interns = db.query(models.User).filter(models.User.role == "intern").all()
        for u in old_interns:
            u.role = "user"
            if not u.user_type:
                u.user_type = "intern"
        if old_interns:
            db.commit()
            print(f"[OK] Migrated {len(old_interns)} intern role(s) → user")

        # ── Ensure admin account exists ──
        existing = db.query(models.User).filter(models.User.employee_code == "admin").first()
        if not existing:
            admin_user = models.User(
                employee_code="admin",
                full_name="Quản trị viên",
                role="admin",
                user_type="admin",
                account_status=1,
            )
            db.add(admin_user)
            db.flush()

            admin_acc = models.Account(
                user_id=admin_user.id,
                username="admin",
                password=auth.hash_password("Admin@123")
            )
            db.add(admin_acc)
            db.commit()
            print("[OK] Admin account created: admin / Admin@123")
    finally:
        db.close()


def seed_interns_and_schedules():
    """Tự động đảm bảo dữ liệu 21 TTS và Bảng lịch làm việc theo tháng luôn có trong DB, không bao giờ mất."""
    db = SessionLocal()
    try:
        from datetime import date, datetime

        tts_list = [
            ("TTS1", "Nguyễn Anh Vũ", "Nam", "Dev", "Visa, BTTM", "vuna@viettel.com.vn", "0981112233", "Hà Nội"),
            ("TTS2", "Đặng Quang Vinh", "Nam", "Dev Mobile", "Tàu cá", "vinhdq@viettel.com.vn", "0982223344", "Hải Phòng"),
            ("TTS3", "Vũ Văn Hoàng", "Nam", "Tester", "(QP45) CDS05_BTTM", "hoangvv@viettel.com.vn", "0983334455", "Nam Định"),
            ("TTS4", "Đỗ Thị Ngọc Yến", "Nữ", "BA", "TCS.VCM.QLHĐ", "yennd@viettel.com.vn", "0984445566", "Bắc Ninh"),
            ("TTS5", "Vũ Anh Đức", "Nam", "Dev", "BU03.VDS.TTDL", "ducva@viettel.com.vn", "0985556677", "Hà Nam"),
            ("TTS6", "Trần Thị Mai", "Nữ", "Tester", "ViettelPay Pro", "maitt@viettel.com.vn", "0986667788", "Thái Bình"),
            ("TTS7", "Lê Văn Hùng", "Nam", "DevOps", "Cloud VDS", "hunglv@viettel.com.vn", "0987778899", "Thanh Hóa"),
            ("TTS8", "Phạm Quốc Bảo", "Nam", "AI", "AI Camera Viettel", "baopq@viettel.com.vn", "0988889900", "Nghệ An"),
            ("TTS9", "Nguyễn Thu Trang", "Nữ", "BA", "VCS Core Banking", "trangnt@viettel.com.vn", "0989990011", "Hà Nội"),
            ("TTS10", "Hoàng Minh Tuấn", "Nam", "Dev", "Smart City", "tuanhm@viettel.com.vn", "0971112233", "Quảng Ninh"),
            ("TTS11", "Đoàn Hải Nam", "Nam", "Dev", "SuperApp MyViettel", "namdh@viettel.com.vn", "0972223344", "Hải Dương"),
            ("TTS12", "Bùi Lan Hương", "Nữ", "Tester", "Billing BCCS", "huongbl@viettel.com.vn", "0973334455", "Phú Thọ"),
            ("TTS13", "Dương Văn Khang", "Nam", "Dev Mobile", "Viettel Money iOS", "khangdv@viettel.com.vn", "0974445566", "Vĩnh Phúc"),
            ("TTS14", "Ngô Đức Trọng", "Nam", "Dev", "VDS Data Lake", "trongnd@viettel.com.vn", "0975556677", "Ninh Bình"),
            ("TTS15", "Trịnh Thùy Linh", "Nữ", "BA", "Omnichannel", "linhtt@viettel.com.vn", "0976667788", "Hà Nội"),
            ("TTS16", "Lý Gia Huy", "Nam", "Dev", "Core Switch", "huygl@viettel.com.vn", "0977778899", "Đà Nẵng"),
            ("TTS17", "Chu Phương Thảo", "Nữ", "Tester", "Microservices Platform", "thaocp@viettel.com.vn", "0978889900", "Huế"),
            ("TTS18", "Tạ Quang Dũng", "Nam", "DevOps", "Kubernetes Mesh", "dungtq@viettel.com.vn", "0979990011", "TP.HCM"),
            ("TTS19", "Vương Thúy Nga", "Nữ", "BA", "Payment Gateway", "ngavt@viettel.com.vn", "0961112233", "Cần Thơ"),
            ("TTS20", "Cao Tiến Đạt", "Nam", "Dev", "Security Gateway", "datct@viettel.com.vn", "0962223344", "Bình Dương"),
            ("TTS21", "Lương Mỹ Duyên", "Nữ", "Tester", "Fraud Detection AI", "duyenlm@viettel.com.vn", "0963334455", "Hà Nội"),
        ]

        for code, name, gender, role, project, email, phone, hometown in tts_list:
            u = db.query(models.User).filter(models.User.employee_code == code).first()
            if not u:
                u = models.User(
                    employee_code=code,
                    full_name=name,
                    role="user",
                    user_type="intern",
                    gender=gender,
                    ethnicity="Kinh",
                    viettel_email=email,
                    phone=phone,
                    hometown=hometown,
                    bank_name="Viettel Money",
                    bank_account="0988" + code.replace("TTS", "").zfill(6),
                    project=project,
                    position=role,
                    allowance="Có",
                    employee_type="TTS Trung tâm",
                    working_status="Working",
                    employment_type="Fulltime",
                    account_status=1,
                )
                db.add(u)
                db.flush()

                acc = models.Account(
                    user_id=u.id,
                    username=code.lower(),
                    password=auth.hash_password("123456")
                )
                db.add(acc)
            else:
                # Đảm bảo role & project luôn được cập nhật chuẩn
                u.full_name = name
                u.gender = gender
                u.position = role
                u.project = project
                u.viettel_email = email
                u.phone = phone
                u.hometown = hometown
                u.user_type = "intern"

        db.commit()

        # Đảm bảo các kỳ SchedulePeriod (Tháng 7, 8, 9/2026) luôn mở
        for m in [7, 8, 9, 10, 11, 12]:
            p = db.query(models.SchedulePeriod).filter(
                models.SchedulePeriod.month == m,
                models.SchedulePeriod.year == 2026
            ).first()
            if not p:
                p = models.SchedulePeriod(
                    month=m,
                    year=2026,
                    status="open",
                    open_date=datetime(2026, m, 1),
                    close_date=datetime(2026, m, 28)
                )
                db.add(p)
            else:
                p.status = "open"
        db.commit()

        # Đảm bảo các ca trực chi tiết cho Tháng 8/2026 luôn đầy đủ
        p8 = db.query(models.SchedulePeriod).filter(
            models.SchedulePeriod.month == 8,
            models.SchedulePeriod.year == 2026
        ).first()

        intern_users = db.query(models.User).filter(models.User.user_type == "intern").all()
        shift_options = ["S", "C", "SC", "S", "SC", "C"]

        for u_idx, u in enumerate(intern_users):
            for day in range(1, 32):
                w_date = date(2026, 8, day)
                if w_date.weekday() == 6:  # Bỏ qua Chủ nhật
                    continue
                existing_s = db.query(models.Schedule).filter(
                    models.Schedule.user_id == u.id,
                    models.Schedule.work_day == w_date
                ).first()

                if not existing_s:
                    shift_choice = shift_options[(u_idx + day) % len(shift_options)]
                    s = models.Schedule(
                        period_id=p8.id,
                        user_id=u.id,
                        work_day=w_date,
                        shift=shift_choice
                    )
                    db.add(s)

        db.commit()
        print("[OK] Interns & Schedule Matrix permanently seeded in DB")
    except Exception as e:
        print("[WARN] Seeding interns & schedules failed:", e)
    finally:
        db.close()


seed_positions()
seed_admin()
seed_interns_and_schedules()

app = FastAPI(title="Intern & Employee Management API", version="2.0.0")

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    print("========================================")
    print("VALIDATION ERROR: ", exc.errors())
    print("REQUEST BODY: ", body)
    print("HEADERS: ", request.headers)
    print("========================================")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Modular Routers (Admin, Employee, Intern, Auth, AI HR, Google) ───────────
from routers.auth_router import router as auth_router
from routers.admin.admin_employees_router import router as admin_employees_router
from routers.admin.admin_overtime_router import router as admin_overtime_router
from routers.employee.employee_profile_router import router as employee_profile_router
from routers.employee.employee_overtime_router import router as employee_overtime_router
from routers.intern.intern_schedule_router import router as intern_schedule_router
from routers.hrai_router import router as hrai_router
from routers.google_router import router as google_router

app.include_router(auth_router)
app.include_router(admin_employees_router)
app.include_router(admin_overtime_router)
app.include_router(employee_profile_router)
app.include_router(employee_overtime_router)
app.include_router(intern_schedule_router)
app.include_router(hrai_router)
app.include_router(hrai_router, prefix="/api")
app.include_router(google_router)


# Serve frontend (React App)
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
dist_dir = os.path.join(frontend_dir, "dist")

if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")
    if os.path.exists(os.path.join(frontend_dir, "static")):
        app.mount("/static", StaticFiles(directory=os.path.join(frontend_dir, "static")), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(dist_dir, "index.html"))

    @app.get("/{path:path}")
    def serve_spa(path: str):
        fp = os.path.join(dist_dir, path)
        if os.path.exists(fp):
            return FileResponse(fp)
        return FileResponse(os.path.join(dist_dir, "index.html"))
elif os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_dir, "static")), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

    @app.get("/{path:path}")
    def serve_spa(path: str):
        fp = os.path.join(frontend_dir, path)
        if os.path.exists(fp):
            return FileResponse(fp)
        return FileResponse(os.path.join(frontend_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    reload_mode = os.getenv("RELOAD", "false").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=reload_mode)

