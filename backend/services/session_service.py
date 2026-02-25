from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database Setup
DB_TYPE = os.getenv("DB_TYPE", "sqlite").lower()

if DB_TYPE == "mysql":
    user = os.getenv("MYSQL_USER", "root")
    password = os.getenv("MYSQL_PASSWORD", "root")
    host = os.getenv("MYSQL_HOST", "localhost")
    port = os.getenv("MYSQL_PORT", "3306")
    db_name = os.getenv("MYSQL_DB", "eyephish_db")
    # Using pymysql as the driver
    DATABASE_URL = f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}"
    engine = create_engine(DATABASE_URL)
else:
    DATABASE_URL = os.getenv("SQLITE_URL", "sqlite:///./database.db")
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class QueryHistory(Base):
    __tablename__ = "query_history"
    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, index=True)
    mode = Column(String, default="query") # Added mode column
    answer = Column(Text)  # JSON string or plain text
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class DeepDiveCache(Base):
    __tablename__ = "deep_dive_cache"
    node_id = Column(String, primary_key=True, index=True)
    data = Column(Text)  # JSON string of the deep dive content
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class SessionService:
    def __init__(self):
        Base.metadata.create_all(bind=engine)

    def get_db(self):
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def save_query_history(self, query: str, answer_data: str, mode: str = "query"):
        """
        Save a user query and its response to the history.
        """
        try:
            db = SessionLocal()
            db_item = QueryHistory(query=query, answer=str(answer_data), mode=mode)
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            db.close()
            logger.info(f"Saved {mode} history: {query}")
            return db_item
        except Exception as e:
            logger.error(f"Error saving query history: {e}")
            return None

    def get_history(self, limit: int = 50):
        """
        Retrieve query history ordered by timestamp.
        """
        try:
            db = SessionLocal()
            history = db.query(QueryHistory).order_by(QueryHistory.timestamp.desc()).limit(limit).all()
            db.close()
            return history
        except Exception as e:
            logger.error(f"Error retrieving history: {e}")
            return []

    def clear_history(self):
        """
        optional: Clear all history
        """
        try:
            db = SessionLocal()
            db.query(QueryHistory).delete()
            db.commit()
            db.close()
            logger.info("Cleared query history.")
        except Exception as e:
            logger.error(f"Error clearing history: {e}")

    def get_history_item(self, item_id: int):
        """
        Retrieve a specific history item by its ID.
        """
        try:
            db = SessionLocal()
            item = db.query(QueryHistory).filter(QueryHistory.id == item_id).first()
            db.close()
            return item
        except Exception as e:
            logger.error(f"Error retrieving history item {item_id}: {e}")
            return None

    def delete_history_item(self, item_id: int):
        """
        Delete a specific history item by its ID.
        """
        try:
            db = SessionLocal()
            db_item = db.query(QueryHistory).filter(QueryHistory.id == item_id).first()
            if db_item:
                db.delete(db_item)
                db.commit()
                db.close()
                logger.info(f"Deleted history item: {item_id}")
                return True
            db.close()
            return False
        except Exception as e:
            logger.error(f"Error deleting history item {item_id}: {e}")
            return False

    def update_history_item(self, item_id: int, answer_data: str):
        """
        Update the answer data for a specific history item.
        """
        try:
            db = SessionLocal()
            item = db.query(QueryHistory).filter(QueryHistory.id == item_id).first()
            if item:
                item.answer = str(answer_data)
                db.commit()
                db.refresh(item)
                db.close()
                logger.info(f"Updated history item: {item_id}")
                return item
            db.close()
            return None
        except Exception as e:
            logger.error(f"Error updating history item {item_id}: {e}")
            return None

    def get_deep_dive(self, node_id: str):
        """Get deep dive data from cache if exists."""
        try:
            db = SessionLocal()
            cache = db.query(DeepDiveCache).filter(DeepDiveCache.node_id == node_id).first()
            db.close()
            return cache
        except Exception as e:
            logger.error(f"Error getting deep dive cache: {e}")
            return None

    def save_deep_dive(self, node_id: str, data: str):
        """Save deep dive data to cache."""
        try:
            db = SessionLocal()
            # Overwrite if exists
            existing = db.query(DeepDiveCache).filter(DeepDiveCache.node_id == node_id).first()
            if existing:
                existing.data = data
                existing.timestamp = datetime.datetime.now(datetime.timezone.utc)
            else:
                cache = DeepDiveCache(node_id=node_id, data=data)
                db.add(cache)
            db.commit()
            db.close()
            logger.info(f"Cached deep dive for node: {node_id}")
        except Exception as e:
            logger.error(f"Error saving deep dive cache: {e}")

