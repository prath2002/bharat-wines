"""remove bill categories and departments (feature dropped)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_bills_business_department', table_name='bills')
    op.drop_index('ix_bills_business_category', table_name='bills')
    op.drop_constraint('fk_bills_department_id', 'bills', type_='foreignkey')
    op.drop_constraint('fk_bills_category_id', 'bills', type_='foreignkey')
    op.drop_column('bills', 'department_id')
    op.drop_column('bills', 'category_id')

    op.drop_table('departments')
    op.drop_table('bill_categories')


def downgrade() -> None:
    op.create_table(
        'bill_categories',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id', 'name', name='uq_bill_category_business_name'),
    )
    op.create_index(op.f('ix_bill_categories_business_id'), 'bill_categories', ['business_id'])

    op.create_table(
        'departments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id', 'name', name='uq_department_business_name'),
    )
    op.create_index(op.f('ix_departments_business_id'), 'departments', ['business_id'])

    op.add_column('bills', sa.Column('category_id', sa.Uuid(), nullable=True))
    op.add_column('bills', sa.Column('department_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_bills_category_id', 'bills', 'bill_categories', ['category_id'], ['id'])
    op.create_foreign_key('fk_bills_department_id', 'bills', 'departments', ['department_id'], ['id'])
    op.create_index('ix_bills_business_category', 'bills', ['business_id', 'category_id'])
    op.create_index('ix_bills_business_department', 'bills', ['business_id', 'department_id'])
