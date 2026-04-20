import os
from sqlmodel import create_engine, SQLModel

sqlite_file_name = "style_finder.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# Dynamic Environment Routing
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
IS_LOCAL = FRONTEND_URL == "http://localhost:5173"

# Create the connection pipe
engine = create_engine(sqlite_url, echo=IS_LOCAL)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)