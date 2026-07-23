import enum
import uuid
from sqlalchemy import String, Boolean, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantModel

class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    STOCK_MANAGER = "STOCK_MANAGER"
    STAFF = "STAFF"
    FINANCE = "FINANCE"

class User(TenantModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role_enum", native_enum=True), default=Role.STAFF)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
