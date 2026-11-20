# 1. le site (Vite) est construit à part…
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2. …puis servi par l'API : une seule image à lancer ou déployer
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH"
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev
COPY --from=web /web/dist /app/web/dist
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn rockfilon.api:app --host 0.0.0.0 --port 8000"]
