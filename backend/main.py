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

from db.seed import init_db_defaults

# ── Dynamic Database Initialization & ORM Schema Sync ────────────────────────
init_db_defaults()

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

