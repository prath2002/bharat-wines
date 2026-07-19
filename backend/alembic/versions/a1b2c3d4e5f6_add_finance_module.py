"""add finance module (FINANCE role, vendors, bills, bill_settlements)

Revision ID: a1b2c3d4e5f6
Revises: ce5c36472694
Create Date: 2026-07-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ce5c36472694'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'FINANCE'")

    bill_status = postgresql.ENUM('PROCESSING', 'DRAFT', 'VERIFIED', 'REJECTED', name='bill_status_enum')
    payment_status = postgresql.ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', name='payment_status_enum')
    settlement_method = postgresql.ENUM('BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'OTHER', name='settlement_method_enum')
    bill_status.create(op.get_bind(), checkfirst=True)
    payment_status.create(op.get_bind(), checkfirst=True)
    settlement_method.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'vendors',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('normalized_name', sa.String(length=255), nullable=False),
        sa.Column('gstin', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id', 'normalized_name', name='uq_vendor_business_normalized_name'),
    )
    op.create_index(op.f('ix_vendors_business_id'), 'vendors', ['business_id'])

    op.create_table(
        'bills',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('vendor_id', sa.Uuid(), nullable=True),
        sa.Column('uploaded_by', sa.Uuid(), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=False),
        sa.Column('bill_number', sa.String(length=100), nullable=True),
        sa.Column('bill_date', sa.Date(), nullable=True),
        sa.Column('extracted_vendor_name', sa.String(length=255), nullable=True),
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=True),
        sa.Column('discount_amount', sa.Numeric(12, 2), server_default='0', nullable=False),
        sa.Column('charges', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('has_total_mismatch', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('ocr_raw_text', sa.Text(), nullable=True),
        sa.Column('extracted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.Enum('PROCESSING', 'DRAFT', 'VERIFIED', 'REJECTED', name='bill_status_enum', create_type=False), nullable=False),
        sa.Column('payment_status', sa.Enum('UNPAID', 'PARTIALLY_PAID', 'PAID', name='payment_status_enum', create_type=False), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('verified_by', sa.Uuid(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id']),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_bills_business_id'), 'bills', ['business_id'])
    op.create_index('ix_bills_business_status', 'bills', ['business_id', 'status'])
    op.create_index('ix_bills_business_vendor', 'bills', ['business_id', 'vendor_id'])
    op.create_index('ix_bills_business_payment_status', 'bills', ['business_id', 'payment_status'])

    op.create_table(
        'bill_settlements',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('bill_id', sa.Uuid(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('paid_on', sa.Date(), nullable=False),
        sa.Column('method', sa.Enum('BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'OTHER', name='settlement_method_enum', create_type=False), nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['bill_id'], ['bills.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_bill_settlements_business_id'), 'bill_settlements', ['business_id'])
    op.create_index(op.f('ix_bill_settlements_bill_id'), 'bill_settlements', ['bill_id'])


def downgrade() -> None:
    op.drop_table('bill_settlements')
    op.drop_table('bills')
    op.drop_table('vendors')
    sa.Enum(name='settlement_method_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='payment_status_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='bill_status_enum').drop(op.get_bind(), checkfirst=True)
    # Note: PG cannot remove a value from an enum; FINANCE stays in user_role_enum.
