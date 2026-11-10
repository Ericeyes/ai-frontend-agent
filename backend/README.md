# AI Frontend Agent - Backend

FastAPI + LangChain 后端：并行调用 LLM，为每个 variant 生成一个前端组件方案。

## 启动

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填入所选 provider 的 API Key

uvicorn app.main:app --reload --port 8000
```

未配置任何 API Key 时服务仍可启动：

- `GET /api/health` 返回 `200`，`llm_configured` 为 `false`
- `POST /api/generate` 返回 `503`，`detail` 中说明缺少哪个 Key

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/generate` | 提交需求，并行生成多个方案 |
| GET | `/api/variants` | 内置 9 个方向的 key / label / hint |
| GET | `/api/health` | 健康检查与 LLM 配置状态 |

## 环境变量

见 `.env.example`。`.env` 与 `backend/` 同级时随 `uvicorn` 启动目录自动加载。
