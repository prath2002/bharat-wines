"""make bills.file_url nullable (manual bill entry has no OCR file)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('bills', 'file_url', existing_type=sa.String(length=500), nullable=True)


def downgrade() -> None:
    op.alter_column('bills', 'file_url', existing_type=sa.String(length=500), nullable=False)
