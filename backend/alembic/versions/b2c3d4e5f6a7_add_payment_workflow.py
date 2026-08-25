"""add payment workflow (vendor terms, categories, departments, payment
schedules/approvals/rules, documents, bill/settlement extensions)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Vendor: payment terms, contact, bank details ---
    op.add_column('vendors', sa.Column('payment_terms_days', sa.Integer(), nullable=True))
    op.add_column('vendors', sa.Column('credit_period_days', sa.Integer(), nullable=True))
    op.add_column('vendors', sa.Column('contact_person', sa.String(length=255), nullable=True))
    op.add_column('vendors', sa.Column('phone', sa.String(length=20), nullable=True))
    op.add_column('vendors', sa.Column('email', sa.String(length=255), nullable=True))
    op.add_column('vendors', sa.Column('bank_account_holder', sa.String(length=255), nullable=True))
    op.add_column('vendors', sa.Column('bank_account_number', sa.String(length=50), nullable=True))
    op.add_column('vendors', sa.Column('bank_ifsc', sa.String(length=20), nullable=True))
    op.add_column('vendors', sa.Column('bank_name', sa.String(length=255), nullable=True))
    op.add_column('vendors', sa.Column('upi_id', sa.String(length=100), nullable=True))
    op.add_column('vendors', sa.Column('notes', sa.Text(), nullable=True))

    # --- Bill categories & departments (small admin-managed master data) ---
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

    # --- Bill: category/department/due_date_source ---
    due_date_source = postgresql.ENUM(
        'VENDOR_DEFAULT', 'INVOICE', 'MANUAL', 'CONTRACT', 'SYSTEM_CALCULATED', name='due_date_source_enum'
    )
    due_date_source.create(op.get_bind(), checkfirst=True)

    op.add_column('bills', sa.Column('due_date_source', postgresql.ENUM(
        'VENDOR_DEFAULT', 'INVOICE', 'MANUAL', 'CONTRACT', 'SYSTEM_CALCULATED',
        name='due_date_source_enum', create_type=False), nullable=True))
    op.add_column('bills', sa.Column('category_id', sa.Uuid(), nullable=True))
    op.add_column('bills', sa.Column('department_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_bills_category_id', 'bills', 'bill_categories', ['category_id'], ['id'])
    op.create_foreign_key('fk_bills_department_id', 'bills', 'departments', ['department_id'], ['id'])
    op.create_index('ix_bills_business_category', 'bills', ['business_id', 'category_id'])
    op.create_index('ix_bills_business_department', 'bills', ['business_id', 'department_id'])

    # --- Approval rules ---
    op.create_table(
        'approval_rules',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('min_amount', sa.Numeric(12, 2), server_default='0', nullable=False),
        sa.Column('max_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('approver_permission', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_approval_rules_business_id'), 'approval_rules', ['business_id'])

    # --- Payment schedules ---
    payment_schedule_status = postgresql.ENUM(
        'PENDING', 'SCHEDULED', 'APPROVAL_PENDING', 'APPROVED', 'PAID', 'ON_HOLD', 'CANCELLED', 'FAILED',
        name='payment_schedule_status_enum'
    )
    payment_schedule_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'payment_schedules',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('bill_id', sa.Uuid(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'PENDING', 'SCHEDULED', 'APPROVAL_PENDING', 'APPROVED', 'PAID', 'ON_HOLD', 'CANCELLED', 'FAILED',
            name='payment_schedule_status_enum', create_type=False), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['bill_id'], ['bills.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_payment_schedules_business_id'), 'payment_schedules', ['business_id'])
    op.create_index(op.f('ix_payment_schedules_bill_id'), 'payment_schedules', ['bill_id'])
    op.create_index('ix_payment_schedules_business_status', 'payment_schedules', ['business_id', 'status'])

    # --- Payment approvals ---
    approval_status = postgresql.ENUM('PENDING', 'APPROVED', 'REJECTED', 'ON_HOLD', name='approval_status_enum')
    approval_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'payment_approvals',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('payment_schedule_id', sa.Uuid(), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'PENDING', 'APPROVED', 'REJECTED', 'ON_HOLD', name='approval_status_enum', create_type=False),
            nullable=False),
        sa.Column('requested_by', sa.Uuid(), nullable=False),
        sa.Column('decided_by', sa.Uuid(), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('approval_rule_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['payment_schedule_id'], ['payment_schedules.id']),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id']),
        sa.ForeignKeyConstraint(['decided_by'], ['users.id']),
        sa.ForeignKeyConstraint(['approval_rule_id'], ['approval_rules.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_payment_approvals_business_id'), 'payment_approvals', ['business_id'])
    op.create_index(op.f('ix_payment_approvals_payment_schedule_id'), 'payment_approvals', ['payment_schedule_id'])

    # --- Bill settlements: link back to the schedule they fulfill (nullable) ---
    op.add_column('bill_settlements', sa.Column('payment_schedule_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'fk_bill_settlements_payment_schedule_id', 'bill_settlements', 'payment_schedules',
        ['payment_schedule_id'], ['id']
    )
    op.create_index(
        op.f('ix_bill_settlements_payment_schedule_id'), 'bill_settlements', ['payment_schedule_id']
    )

    # --- Documents (polymorphic: BILL | PAYMENT) ---
    document_owner_type = postgresql.ENUM('BILL', 'PAYMENT', name='document_owner_type_enum')
    document_owner_type.create(op.get_bind(), checkfirst=True)
    document_type = postgresql.ENUM(
        'INVOICE', 'PURCHASE_ORDER', 'PAYMENT_PROOF', 'RECEIPT', 'SUPPORTING', name='document_type_enum'
    )
    document_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'documents',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.Uuid(), nullable=False),
        sa.Column('owner_type', postgresql.ENUM(
            'BILL', 'PAYMENT', name='document_owner_type_enum', create_type=False), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.Column('doc_type', postgresql.ENUM(
            'INVOICE', 'PURCHASE_ORDER', 'PAYMENT_PROOF', 'RECEIPT', 'SUPPORTING',
            name='document_type_enum', create_type=False), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=False),
        sa.Column('uploaded_by', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_documents_business_id'), 'documents', ['business_id'])
    op.create_index('ix_documents_owner', 'documents', ['owner_type', 'owner_id'])


def downgrade() -> None:
    op.drop_table('documents')
    sa.Enum(name='document_type_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='document_owner_type_enum').drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f('ix_bill_settlements_payment_schedule_id'), table_name='bill_settlements')
    op.drop_constraint('fk_bill_settlements_payment_schedule_id', 'bill_settlements', type_='foreignkey')
    op.drop_column('bill_settlements', 'payment_schedule_id')

    op.drop_table('payment_approvals')
    sa.Enum(name='approval_status_enum').drop(op.get_bind(), checkfirst=True)

    op.drop_table('payment_schedules')
    sa.Enum(name='payment_schedule_status_enum').drop(op.get_bind(), checkfirst=True)

    op.drop_table('approval_rules')

    op.drop_index('ix_bills_business_department', table_name='bills')
    op.drop_index('ix_bills_business_category', table_name='bills')
    op.drop_constraint('fk_bills_department_id', 'bills', type_='foreignkey')
    op.drop_constraint('fk_bills_category_id', 'bills', type_='foreignkey')
    op.drop_column('bills', 'department_id')
    op.drop_column('bills', 'category_id')
    op.drop_column('bills', 'due_date_source')
    sa.Enum(name='due_date_source_enum').drop(op.get_bind(), checkfirst=True)

    op.drop_table('departments')
    op.drop_table('bill_categories')

    op.drop_column('vendors', 'notes')
    op.drop_column('vendors', 'upi_id')
    op.drop_column('vendors', 'bank_name')
    op.drop_column('vendors', 'bank_ifsc')
    op.drop_column('vendors', 'bank_account_number')
    op.drop_column('vendors', 'bank_account_holder')
    op.drop_column('vendors', 'email')
    op.drop_column('vendors', 'phone')
    op.drop_column('vendors', 'contact_person')
    op.drop_column('vendors', 'credit_period_days')
    op.drop_column('vendors', 'payment_terms_days')
