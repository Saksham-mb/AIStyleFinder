from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone

class User(SQLModel, table=True):
    id: str = Field(primary_key=True)
    email: str=Field(unique=True, index=True)
class OutfitScan(SQLModel, table=True):
    id: Optional[int]=Field(primary_key=True,default=None)
    user_id: str=Field(foreign_key="user.id",index=True)
    image_url: str
    analysis_payload: str
    scanned_at: datetime=Field(default_factory=lambda: datetime.now(timezone.utc))