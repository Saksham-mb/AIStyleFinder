import os
from sqlmodel import create_engine, SQLModel

# 1. Environment Routing
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
IS_LOCAL = FRONTEND_URL == "http://localhost:5173"

# 2. The Database Vault
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///style_finder.db")

# 3. THE FIX: SQLite Threading Protection
# If it's SQLite, bypass the thread lock. If it's Postgres (Render), pass an empty dict.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# 4. Create the connection pipe
engine = create_engine(DATABASE_URL, echo=IS_LOCAL, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)