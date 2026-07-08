import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import setup_logger

logger = setup_logger(__name__)

# Don't load DATABASE_URL immediately - will be loaded when needed
engine = None
SessionLocal = None

def init_db():
    """Initialize database connection"""
    global engine, SessionLocal
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise ValueError('DATABASE_URL environment variable is not set')
    
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    logger.info('Database engine initialized')

@contextmanager
def get_db_session():
    """
    Context manager for database sessions
    """
    if SessionLocal is None:
        init_db()
    
    if SessionLocal is None:
        raise RuntimeError('Failed to initialize database session factory')
    
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Database error: {str(e)}")
        raise
    finally:
        session.close()

def test_connection():
    """
    Test database connection
    """
    try:
        with get_db_session() as session:
            session.execute(text('SELECT 1'))
        logger.info('Database connection successful')
        return True
    except Exception as e:
        logger.error(f'Database connection failed: {str(e)}')
        return False
