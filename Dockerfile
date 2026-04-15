# ---------- Frontend build ----------
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Backend ----------
FROM python:3.12-slim AS runtime

WORKDIR /app

# 1) Copy pyproject.toml first and install dependencies (cached layer)
COPY backend/pyproject.toml ./
RUN python -c "\
import tomllib, subprocess, sys; \
deps = tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']; \
subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--no-cache-dir'] + deps)"

# 2) Copy backend source
COPY backend/ ./

# 3) Copy built frontend into static serving directory
COPY --from=frontend-build /app/frontend/dist ./static

# 4) Create user data directories
RUN mkdir -p /app/user_data/db \
             /app/user_data/workflows \
             /app/user_data/presets \
             /app/user_data/baselines

ENV WS_USER_DATA_DIR=/app/user_data
ENV WS_DOCKER=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
