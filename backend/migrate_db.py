import sqlite3
import os

db_path = "database.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        print("Adding 'mode' column to deep_dive_cache...")
        cursor.execute("ALTER TABLE deep_dive_cache ADD COLUMN mode VARCHAR DEFAULT 'query'")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_deep_dive_cache_mode ON deep_dive_cache (mode)")
        conn.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print("Database not found")
