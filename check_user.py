import sqlite3
import os

db_path = os.path.join("backend", "database.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

email = 'listeningspotify99@gmail.com'
cursor.execute("SELECT email, is_verified FROM users WHERE email=?", (email,))
row = cursor.fetchone()

if row:
    print(f"User found: {row[0]}, Verified: {bool(row[1])}")
else:
    print("User not found.")

conn.close()
