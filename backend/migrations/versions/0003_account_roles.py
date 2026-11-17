"""Add administrator and physician account roles."""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("physicians")}
    if "role" in columns:
        return
    with op.batch_alter_table("physicians") as batch:
        batch.add_column(
            sa.Column("role", sa.String(length=20), nullable=False, server_default="physician")
        )


def downgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("physicians")}
    if "role" not in columns:
        return
    with op.batch_alter_table("physicians") as batch:
        batch.drop_column("role")
