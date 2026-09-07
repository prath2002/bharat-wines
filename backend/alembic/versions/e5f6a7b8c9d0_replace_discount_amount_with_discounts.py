"""replace discount_amount with discounts (supports multiple discounts)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'bills',
        sa.Column('discounts', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
    )
    op.drop_column('bills', 'discount_amount')


def downgrade() -> None:
    op.add_column(
        'bills',
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
    )
    op.drop_column('bills', 'discounts')
