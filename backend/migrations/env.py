from alembic import context
from db import Base, engine

config = context.config
target_metadata = Base.metadata
with engine.connect() as connection:
    context.configure(
        connection=connection, target_metadata=target_metadata, render_as_batch=True
    )
    with context.begin_transaction():
        context.run_migrations()
