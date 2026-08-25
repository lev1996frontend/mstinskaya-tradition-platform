"""Initial education tables.

Revision ID: 20260825_education_init
Revises: 20260825_athletes_init
Create Date: 2026-08-25 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260825_education_init"
down_revision = "20260825_athletes_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=20), nullable=False, server_default="GENERAL"),
        sa.Column("level", sa.String(length=20), nullable=False, server_default="BEGINNER"),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_courses"),
    )
    op.create_index(op.f("ix_courses_title"), "courses", ["title"], unique=False)

    op.create_table(
        "course_modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], name="fk_course_modules_course_id_courses", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_course_modules"),
    )
    op.create_index(op.f("ix_course_modules_course_id"), "course_modules", ["course_id"], unique=False)

    op.create_table(
        "lessons",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("module_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("content_type", sa.String(length=20), nullable=False, server_default="TEXT"),
        sa.Column("video_url", sa.String(length=500), nullable=True),
        sa.Column("document_url", sa.String(length=500), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("order_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["module_id"], ["course_modules.id"], name="fk_lessons_module_id_course_modules", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_lessons"),
    )
    op.create_index(op.f("ix_lessons_module_id"), "lessons", ["module_id"], unique=False)

    op.create_table(
        "course_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="STARTED"),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_course_enrollments_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], name="fk_course_enrollments_course_id_courses", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_course_enrollments"),
    )
    op.create_index(op.f("ix_course_enrollments_user_id"), "course_enrollments", ["user_id"], unique=False)
    op.create_index(op.f("ix_course_enrollments_course_id"), "course_enrollments", ["course_id"], unique=False)

    op.create_table(
        "lesson_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_lesson_progress_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], name="fk_lesson_progress_lesson_id_lessons", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_lesson_progress"),
    )
    op.create_index(op.f("ix_lesson_progress_user_id"), "lesson_progress", ["user_id"], unique=False)
    op.create_index(op.f("ix_lesson_progress_lesson_id"), "lesson_progress", ["lesson_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lesson_progress_lesson_id"), table_name="lesson_progress")
    op.drop_index(op.f("ix_lesson_progress_user_id"), table_name="lesson_progress")
    op.drop_table("lesson_progress")

    op.drop_index(op.f("ix_course_enrollments_course_id"), table_name="course_enrollments")
    op.drop_index(op.f("ix_course_enrollments_user_id"), table_name="course_enrollments")
    op.drop_table("course_enrollments")

    op.drop_index(op.f("ix_lessons_module_id"), table_name="lessons")
    op.drop_table("lessons")

    op.drop_index(op.f("ix_course_modules_course_id"), table_name="course_modules")
    op.drop_table("course_modules")

    op.drop_index(op.f("ix_courses_title"), table_name="courses")
    op.drop_table("courses")
