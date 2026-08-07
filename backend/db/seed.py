"""
Database Seed & Initial Migration Module.
Ensures essential schema defaults, positions, admin, and initial data exist in the database.
All runtime operations remain 100% dynamic via SQLAlchemy ORM.
"""
from datetime import date, datetime
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models import Position, User, Account, SchedulePeriod, Schedule
import auth

# ─── Positions seed data ──────────────────────────────────────────────────────
DEFAULT_POSITIONS = [
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

INITIAL_TTS_DATA = [
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


def init_db_defaults():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # 1. Seed Positions if empty
        for p in DEFAULT_POSITIONS:
            existing = db.query(Position).filter(Position.name == p["name"]).first()
            if not existing:
                db.add(Position(**p))
        db.commit()

        # 2. Seed Admin account if missing
        admin_user = db.query(User).filter(User.employee_code == "admin").first()
        if not admin_user:
            admin_user = User(
                employee_code="admin",
                full_name="Quản trị viên",
                role="admin",
                user_type="admin",
                account_status=1,
            )
            db.add(admin_user)
            db.flush()

            admin_acc = Account(
                user_id=admin_user.id,
                username="admin",
                password=auth.hash_password("Admin@123")
            )
            db.add(admin_acc)
            db.commit()

        # 3. Seed Interns if missing
        for code, name, gender, role, project, email, phone, hometown in INITIAL_TTS_DATA:
            u = db.query(User).filter(User.employee_code == code).first()
            if not u:
                u = User(
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

                acc = Account(
                    user_id=u.id,
                    username=code.lower(),
                    password=auth.hash_password("123456")
                )
                db.add(acc)
            else:
                u.full_name = name
                u.gender = gender
                u.position = role
                u.project = project
                u.viettel_email = email
                u.phone = phone
                u.hometown = hometown
                u.user_type = "intern"
        db.commit()

        # 4. Seed Schedule Periods for months 7..12
        for m in [7, 8, 9, 10, 11, 12]:
            p = db.query(SchedulePeriod).filter(
                SchedulePeriod.month == m,
                SchedulePeriod.year == 2026
            ).first()
            if not p:
                p = SchedulePeriod(
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

        # 5. Seed detailed schedule shifts for Month 8/2026 if not already present
        p8 = db.query(SchedulePeriod).filter(
            SchedulePeriod.month == 8,
            SchedulePeriod.year == 2026
        ).first()

        intern_users = db.query(User).filter(User.user_type == "intern").all()
        shift_options = ["S", "C", "SC", "S", "SC", "C"]

        for u_idx, u in enumerate(intern_users):
            for day in range(1, 32):
                w_date = date(2026, 8, day)
                if w_date.weekday() == 6:  # Skip Sunday
                    continue
                existing_s = db.query(Schedule).filter(
                    Schedule.user_id == u.id,
                    Schedule.work_day == w_date
                ).first()
                if not existing_s:
                    shift_choice = shift_options[(u_idx + day) % len(shift_options)]
                    s = Schedule(
                        period_id=p8.id,
                        user_id=u.id,
                        work_day=w_date,
                        shift=shift_choice
                    )
                    db.add(s)

        db.commit()
    finally:
        db.close()
