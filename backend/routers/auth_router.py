import json
import os
import urllib.request
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
import models, schemas, auth
from services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])

OAUTH_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "google_oauth.json")


def get_oauth_info():
    if not os.path.exists(OAUTH_CONFIG_PATH):
        return {}
    try:
        with open(OAUTH_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    return AuthService.login(req, db)


@router.post("/change-password")
def change_password(
    req: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return AuthService.change_password(req, current_user, db)


# ─── GOOGLE OAUTH2 AUTHORIZATION FOR ADMIN ────────────────────────────────────

@router.get("/google/status")
def google_status():
    info = get_oauth_info()
    connected = bool(info.get("access_token") or info.get("refresh_token"))
    return {
        "connected": connected,
        "email": info.get("email"),
        "client_id": info.get("client_id"),
        "client_secret": info.get("client_secret")
    }


@router.post("/google/config")
def save_google_oauth_config(data: dict, _: models.User = Depends(auth.require_admin)):
    client_id = data.get("client_id", "").strip()
    client_secret = data.get("client_secret", "").strip()

    if not client_id:
        raise HTTPException(status_code=400, detail="Vui lòng nhập Client ID!")

    cfg_dir = os.path.join(os.path.dirname(__file__), "..", "config")
    os.makedirs(cfg_dir, exist_ok=True)
    
    info = get_oauth_info()
    info["client_id"] = client_id
    if client_secret:
        info["client_secret"] = client_secret

    with open(OAUTH_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(info, f, indent=2)

    return {"success": True, "message": "Đã lưu Google OAuth Client ID & Secret thành công!"}


@router.get("/google/login")
def google_login(client_id: str = Query(None)):
    info = get_oauth_info()
    effective_client_id = client_id or info.get("client_id")

    if not effective_client_id:
        raise HTTPException(
            status_code=400, 
            detail="Chưa cấu hình Google Client ID! Vui lòng nhập Client ID từ Google Cloud Console."
        )

    redirect_uri = "http://localhost:8000/auth/google/callback"
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email"
    ]
    
    params = {
        "client_id": effective_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "prompt": "consent"
    }

    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"auth_url": url}


@router.get("/google/callback")
def google_callback(code: str = Query(None), error: str = Query(None)):
    if error or not code:
        return RedirectResponse(url="/?google_error=" + (error or "no_code"))

    info = get_oauth_info()
    client_id = info.get("client_id") or ""
    client_secret = info.get("client_secret") or ""
    redirect_uri = "http://localhost:8000/auth/google/callback"

    # Exchange code for token
    token_url = "https://oauth2.googleapis.com/token"
    payload = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }).encode("utf-8")

    req = urllib.request.Request(token_url, data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
    
    try:
        with urllib.request.urlopen(req) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")

        # Fetch email from Google userinfo API
        email = "Google Admin"
        if access_token:
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            u_req = urllib.request.Request(userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
            try:
                with urllib.request.urlopen(u_req) as u_resp:
                    u_data = json.loads(u_resp.read().decode("utf-8"))
                    email = u_data.get("email", email)
            except Exception:
                pass

        cfg_dir = os.path.join(os.path.dirname(__file__), "..", "config")
        os.makedirs(cfg_dir, exist_ok=True)
        
        info.update({
            "access_token": access_token,
            "refresh_token": refresh_token or info.get("refresh_token"),
            "email": email
        })

        with open(OAUTH_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2)

        response = RedirectResponse(url="/?google_connected=true")
        response.set_cookie(key="google_oauth_token", value=access_token, httponly=True, max_age=86400, samesite="lax")
        return response

    except Exception as e:
        return RedirectResponse(url="/?google_error=" + urllib.parse.quote(str(e)))


@router.post("/google/disconnect")
def google_disconnect(response: Response, _: models.User = Depends(auth.require_admin)):
    if os.path.exists(OAUTH_CONFIG_PATH):
        try:
            os.remove(OAUTH_CONFIG_PATH)
        except Exception:
            pass
    response.delete_cookie("google_oauth_token")
    return {"success": True, "message": "Đã hủy kết nối Google OAuth2."}
