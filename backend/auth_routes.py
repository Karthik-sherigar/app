from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
import random
import string
import os
import datetime
import bcrypt
import logging
import httpx
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from services.session_service import SessionLocal, User, VerificationOTP
from shared import session_service

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Configuration for Email OTP
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

class SendOTPRequest(BaseModel):
    email: str

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    otp: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    access_token: str # from React Google Login

class UpdateProfilePictureRequest(BaseModel):
    email: str
    profile_picture: str

def send_email_otp(recipient_email: str, otp_code: str):
    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        logger.error("SMTP credentials not configured!")
        raise Exception("Server SMTP configuration is missing.")

    msg = MIMEText(f"Your KnowledgeGraph AI Verification Code is: {otp_code}\nThis code will expire in 10 minutes.")
    msg['Subject'] = 'KnowledgeGraph AI - Verification OTP'
    msg['From'] = SMTP_EMAIL
    msg['To'] = recipient_email

    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
        server.send_message(msg)
        server.quit()
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise e

# --- ROUTES ---

@auth_router.post("/send-otp")
def send_otp(req: SendOTPRequest):
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == req.email).first()
        if existing_user and existing_user.is_verified == 1:
            raise HTTPException(status_code=400, detail="Account with this email already exists.")

        # Generate 6 digit OTP
        otp_code = ''.join(random.choices(string.digits, k=6))
        
        # Save OTP to database
        expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
        otp_record = VerificationOTP(email=req.email, otp_code=otp_code, expires_at=expires)
        db.add(otp_record)
        db.commit()

        # Send Email
        try:
            send_email_otp(req.email, otp_code)
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to send OTP email. Please verify SMTP settings.")

        return {"message": "OTP sent successfully."}
    finally:
        db.close()


@auth_router.post("/register")
def register(req: RegisterRequest):
    db = SessionLocal()
    try:
        # Validate OTP
        now = datetime.datetime.now(datetime.timezone.utc)
        valid_otp = db.query(VerificationOTP).filter(
            VerificationOTP.email == req.email,
            VerificationOTP.otp_code == req.otp,
            VerificationOTP.expires_at > now
        ).order_by(VerificationOTP.id.desc()).first()

        if not valid_otp:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

        # Check if already registered
        existing_user = db.query(User).filter(User.email == req.email).first()
        if existing_user and existing_user.is_verified == 1:
            raise HTTPException(status_code=400, detail="User already exists.")

        # Hash Password
        hashed_pw = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        if existing_user:
            existing_user.hashed_password = hashed_pw
            existing_user.full_name = req.full_name
            existing_user.is_verified = 1
        else:
            new_user = User(
                email=req.email, 
                full_name=req.full_name, 
                hashed_password=hashed_pw, 
                is_verified=1,
                provider="email"
            )
            db.add(new_user)
        
        # Clean up OTPs
        db.query(VerificationOTP).filter(VerificationOTP.email == req.email).delete()
        db.commit()

        return {"message": "User successfully registered."}
    finally:
        db.close()


@auth_router.post("/login")
def login(req: LoginRequest):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == req.email).first()
        if not user or user.is_verified == 0:
            raise HTTPException(status_code=400, detail="Invalid credentials or unverified account.")
        
        if user.provider != "email" or not user.hashed_password:
            raise HTTPException(status_code=400, detail="Please login with Google.")

        if not bcrypt.checkpw(req.password.encode('utf-8'), user.hashed_password.encode('utf-8')):
            raise HTTPException(status_code=400, detail="Invalid credentials.")

        # Return a simple object, here we would ideally return a JWT token.
        return {
            "message": "Login successful", 
            "email": user.email, 
            "full_name": user.full_name,
            "profile_picture": user.profile_picture,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
    finally:
        db.close()


@auth_router.post("/google")
async def google_login(req: GoogleLoginRequest):
    db = SessionLocal()
    try:
        # Because we're using @react-oauth/google with the access token flow (useGoogleLogin):
        # We need to fetch the user info directly from Google's UserInfo API
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo", 
                headers={"Authorization": f"Bearer {req.access_token}"}
            )
            
        if resp.status_code != 200:
            logger.error(f"Google Token Info failed: {resp.text}")
            raise HTTPException(status_code=400, detail="Invalid Google Access Token")
            
        user_info = resp.json()
        email = user_info.get("email")
        full_name = user_info.get("name", "Google User")

        if not email:
            raise HTTPException(status_code=400, detail="Google account does not have an email.")

        user = db.query(User).filter(User.email == email).first()
        picture = user_info.get("picture")

        if not user:
            # Auto-register google user
            user = User(
                email=email,
                full_name=full_name,
                is_verified=1,
                provider="google",
                profile_picture=picture
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Update picture if it changed
            if picture and user.profile_picture != picture:
                user.profile_picture = picture
                db.commit()

        return {
            "message": "Google Authentication successful", 
            "email": user.email, 
            "full_name": user.full_name,
            "profile_picture": user.profile_picture,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
    except Exception as e:
        logger.error(f"Google Login Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during Google Login.")
    finally:
        db.close()


@auth_router.put("/profile-picture")
def update_profile_picture(req: UpdateProfilePictureRequest):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.profile_picture = req.profile_picture
        db.commit()
        return {"message": "Profile picture updated successfully"}
    finally:
        db.close()
