"""
Database configuration.

Production target: PostgreSQL (set DATABASE_URL in .env, e.g.
postgresql+psycopg2://user:pass@host:5432/manufacturing_db)

Local/dev fallback: SQLite file, zero setup required, so the project
runs out of the box with `uvicorn app.main:app`.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./manufacturing.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_size=10 if not DATABASE_URL.startswith("sqlite") else None,
    max_overflow=20 if not DATABASE_URL.startswith("sqlite") else None,
) if not DATABASE_URL.startswith("sqlite") else create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def initialize_database():
    """Create tables and seed the default demo users if the database is empty."""
    from app import auth, models

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(models.User).first():
            return

        demo_users = [
            models.User(
                username="admin",
                email="admin@plant.local",
                full_name="Alex Rivera",
                role=models.UserRole.ADMIN,
                hashed_password=auth.hash_password("Admin123!"),
            ),
            models.User(
                username="manager",
                email="manager@plant.local",
                full_name="Jordan Lee",
                role=models.UserRole.MANAGER,
                hashed_password=auth.hash_password("Manager123!"),
            ),
            models.User(
                username="technician",
                email="tech@plant.local",
                full_name="Sam Okafor",
                role=models.UserRole.TECHNICIAN,
                hashed_password=auth.hash_password("Tech123!"),
            ),
        ]
        db.add_all(demo_users)
        db.commit()
    finally:
        db.close()


def get_db():
    """FastAPI dependency: yields a request-scoped DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
