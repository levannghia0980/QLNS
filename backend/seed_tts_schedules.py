import os
import sys
from datetime import date, datetime
from database import SessionLocal
import models
import auth

db = SessionLocal()

# Ensure 21 TTS exist and have realistic assignments
tts_samples = [
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

print("Seeding interns & accounts...")
for code, name, gender, role, project, email, phone, hometown in tts_samples:
    user = db.query(models.User).filter(models.User.employee_code == code).first()
    if not user:
        user = models.User(
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
        db.add(user)
        db.flush()
    else:
        user.full_name = name
        user.gender = gender
        user.position = role
        user.project = project
        user.viettel_email = email
        user.phone = phone
        user.hometown = hometown
        user.user_type = "intern"

    # Ensure account exists
    acc = db.query(models.Account).filter(models.Account.user_id == user.id).first()
    if not acc:
        acc = models.Account(
            user_id=user.id,
            username=code.lower(),
            password=auth.hash_password("123456")
        )
        db.add(acc)

db.commit()

# Ensure Schedule Periods for Month 7/2026, 8/2026, 9/2026
for m in [7, 8, 9]:
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

# Seed realistic schedules for Month 8/2026
p8 = db.query(models.SchedulePeriod).filter(
    models.SchedulePeriod.month == 8,
    models.SchedulePeriod.year == 2026
).first()

intern_users = db.query(models.User).filter(models.User.user_type == "intern").all()
shift_options = ["S", "C", "SC", "S", "SC", "C"]

count = 0
for u_idx, u in enumerate(intern_users):
    for day in range(1, 32):
        w_date = date(2026, 8, day)
        # Skip Sunday
        if w_date.weekday() == 6:
            continue
        existing_s = db.query(models.Schedule).filter(
            models.Schedule.user_id == u.id,
            models.Schedule.work_day == w_date
        ).first()

        shift_choice = shift_options[(u_idx + day) % len(shift_options)]
        if not existing_s:
            s = models.Schedule(
                period_id=p8.id,
                user_id=u.id,
                work_day=w_date,
                shift=shift_choice
            )
            db.add(s)
            count += 1

db.commit()
db.close()
print(f"[OK] Seeded/Updated 21 Interns and {count} Schedule Shifts for Month 8/2026!")
