# AI Frontend Agent · 多方案前端代码生成

> 一句话需求，并发生成多个结构不同的前端方案（Vue 3 / React），在九宫格中对比、实时预览、查看源码并一键下载。

用户提交需求描述与目标框架后，后端并行调用 LLM 生成 N 个**结构不同**的前端组件方案；前端以九宫格卡片展示，点击可查看实时预览（iframe `srcdoc`）与源码（highlight.js），支持在新标签页独立打开、下载 ZIP 源码，以及对失败方向单独重试。

## 功能特性

- **并行生成**：`asyncio` + `asyncio.gather(return_exceptions=True)` 并发调用 LLM，单个方案失败或超时只影响对应位置，整体仍返回 200
- **结构差异化**：内置极简 / 企业级 / 表现力 / 数据密集 / 移动优先 / 无障碍优先 / 无头组件 / 动效优先 / 兼容优先 9 个方向，也可自定义，最多 12 个
- **九宫格对比**：每个方案展示方向说明、组件名、依赖与成功/失败状态；失败卡片显示原因并可单独重试
- **实时预览**：Vue 3 走 `vue3-sfc-loader`，React 走 React 18 UMD + Babel standalone；支持多文件方案、TS/TSX 与 `.css/.scss` 注入
- **独立预览**：任意可预览方案都能通过 Blob URL 在新标签页单独打开
- **源码查看与下载**：highlight.js 高亮；一键把方案文件按原路径打包为 ZIP，并附带使用说明
- **密钥不出后端**：所有模型调用集中在后端，前端与日志不接触 API Key
- **缺 Key 可启动**：未配置任何 Key 时服务正常启动，`/api/generate` 返回可读的 **503**

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python 3.11+ · FastAPI · Pydantic v2 · pydantic-settings · LangChain（OpenAI / Anthropic / DeepSeek） |
| 前端 | Vue 3 · Vite 5 · TypeScript（strict）· highlight.js |
| 预览 | iframe `srcdoc` + `sandbox="allow-scripts"`；Vue 3、React 18 UMD、Babel standalone、Tailwind 浏览器版（CDN） |
| 下载 | 前端手写 ZIP（CRC32 + store），未引入额外 npm 依赖 |

## 目录结构

```
ai-frontend-agent/
├── package.json                   # 根脚本：npm run dev 同时启动前后端
├── scripts/dev.mjs                # 并行启动 uvicorn + vite，Ctrl+C 统一退出
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI 入口、CORS、路由挂载
│   │   ├── config.py              # pydantic-settings 配置单例
│   │   ├── schemas.py             # 请求 / 响应数据契约
│   │   ├── routers/generate.py    # /api/generate、/api/variants、/api/health
│   │   ├── agent/                 # LLM 工厂、内置方向、提示词、并行编排
│   │   └── services/validate.py   # LLM 输出契约校验
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── App.vue                # 左侧表单 + 九宫格 + 详情抽屉
│   │   ├── api.ts / types.ts
│   │   ├── preview.ts             # 预览文档构建、新标签页独立预览
│   │   ├── download.ts            # ZIP 打包下载
│   │   └── components/            # RequirementForm / GridBoard / VariantCard / CodeViewer / PreviewFrame
│   ├── vite.config.ts             # /api 代理到 localhost:8000
│   └── package.json
├── .gitignore
└── README.md
```

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+（含 npm）
- 可访问 `cdn.jsdelivr.net`（仅实时预览与独立预览需要；生成、源码查看、下载不依赖 CDN）

### 1. 安装依赖（只需一次）

```bash
# 后端
cd backend
python -m venv .venv

# Windows（PowerShell / cmd）
.venv\Scripts\activate
# Windows（Git Bash）
source .venv/Scripts/activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# 编辑 backend/.env，填入所选 provider 的 API Key

# 前端
cd ../frontend
npm install
```

### 2. 前后端一起启动（推荐）

回到**项目根目录**执行一条命令：

```bash
npm run dev
```

它等价于 `node scripts/dev.mjs`，会自动完成：

1. 定位 `backend/.venv` 中的 Python（找不到时回退到 `python` / `python3`）
2. 启动后端：`uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
3. 启动前端：`vite --host localhost --port 5173 --strictPort`
4. 为两侧日志分别加上 `[backend]` / `[frontend]` 前缀
5. 按下 `Ctrl+C` 同时停止两个服务（Windows 使用 `taskkill /T` 清理进程树）

启动完成后打开 <http://localhost:5173>。

> 不需要提前激活虚拟环境，脚本会直接使用 `backend/.venv` 内的解释器。若缺少 `backend/.env`，脚本只给出提示，后端仍可启动（此时 `/api/generate` 返回 503）。

### 3. 手动启动（可选，便于分开排障）

```bash
# 终端 A：后端
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# 终端 B：前端
cd frontend
npm run dev
```

## 配置

后端从 `backend/.env` 读取配置（在 `backend/` 目录启动 `uvicorn` 时自动加载）。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LLM_PROVIDER` | `openai` | `openai` / `anthropic` / `deepseek` |
| `LLM_MODEL` | `gpt-4o-mini` | 模型名，按 provider 填写对应模型 |
| `OPENAI_API_KEY` | 空 | `LLM_PROVIDER=openai` 时必填 |
| `ANTHROPIC_API_KEY` | 空 | `LLM_PROVIDER=anthropic` 时必填 |
| `DEEPSEEK_API_KEY` | 空 | `LLM_PROVIDER=deepseek` 时必填 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek OpenAI 兼容端点 |
| `MAX_CONCURRENCY` | `6` | 同时进行的 LLM 调用上限 |
| `PER_VARIANT_TIMEOUT_SEC` | `120` | 单个方案的超时秒数 |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | 允许的前端来源（JSON 数组） |

DeepSeek 配置示例（`backend/.env`）：

```env
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/generate` | 提交需求，并行生成多个方案 |
| GET | `/api/variants` | 内置 9 个方向的 `key` / `label` / `hint` 元信息 |
| GET | `/api/health` | 健康检查与 `llm_configured` 状态 |

### POST /api/generate

```bash
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "一个用户资料卡片，展示头像、姓名、职位和关注按钮",
    "framework": "vue3",
    "styling": "tailwind",
    "constraints": "按钮需要 loading 状态"
  }'
```

> Windows 提示：如果在 Git Bash 中内联中文 JSON 报 `There was an error parsing the body`，是终端编码问题。把请求体保存为 UTF-8 的 `body.json`，改用 `curl --data-binary @body.json` 即可。

返回结构：

```json
{
  "request_id": "1a2b3c4d",
  "elapsed_ms": 15320,
  "results": [
    {
      "slot": 0,
      "ok": true,
      "error": null,
      "variant_key": "minimal",
      "variant_label": "极简",
      "variant_note": "单文件内联实现，视觉保持中性留白",
      "framework": "vue3",
      "component_name": "UserCard",
      "files": [
        {
          "path": "src/components/UserCard.vue",
          "language": "vue",
          "content": "<template><div class=\"card\">UserCard</div></template>"
        }
      ],
      "entry_file": "src/components/UserCard.vue",
      "dependencies": ["vue", "tailwindcss"],
      "preview_notes": ""
    }
  ]
}
```

### GET /api/variants

只返回方向元信息，不返回系统提示词。以下为其中一项：

```json
{
  "variants": [
    {
      "key": "minimal",
      "label": "极简",
      "hint": "单文件实现，不做子组件拆分，事件与状态逻辑直接内联在组件内；视觉上大留白、1px 细边框、中性灰配色、无阴影，仅靠字号与间距建立层级。"
    }
  ]
}
```

### GET /api/health

```json
{ "ok": true, "llm_configured": false }
```

## 行为说明

- **并行与隔离**：`asyncio.Semaphore` 限流，`asyncio.gather(return_exceptions=True)` 汇总；单个方案异常或超时只把该 slot 标记为 `ok=false` 并记录 `error`。
- **契约校验**：`services/validate.py` 校验 `files` 非空、每项 `path`/`content` 非空、`entry_file ∈ files[].path`；框架不一致时以请求为准并在 `variant_note` 追加 `[framework corrected]`。
- **实时预览**：Vue 预览会清洗 `<script setup>` 中不允许的 `export`、移除 `scss/sass/less/stylus` 标记与样式中的 `//` 行注释；自定义 `pathResolve` 支持 `@/`、`~/` 与无扩展名相对导入；模板表达式中的类型标注与 `.js` 模块中的 TS 语法经 Babel 剥离；样式与图片导入分别移除/替换为占位 data URL，无法解析的第三方包导入替换为惰性占位值。React 预览在 UMD 全局下按 classic JSX runtime 编译，多文件合并后执行。
- **预览限制**：入口必须是可渲染的 `.vue` / `.tsx` / `.ts`，否则降级为仅代码查看；预览 iframe 只开启 `sandbox="allow-scripts"`（不含 `allow-same-origin`），生成页面中的同源请求、`localStorage`、Cookie 可能不可用，`preview_notes` 会给出对应提示。
- **独立预览**：卡片上的「新标签页预览」与详情抽屉的「在新标签页打开」会把同一份预览文档写入 Blob URL 后打开，便于单独演示。
- **下载源码**：卡片或详情抽屉的「下载源码」把方案文件按原路径打包为 ZIP，并附一份说明入口文件、依赖、方案说明与使用示例的 `README.md`。ZIP 由 `src/download.ts` 手动生成，未新增 npm 依赖。
- **重试**：失败卡片的「重试此方向」以单 variant 重新请求，只替换原 slot。

## 安全说明

- `backend/.env` 与 `.env.local` 已在 `.gitignore` 中排除，仓库只提交 `.env.example`；上传 GitHub 前请确认 `git status` 中不包含 `.env`。
- API Key 仅由后端从环境变量读取，不写入代码、前端或日志。
- 前端不直接调用任何 LLM 服务，所有模型请求只经后端。
- 预览页面运行在 `sandbox="allow-scripts"` 的 iframe 中，与主页面隔离。

## 常见问题

**提交后返回 503？** 未配置 Key，或 `LLM_PROVIDER` 与填写的 Key 不匹配。修改 `backend/.env` 后重启后端（`uvicorn --reload` 会在文件变动时自动重启）。

**预览空白或无法预览？** 预览会从 `cdn.jsdelivr.net` 加载 Vue / React / Babel / Tailwind，网络不可达时预览区域会显示「预览渲染失败」。若入口不是可渲染的 `.vue` / `.tsx` / `.ts`，卡片会提示仅支持代码查看。

**端口被占用？** 组合启动脚本会输出失败日志并退出。先停止占用 8000 或 5173 的进程；如需改端口，同时调整 `frontend/vite.config.ts` 中的代理目标与 `scripts/dev.mjs` 中的端口。

**Windows 下 npm run dev 找不到 Python？** 请先按「安装依赖」创建 `backend/.venv` 并 `pip install -r requirements.txt`；脚本会优先使用该虚拟环境。

**预览里的 fetch / localStorage 为什么不可用？** 这是 `sandbox="allow-scripts"` 的安全隔离行为，预览与主页面不同源。需要真实后端联调时，请直接运行生成的前端项目。

## Self-check

- [x] 前后端数据契约字段完全对应（`schemas.py` 与 `types.ts`）
- [x] 并行调用使用 `asyncio.gather(return_exceptions=True)`，无同步串行调用
- [x] 未配置 Key 时 `/api/generate` 返回 503，而非 500 或崩溃
- [x] `entry_file` 必须属于 `files[].path`
- [x] `/api/variants` 只返回方向元信息，不返回系统提示词
- [x] 前端不直接调用 LLM，API Key 不写入代码、前端或日志
- [x] 九宫格在结果不足 9 个时渲染占位卡，失败方向可单独重试
- [x] 方案卡片与详情抽屉均支持「新标签页预览」与「下载源码」
- [x] ZIP 由前端手动生成（CRC32 + store），未新增 npm 依赖
- [x] 未引入数据库、用户系统、历史记录、Docker、CI、K8s 配置
- [x] 代码与文档中没有 `// ...` 或 `# ...` 省略占位符

## 验证记录

- 后端 `python -m compileall -q app` 通过；`uvicorn app.main:app` 启动成功
- 未配置 Key 时 `GET /api/health` 返回 `{"ok":true,"llm_configured":false}`；`POST /api/generate` 返回 503
- 离线编排测试通过：slot 排序、`[framework corrected]`、结构化输出失败后的文本 JSON 回退、单 slot 失败隔离、超时降级为 `ok=false`
- 预览变换验证通过：`@vue/compiler-sfc` 可编译清洗后的 SFC；React 多文件合并与 import/export 清洗后可解析；6 个预览 CDN 依赖均返回 200
- `npm run build`（`vue-tsc --noEmit` strict + `vite build`）在最近一次 React 预览修复前通过；提交前请重新执行一次
- React 预览已完成两项修复：内联 runner 的引号注入改为 `hintName` 序列化拼接，Babel 8 显式指定 `runtime: "classic"`
- 组合启动脚本 `scripts/dev.mjs` 与根 `package.json` 为新增内容，首次使用请执行一次 `npm run dev` 冒烟验证
