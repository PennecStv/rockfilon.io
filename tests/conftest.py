import os

# base dédiée aux tests (créée par docker/initdb), à fixer avant tout import de rockfilon.models
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://rockfilon:rockfilon@localhost:5432/rockfilon_test")
