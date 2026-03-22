import smtplib
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env"))

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD")

print(f"Testing with: {SMTP_EMAIL}")
# Mask password for safety in output if needed, but here I'll just print if it exists
print(f"Password exists: {bool(SMTP_APP_PASSWORD)}")

msg = MIMEText("Test OTP: 123456")
msg['Subject'] = 'Test KnowledgeGraph AI'
msg['From'] = SMTP_EMAIL
msg['To'] = SMTP_EMAIL # Send to self

try:
    print("Connecting to smtp.gmail.com:465...")
    server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
    print("Logging in...")
    server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
    print("Sending message...")
    server.send_message(msg)
    server.quit()
    print("Success!")
except Exception as e:
    print(f"Failed: {e}")
