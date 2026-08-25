"""equipment catalog init

Revision ID: 20260825_equipment_init
Revises: 20260825_media_init
Create Date: 2026-08-25 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_equipment_init"
down_revision = "20260825_media_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "equipment_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["equipment_categories.id"], name="fk_equipment_categories_parent_id_equipment_categories", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_equipment_categories"),
    )
    op.create_index(op.f("ix_equipment_categories_name"), "equipment_categories", ["name"], unique=False)
    op.create_index(op.f("ix_equipment_categories_parent_id"), "equipment_categories", ["parent_id"], unique=False)

    op.create_table(
        "suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_suppliers"),
    )
    op.create_index(op.f("ix_suppliers_name"), "suppliers", ["name"], unique=False)

    op.create_table(
        "equipment_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("manufacturer", sa.String(length=150), nullable=True),
        sa.Column("price", sa.DECIMAL(precision=10, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="BYN"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["equipment_categories.id"], name="fk_equipment_products_category_id_equipment_categories", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], name="fk_equipment_products_supplier_id_suppliers", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_equipment_products"),
    )
    op.create_index(op.f("ix_equipment_products_category_id"), "equipment_products", ["category_id"], unique=False)
    op.create_index(op.f("ix_equipment_products_supplier_id"), "equipment_products", ["supplier_id"], unique=False)
    op.create_index(op.f("ix_equipment_products_name"), "equipment_products", ["name"], unique=False)

    op.create_table(
        "product_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("media_file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["equipment_products.id"], name="fk_product_media_product_id_equipment_products", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["media_file_id"], ["media_files.id"], name="fk_product_media_media_file_id_media_files", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_product_media"),
    )
    op.create_index(op.f("ix_product_media_product_id"), "product_media", ["product_id"], unique=False)
    op.create_index(op.f("ix_product_media_media_file_id"), "product_media", ["media_file_id"], unique=False)

    op.create_table(
        "equipment_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="NEW"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_equipment_requests_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["equipment_products.id"], name="fk_equipment_requests_product_id_equipment_products", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_equipment_requests"),
    )
    op.create_index(op.f("ix_equipment_requests_user_id"), "equipment_requests", ["user_id"], unique=False)
    op.create_index(op.f("ix_equipment_requests_product_id"), "equipment_requests", ["product_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_equipment_requests_product_id"), table_name="equipment_requests")
    op.drop_index(op.f("ix_equipment_requests_user_id"), table_name="equipment_requests")
    op.drop_table("equipment_requests")

    op.drop_index(op.f("ix_product_media_media_file_id"), table_name="product_media")
    op.drop_index(op.f("ix_product_media_product_id"), table_name="product_media")
    op.drop_table("product_media")

    op.drop_index(op.f("ix_equipment_products_name"), table_name="equipment_products")
    op.drop_index(op.f("ix_equipment_products_supplier_id"), table_name="equipment_products")
    op.drop_index(op.f("ix_equipment_products_category_id"), table_name="equipment_products")
    op.drop_table("equipment_products")

    op.drop_index(op.f("ix_suppliers_name"), table_name="suppliers")
    op.drop_table("suppliers")

    op.drop_index(op.f("ix_equipment_categories_parent_id"), table_name="equipment_categories")
    op.drop_index(op.f("ix_equipment_categories_name"), table_name="equipment_categories")
    op.drop_table("equipment_categories")
