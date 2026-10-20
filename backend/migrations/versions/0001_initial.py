"""Initial persisted prototype schema."""

from alembic import op
from db import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(
        op.get_bind(),
        tables=[
            table for table in Base.metadata.sorted_tables if table.name != "findings"
        ],
    )
    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            "CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END"
        )
        op.execute(
            "CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END"
        )


def downgrade():
    raise RuntimeError(
        "Use the explicit local reset command; audit history is append-only."
    )
