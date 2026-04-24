# Workflow Studio

可视化的 LLM / HTTP 工作流编排与测试平台。提供节点式编辑器、批量执行、定时调度、断言与基线对比、运行指标统计等能力，便于对 LLM 接口和上游服务进行回归测试与日常巡检。

- 后端：FastAPI + SQLite (aiosqlite) + WebSocket
- 前端：React 19 + Vite + [@xyflow/react](https://reactflow.dev) + Zustand + TanStack Query
- 部署：单容器（Dockerfile / docker-compose），前端构建产物由后端静态托管

## 主要功能

- **可视化编辑器**：拖拽节点搭建工作流，支持变量注入、矩阵展开、循环与并发
- **丰富的 Step 类型**：`http_request`、`llm_request`、`expand_matrix`、`inject_variables`、`load_targets`、`summarize_results`、`gcp_config`、`assertions`、`snapshot`、`notify`
- **运行历史 & 指标**：记录每次执行结果，支持在 Metrics 页面查看趋势
- **断言 & 基线对比**：对响应做字段断言，并与历史快照（baseline）比对差异
- **调度 & Webhook**：内置后台调度器（默认 10s 轮询），同时支持 Webhook 触发
- **测试套件**：把多个工作流组合为 Suite 一起执行
- **Secrets 管理**：内置 secret provider，避免在工作流里硬编码凭证

## 目录结构

```
workflow-studio/
├── backend/                FastAPI 服务
│   ├── app/
│   │   ├── main.py         应用入口（含 lifespan / 路由注册）
│   │   ├── config.py       Settings（环境变量前缀 WS_）
│   │   ├── routes/         REST + WebSocket 路由
│   │   ├── steps/          Step 实现（通过 @register_step 注册）
│   │   ├── engine/         工作流执行引擎
│   │   ├── scheduling/     后台调度器
│   │   ├── secrets/        Secrets provider
│   │   ├── storage/        文件 / 对象存储
│   │   └── db/             SQLite 引擎
│   ├── data/               预置数据
│   ├── user_data/          运行时数据（DB / workflows / presets / baselines）
│   └── pyproject.toml
├── frontend/               Vite + React 前端
│   └── src/pages/          WorkflowEditor / RunHistory / Metrics
├── Dockerfile
└── docker-compose.yml
```

## 快速开始（Docker，推荐）

```bash
docker compose up -d --build
```

服务启动后访问 <http://localhost:8000>，前端与 API 都由同一个端口提供。

- 用户数据持久化到 docker volume `user_data`
- 健康检查：`GET /docs`
- 通过 `host.docker.internal` 访问宿主机服务（已在 compose 中配置）

## 本地开发

需要 Python ≥ 3.11 与 Node ≥ 20。

### 后端

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # 如需 GCS：pip install -e ".[gcp]"
uvicorn app.main:app --reload --port 8000
```

API 文档：<http://localhost:8000/docs>

### 前端

```bash
cd frontend
npm install
npm run dev                      # 默认 http://localhost:5173
```

开发模式下前端走 Vite dev server，后端 CORS 默认放行 `http://localhost:5173` 与 `http://localhost:3000`。

### 构建生产产物

```bash
cd frontend && npm run build      # 输出到 frontend/dist
```

把 `frontend/dist` 拷贝到 `backend/static/`，再启动 uvicorn 即可由后端统一托管 SPA（与 Dockerfile 行为一致）。

## 配置（环境变量）

所有配置项使用 `WS_` 前缀，详见 `backend/app/config.py`：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `WS_USER_DATA_DIR` | `backend/user_data` | 运行时数据目录（DB / workflows / presets / secrets） |
| `WS_DATA_DIR` | `backend/data` | 预置数据目录 |
| `WS_MAX_PARALLEL_TASKS` | `10` | 单工作流最大并发 |
| `WS_DEFAULT_TIMEOUT` | `180` | Step 默认超时（秒） |
| `WS_CORS_ORIGINS` | `["http://localhost:3000","http://localhost:5173"]` | CORS 白名单（JSON 数组字符串） |

容器内默认 `WS_USER_DATA_DIR=/app/user_data`、`WS_DOCKER=1`。

## 使用流程

1. 打开 <http://localhost:8000>，进入 **Workflow Editor**
2. 从左侧节点面板拖入 Step（如 `http_request` / `llm_request`），连接节点形成 DAG
3. 在节点参数里写入请求字段，可使用 `{{变量}}` 注入上下文或 secrets
4. 用 `expand_matrix` / `load_targets` 展开批量用例，用 `assertions` 做校验
5. 点击运行；通过 WebSocket 实时查看每个节点的输入输出
6. 在 **Run History** 查看历史执行，在 **Metrics** 查看趋势
7. 在 **Schedules** 配置 cron / 间隔触发，或通过 Webhook 由外部触发
8. 用 `snapshot` + baselines 把当前响应固化为基线，后续运行自动 diff

## 常用 API（节选）

| Method & Path | 用途 |
| --- | --- |
| `GET  /api/workflows` | 工作流列表 |
| `POST /api/workflows/{id}/runs` | 触发一次运行 |
| `GET  /api/runs/{run_id}` | 查询运行结果 |
| `WS   /ws/runs/{run_id}` | 订阅运行事件流 |
| `POST /api/webhooks/{id}` | Webhook 触发 |
| `GET  /api/secrets` / `POST` | Secrets 管理 |

完整 schema 见 `/docs`（Swagger UI）和 `/redoc`。

## 测试

```bash
cd backend
pytest
```

## License

Internal project — 暂未指定开源许可证。
