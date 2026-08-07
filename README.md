# HỆ THỐNG QUẢN LÝ NHÂN SỰ & TRỢ LÝ AI HR (QLNS / HrAi) — VIETTEL SOFTWARE

> **Hệ thống Quản lý Nhân sự & Thực tập sinh Thông minh** tích hợp Trợ lý AI HR (HrAi), tự động hóa truy vấn CSDL bằng ngôn ngữ tự nhiên, tự động tạo tập tin Google Sheet (.g-sheet) qua Google Drive API, xuất báo cáo File Excel (.xlsx) và đồng bộ dữ liệu 2 chiều.

---

## 🌟 Mô Tả Chi Tiết Dự Án

Dự án **QLNS (Internship Manager & AI HR Assistant)** được xây dựng phục vụ quản lý nhân sự, thực tập sinh, theo dõi lịch làm việc, đăng ký Overtime (OT), đồng thời tích hợp trí tuệ nhân tạo (AI) giúp tối ưu hóa công tác quản lý HR tại Viettel Software.

### 🚀 Các Tính Năng Nổi Bật:

1. **Quản Lý Nhân Sự & Thực Tập Sinh**:
   - Quản lý danh sách nhân sự, phân loại vị trí (Dev, AI, BA, Admin...), phòng ban, dự án.
   - Quản lý trạng thái làm việc (Đang làm việc, Thử việc, Nghỉ việc).
   - Phân quyền người dùng đa cấp (`Admin`, `Employee`, `Intern`).

2. **Quản Lý Lịch Làm Việc & Đăng Ký OT**:
   - Đăng ký ca làm việc theo tuần/tháng, tổng hợp số buổi làm việc thực tế.
   - Đăng ký và xét duyệt yêu cầu làm thêm giờ (Overtime / OT) dành cho nhân viên & thực tập sinh.

3. **Trợ Lý AI HR Thông Minh (HrAi Assistant)**:
   - **Truy vấn bằng ngôn ngữ tự nhiên**: Hỏi đáp trực tiếp về số lượng nhân sự, nhân viên cùng ngày sinh, danh sách OT, lịch làm việc...
   - **Đề xuất CSDL Bảng mới theo 3 Kịch bản (3 Scenarios)**:
     - *Scenario 1*: Dữ liệu có sẵn trong CSDL.
     - *Scenario 2*: Kết hợp cột CSDL (`ma_nv`, `ho_va_ten`) + Cột tùy chỉnh mới (`diem_kpi`, `danh_gia_thang`, `ghi_chu_mentor`).
     - *Scenario 3*: Cấu trúc bảng hoàn toàn mới (`danh_sach_thiet_bi`, `okr_project`).
   - **Cửa sổ Tùy chỉnh Schema Modal (`SchemaCustomizationModal`)**: Cho phép xem trước, thêm/xóa cột, thay đổi kiểu dữ liệu (`TEXT`, `INTEGER`, `REAL`, `DATE`) trước khi khởi tạo CSDL.
   - **Tự động tạo Google Sheet (.g-sheet)**: Tự động gọi Google Drive API tạo mới file Google Sheet trực tuyến định dạng chuẩn giao diện Viettel (tiêu đề nền đỏ/xám, in đậm).
   - **Xuất File Excel (.xlsx)**: Xuất báo cáo Excel với màu sắc tiêu đề và viền bảng được định dạng chuyên nghiệp.
   - **Đồng bộ Google Sheet 2 chiều**: Kết nối và đồng bộ dữ liệu từ Google Sheets vào CSDL hệ thống.

---

## 🔑 Hướng Dẫn Lấy API Key & Cấu Hình Google API

### 1. Hướng Dẫn Lấy Gemini API Key (AI Chat & Planner Engine)
1. Truy cập trang **[Google AI Studio](https://aistudio.google.com/app/apikey)** và đăng nhập bằng tài khoản Google.
2. Nhấn nút **Create API key** (Tạo API Key mới).
3. Copy đoạn mã API Key (dạng `AIzaSy...`).
4. Dán API Key vào file `backend/.env` tại biến `GEMINI_API_KEY=AIzaSy...` (hoặc nhập trực tiếp tại giao diện Cấu hình AI HR trên Web App).

---

### 2. Hướng Dẫn Cấu Hình Google Sheets API & Google Drive API (Tùy chọn cho tính năng Google Sheet)

Để sử dụng tính năng **Tự động tạo Google Sheet (.g-sheet)** và **Đồng bộ 2 chiều**:

#### Cách 1: Sử Dụng Service Account (Khuyên Dùng)
1. Truy cập **[Google Cloud Console](https://console.cloud.google.com/)** -> Tạo một Project mới.
2. Vào **APIs & Services > Library** -> Tìm và Bật 2 API:
   - **Google Sheets API**
   - **Google Drive API**
3. Vào **APIs & Services > Credentials** -> Nhấn **Create Credentials > Service Account**.
4. Tạo Service Account và tạo một **Key dạng JSON**.
5. Tải file JSON về, đổi tên thành `google_credentials.json` và lưu vào thư mục `backend/config/google_credentials.json`.

#### Cách 2: Sử Dụng OAuth 2.0 Client ID (Đăng nhập Google trực tiếp trên Web)
1. Trong Google Cloud Console, vào **OAuth consent screen** -> Điền tên ứng dụng và email hỗ trợ.
2. Vào **Credentials > Create Credentials > OAuth client ID** -> Chọn **Web application**.
3. Thêm URI điều hướng: `http://localhost:8000/auth/google/callback`.
4. Tải file JSON cấu hình OAuth về, đổi tên thành `google_oauth.json` và lưu vào `backend/config/google_oauth.json` (hoặc nhập Client ID & Client Secret tại tab Cấu Hình trên Web App).

---

## 🛠️ Tổng Hợp Thư Viện Cần Cài Đặt

### 1. Backend (Python Dependencies)

| Tên Thư Viện | Phiên Bản | Mục Đích Sử Dụng |
| :--- | :--- | :--- |
| `fastapi` | `>=0.115.0` | Framework xây dựng RESTful API hiệu năng cao |
| `uvicorn` | `>=0.30.0` | ASGI Server chạy ứng dụng FastAPI |
| `sqlalchemy` | `>=2.0.31` | ORM quản lý cơ sở dữ liệu SQLite/PostgreSQL |
| `aiosqlite` | `>=0.20.0` | Driver kết nối bất đồng bộ (asyncio) với SQLite |
| `pydantic` | `>=2.9.0` | Validate và định nghĩa Data Schema (Request/Response) |
| `python-jose` | `>=3.3.0` | Mã hóa và xác thực Token JWT |
| `bcrypt` | `>=4.0.0` | Mã hóa mật khẩu người dùng |
| `python-multipart` | `>=0.0.9` | Xử lý dữ liệu Upload File / Form-data |
| `google-genai` | `>=1.0.0` | SDK gọi Google Gemini API (Gemini 3.1/3.5 Flash) |
| `google-api-python-client` | `>=2.100.0` | Tích hợp Google Drive API & Google Sheets API |
| `google-auth` | `>=2.0.0` | Xác thực Google OAuth2 |
| `openpyxl` | `>=3.1.5` | Đọc, ghi và định dạng tập tin Excel (.xlsx) |
| `pandas` | `>=2.0.0` | Phân tích và xử lý bảng dữ liệu |
| `chromadb` | Mới nhất | Vector Database cho tìm kiếm ngữ nghĩa RAG |
| `PyMuPDF` | Mới nhất | Đọc và trích xuất dữ liệu từ file PDF |
| `python-docx` | Mới nhất | Xử lý tập tin Word (.docx) |
| `python-dotenv` | `>=1.0.0` | Đọc biến môi trường từ file `.env` |

### 2. Frontend (Node.js / React Dependencies)

| Tên Thư Viện | Phiên Bản | Mục Đích Sử Dụng |
| :--- | :--- | :--- |
| `react` | `^18.2.0` | Thư viện xây dựng UI Component |
| `react-dom` | `^18.2.0` | Render React vào DOM |
| `react-router-dom` | `^6.22.0` | Điều hướng trang (Routing) |
| `axios` | `^1.6.7` | HTTP Client gửi request tới Backend FastAPI |
| `lucide-react` | `^0.344.0` | Bộ Icon giao diện hiện đại |
| `recharts` | `^2.12.0` | Vẽ biểu đồ thống kê nhân sự |
| `vite` | `^5.1.4` | Build tool và Dev server siêu tốc |

---

## ⚙️ Hướng Dẫn Cài Đặt Và Chạy Chương Trình Từ Đầu Đến Cuối

### 📌 Yêu Cầu Tiền Đề (Prerequisites)
- **Python**: Phiên bản `3.10` trở lên.
- **Node.js**: Phiên bản `18.0` trở lên (kèm `npm`).
- **Git**: Đã cài đặt trên máy.

---

### Bước 1: Clone Repository Từ GitHub

Mở Terminal / Command Prompt và chạy lệnh:

```bash
git clone https://github.com/levannghia0980/QLNS.git
cd QLNS
```

---

### Bước 2: Cài Đặt & Cấu Hình Backend (Python FastAPI)

1. **Di chuyển vào thư mục `backend`**:
   ```bash
   cd backend
   ```

2. **Tạo môi trường ảo (Virtual Environment)**:
   - Trên Windows:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   - Trên macOS / Linux:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Cài đặt toàn bộ thư viện Python**:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Tạo file cấu hình môi trường (`.env`)**:
   Sao chép file mẫu `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
   Hoặc tạo file `.env` với nội dung:
   ```env
   DATABASE_URL=sqlite+aiosqlite:///./internship.db
   SECRET_KEY=internship_secret_key_2024_viettel
   GEMINI_API_KEY=AIzaSy_YOUR_GEMINI_API_KEY_HERE
   DEFAULT_MODEL=gemini-3.1-flash-lite
   ```

5. **Khởi chạy Server Backend FastAPI**:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   > 📍 **Backend API Documentation (Swagger UI)** sẽ chạy tại: `http://localhost:8000/docs`

---

### Bước 3: Cài Đặt & Khởi Chạy Frontend (React + Vite)

1. **Mở thêm một cửa sổ Terminal mới và di chuyển vào thư mục `frontend`**:
   ```bash
   cd QLNS/frontend
   ```

2. **Cài đặt toàn bộ thư viện Node.js**:
   ```bash
   npm install
   ```

3. **Khởi chạy Giao diện Frontend (Dev Server)**:
   ```bash
   npm run dev
   ```
   > 📍 **Giao diện Web App** sẽ chạy tại: `http://localhost:5173` (hoặc `http://localhost:3000`)

---

### 🔑 Thông Tin Đăng Nhập Mặc Định

| Loại Tài Khoản | Tên Đăng Nhập (Username) | Mật Khẩu (Password) | Quyền Hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin` | `Admin@123` | Toàn quyền hệ thống |
| **Nhân viên (Employee)** | `anhhchad@viettel.com.vn` | `123456` | Quản lý lịch & truy vấn HR |
| **Thực tập sinh (Intern)** | `tichnv1@viettel.com.vn` | `123456` | Đăng ký lịch, xem báo cáo |

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
QLNS/
├── backend/
│   ├── config/              # Cấu hình Google OAuth & Gemini Keys
│   ├── routers/             # API Routers (auth, employee, schedule, hrai...)
│   ├── services/            # Business Logic & AI Query Engine
│   │   └── hrai/            # Core Engine Trợ lý AI HR (Planner, Pipeline)
│   ├── auth.py              # Xử lý JWT Token & Authentications
│   ├── database.py          # Kết nối CSDL SQLite / SQLAlchemy
│   ├── main.py              # Main Entrypoint của FastAPI Server
│   ├── models.py            # SQLite Database Models
│   ├── schemas.py           # Pydantic Schemas
│   ├── .env.example         # File cấu hình mẫu môi trường Backend
│   ├── requirements.txt     # Danh sách thư viện Python
│   └── internship.db        # Cơ sở dữ liệu SQLite
├── frontend/
│   ├── src/
│   │   ├── components/      # React UI Components (Header, Sidebar, Modals)
│   │   ├── pages/           # React Pages (Dashboard, Interns, AiHrPage...)
│   │   ├── App.jsx          # Component chính
│   │   └── main.jsx         # React Entrypoint
│   ├── package.json         # Danh sách thư viện Node.js
│   └── vite.config.js       # Cấu hình Vite & Proxy API
├── .gitignore               # Cấu hình loại trừ Git
└── README.md                # Tài liệu hướng dẫn dự án chi tiết
```

---

## 🛡️ Giấy Phép & Bản Quyền

Dự án được phát triển phục vụ công tác quản lý nhân sự tại **Viettel Software**. Tất cả bản quyền được bảo lưu.
