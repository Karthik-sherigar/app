import sqlite3
import os

db_path = "database.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        print("Schema for deep_dive_cache:")
        cursor.execute("PRAGMA table_info(deep_dive_cache)")
        for col in cursor.fetchall(): print(col)
        
        print("\nSchema for query_history:")
        cursor.execute("PRAGMA table_info(query_history)")
        for col in cursor.fetchall(): print(col)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print("Database not found")
