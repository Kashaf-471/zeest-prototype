"""Persist scenario-specific specialist fixture findings."""

from alembic import op
from db import Finding

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    Finding.__table__.create(op.get_bind(), checkfirst=True)


def downgrade():
    Finding.__table__.drop(op.get_bind())
