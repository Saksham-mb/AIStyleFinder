import os
from sqlmodel import create_engine, SQLModel

# 1. Environment Routing (Kept from your original)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
IS_LOCAL = FRONTEND_URL == "http://localhost:5173"

# 2. The Database Vault (The Upgrade)
# If Render provides a DATABASE_URL, use it (Cloud Postgres).
# If it is empty (like on your laptop), default to the local file.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///style_finder.db")

# 3. Create the connection pipe
# It connects to whichever URL was selected above
engine = create_engine(DATABASE_URL, echo=IS_LOCAL)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)