from app import auth, database as database_module
from app import models


def test_initialize_database_seeds_users(monkeypatch, tmp_path):
    db_path = tmp_path / "test.db"
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    test_engine = create_engine(f"sqlite:///{db_path}")
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    monkeypatch.setattr(database_module, "engine", test_engine)
    monkeypatch.setattr(database_module, "SessionLocal", TestSessionLocal)

    database_module.initialize_database()

    db = TestSessionLocal()
    try:
        assert db.query(models.User).count() > 0
    finally:
        db.close()


def test_only_admin_login_is_allowed(monkeypatch, tmp_path):
    db_path = tmp_path / "test.db"
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    test_engine = create_engine(f"sqlite:///{db_path}")
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    monkeypatch.setattr(database_module, "engine", test_engine)
    monkeypatch.setattr(database_module, "SessionLocal", TestSessionLocal)

    database_module.Base.metadata.create_all(bind=test_engine)

    db = TestSessionLocal()
    try:
        admin_user = models.User(
            username="admin",
            email="admin@test.local",
            full_name="Admin User",
            role=models.UserRole.ADMIN,
            hashed_password=auth.hash_password("Admin123!"),
        )
        manager_user = models.User(
            username="manager",
            email="manager@test.local",
            full_name="Manager User",
            role=models.UserRole.MANAGER,
            hashed_password=auth.hash_password("Manager123!"),
        )
        db.add_all([admin_user, manager_user])
        db.commit()

        assert auth.authenticate_user(db, "admin", "Admin123!") is not None
        assert auth.authenticate_user(db, "manager", "Manager123!") is None
        assert auth.authenticate_user(db, "admin", "wrong-password") is None
    finally:
        db.close()
