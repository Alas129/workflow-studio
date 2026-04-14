# ---------- Frontend build ----------
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Backend ----------
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install Python dependencies
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir . 2>/dev/null || pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "pydantic>=2.10.0" \
    "pydantic-settings>=2.6.0" \
    "httpx>=0.28.0" \
    "pyyaml>=6.0.2" \
    "aiosqlite>=0.20.0" \
    "websockets>=13.0" \
    "python-multipart>=0.0.12"

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend static serving directory
COPY --from=frontend-build /app/frontend/dist ./static

# Create user data directory
RUN mkdir -p /app/user_data/db /app/user_data/workflows /app/user_data/presets

ENV WS_USER_DATA_DIR=/app/user_data
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
