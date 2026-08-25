from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantModel


class ApprovalRule(TenantModel):
    """Amount-banded routing rule for payment approvals. MVP ships a single
    catch-all rule (min_amount=0, max_amount=NULL); finer-grained roles/limits
    can be added later as new rows without a schema change.
    """
    __tablename__ = "approval_rules"

    min_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    max_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    approver_permission: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
