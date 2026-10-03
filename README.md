# Hexo Pro CMS

复刻 [hexo-pro](https://github.com/heywarms/hexo-pro) 功能的**独立博客管理后台（CMS）**，与 Hexo 运行时、桌面端彻底解耦，部署为 Vercel 上的纯 Web 应用。

- 基于 [pure-admin](https://github.com/pure-admin/vue-pure-admin)（Vue 3 + Vite + Element Plus + TypeScript）重建 UI
- 后端采用 **NestJS 12（ESM）**（TypeScript 原生 MVC）+ **Prisma** + **PostgreSQL**
- 通过 **GitHub API** 读写博客内容与配置（不再直接操作本地文件）
- 使用**腾讯云 COS** 作为图床（配置在系统管理中维护）

## 架构（MVC）

```
┌──────────────────────────────────────────────────────────────┐
│  前端 View：apps/web（pure-admin，Vue3）                        │
│  - 登录/初始化、仪表盘、文章、页面、图床、配置、部署、设置、回收站、搜索 │
└──────────────────────────────┬───────────────────────────────┘
                               │ REST /api/*
┌──────────────────────────────▼───────────────────────────────┐
│  Controller：apps/api/src/modules/*/*.controller.ts           │
│  Service（业务逻辑）：*.service.ts                              │
│    ├─ GithubService：GitHub Contents / Actions API            │
│    └─ CosService：腾讯云 COS（上传/列表/删除/复制）              │
│  Model：prisma/schema.prisma（PostgreSQL，CMS 唯一数据源）      │
└──────────────────────────────┬───────────────────────────────┘
                               │ 写穿（write-through）
                 ┌─────────────▼──────────────┐
                 │ GitHub 仓库（Hexo 源）        │  ── GitHub Actions 构建发布
                 │ source/_posts、_config.yml  │
                 └────────────────────────────┘
```

- **Model**：PostgreSQL（Prisma）是 CMS 侧唯一数据源，持久化站点配置、内容、图床元数据、回收站、待办、部署状态等。
- **Controller**：NestJS 控制器，REST 接口，JWT 鉴权。
- **View**：pure-admin 重建的前端页面。
- **GitHub 写穿**：文章/页面/配置在写入 PostgreSQL 的同时，通过 GitHub Contents API 同步到目标 Hexo 仓库（`source/_posts/*.md`、`source/<page>/index.md`、`_config*.yml`），并可用 Actions `workflow_dispatch` 触发构建部署。

## 功能模块（对齐 hexo-pro）

| 模块 | 说明 | 后端模块 |
|---|---|---|
| 认证/登录 | 登录、首次使用注册、跳过设置、安全问题找回密码、JWT | `auth` |
| 仪表盘 | 文章/页面统计、分类标签、最近文章、待办、系统状态 | `dashboard` |
| 文章管理 | 增删改查、草稿/发布/下架、Front-matter、分类标签、搜索、从 GitHub 同步 | `posts` |
| 页面管理 | 增删改查、发布状态、从 GitHub 同步 | `pages` |
| 图床 | COS 上传/列表/删除/重命名/移动/未引用清理、粘贴上传 | `images` |
| 配置管理 | `_config*.yml` 可视化编辑、快照与回滚 | `configs` |
| 主题管理 | 列出/一键切换/从 GitHub 仓库安装/卸载主题、编辑主题配置 | `theme` |
| 部署 | 配置 GitHub Actions 工作流、触发部署、状态轮询 | `deploy` |
| 系统设置 | 站点信息、GitHub 连接、COS 配置、用户资料 | `settings`/`users` |
| 回收站 | 文章/页面恢复、彻底删除、清空 | `recycle` |

（主题市场与 AI 代理作为后续迭代，暂未实现。）

## 目录结构

```
hexo-pro-cms/
├── apps/
│   ├── web/            # 前端（pure-admin，Vue3 + Vite）
│   │   └── src/views/  # 登录、仪表盘、posts、pages、images、configs、deploy、settings、recycle、search
│   └── api/            # 后端（NestJS MVC + Prisma）
│       ├── prisma/schema.prisma
│       ├── api/index.js  # Vercel serverless 入口
│       └── src/
│           ├── modules/  # auth/users/posts/pages/images/configs/deploy/dashboard/recycle/settings
│           ├── github/   # GitHub API 服务
│           ├── cos/      # 腾讯云 COS 服务
│           └── prisma/   # PrismaService
├── docs/hexo-deploy-workflow.yml  # 目标 Hexo 仓库的示例构建工作流
├── docker-compose.yml             # 本地 PostgreSQL
├── pnpm-workspace.yaml
└── package.json
```

## 本地开发

前置：Node.js ≥ 22（NestJS 12 为 ESM 模块，需 Node 22+）、pnpm ≥ 9。

```bash
pnpm install

# 1. 配置后端环境变量（见 apps/api/.env.example）
cp apps/api/.env.example apps/api/.env
# 填入 DATABASE_URL（Neon/Supabase/Vercel Postgres，或本地 docker compose up -d）

# 2. 生成 Prisma 客户端 + 建表（初始迁移已随仓库提供，直接应用即可）
pnpm --filter @hexo-pro-cms/api prisma:generate
pnpm --filter @hexo-pro-cms/api prisma:deploy    # = prisma migrate deploy（应用 apps/api/prisma/migrations/0_init）
# 后续改了 schema 时，开发环境用：pnpm --filter @hexo-pro-cms/api prisma:migrate

# 3. 启动后端（默认 http://localhost:4300/api）
pnpm dev:api

# 4. 启动前端（默认 http://localhost:8848，/api 由 vite 代理到 4300）
pnpm dev:web
```

首次打开前端会自动进入「初始化设置」：注册管理员账号，或「跳过设置」使用临时账号；随后在「系统设置」中配置 GitHub 连接与 COS。

## 环境变量

**后端（apps/api/.env）**

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（必填） |
| `JWT_SECRET` | JWT 签名密钥（必填，随机长字符串） |
| `PORT` | 本地监听端口，默认 4300 |
| `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` | GitHub 连接的可选默认值（也可在系统设置中配置） |

**前端（apps/web/.env.production）**

| 变量 | 说明 |
|---|---|
| `VITE_API_BASE_URL` | 后端 API 域名（如 `https://xxx.vercel.app`），**不含 `/api`**，前端自动补全 |

> GitHub Token 需要 `repo`（Contents 读写）与 `workflow`（触发 Actions）权限。COS/图床配置在「系统设置 → 腾讯云 COS」中维护（存 PostgreSQL，**无需环境变量**）。

## GitHub 目标仓库约定

CMS 连接的 Hexo 源仓库按标准 Hexo 目录结构读写：

- 文章（已发布）→ `source/_posts/<slug>.md`
- 文章（草稿）→ `source/_drafts/<slug>.md`
- 页面 → `source/<slug>/index.md`
- 站点/主题配置 → `_config.yml`、`_config.<theme>.yml`（写入前自动快照，可回滚）

部署：在「部署」页面配置工作流 ID（如 `deploy.yml`）后，点击「立即部署」即通过 `workflow_dispatch` 触发目标仓库的 GitHub Actions 构建。示例工作流见 [docs/hexo-deploy-workflow.yml](docs/hexo-deploy-workflow.yml)。

## 部署到 Vercel

> 📖 **完整的新手部署教程见 [docs/deploy-vercel.md](docs/deploy-vercel.md)**，下面只是概要。

建议拆成两个 Vercel 项目（前端静态站点 + 后端 Serverless Function）：

**1. 后端（apps/api）**

- Root Directory: `apps/api`
- Node.js Version: **`22.x`**（⚠️ 关键：NestJS 12 是 ESM，Node 20 会报 `ERR_REQUIRE_ESM`）
- Framework Preset: `Other`
- Build Command: `pnpm run vercel-build`（= `prisma generate && nest build`，**不跑迁移**）
- Output Directory: 留空（`apps/api/public` 仅作占位）
- 环境变量：`DATABASE_URL`（Neon **直连串**，非池化）、`JWT_SECRET`、`GITHUB_TOKEN`、`GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH`

**2. 前端（apps/web）**

- Root Directory: `apps/web`
- Framework Preset: `Vite`
- 环境变量：`VITE_API_BASE_URL`（后端 API 域名，**不含 `/api`**，前端会自动补）

> 关键约定：数据库迁移在**本地**执行（`pnpm prisma:deploy`），Vercel 构建不连数据库；`apps/api/vercel.json` 通过 `includeFiles` 把 `dist/` 编译产物打进函数包；前端 `VITE_API_BASE_URL` 只填域名即可。

> 提示：PostgreSQL 推荐使用 Neon 的 serverless 直连串（`?sslmode=require`）；池化串（`-pooler` + `channel_binding=require`）在 Vercel 构建/运行时可能连不上。

## API 概览（前缀 `/api`）

- 认证：`POST /auth/login`、`/auth/register`、`/auth/skip-setup`、`/auth/refresh-token`、`GET /auth/me`、`/auth/check-first-use`
- 文章：`GET/POST /posts`、`GET/PUT/DELETE /posts/:id`、`POST /posts/:id/publish|unpublish`、`/posts/categories`、`/posts/tags`、`POST /posts/search`、`POST /posts/sync`
- 页面：`GET/POST /pages`、`GET/PUT/DELETE /pages/:id`、`POST /pages/sync`
- 图床：`GET/PUT /images/config`、`GET /images`、`POST /images/upload`、`DELETE /images/:id`、`POST /images/delete/batch`、`/images/move`、`/images/:id/rename`、`/images/unused`
- 配置：`GET /configs/files`、`GET /configs/file`、`POST /configs/file/draft`（存草稿）、`POST /configs/file/publish`（发布）、`DELETE /configs/file/draft`（丢弃）、`GET /configs/snapshots`、`POST /configs/rollback`
- 主题：`GET /theme/installed`、`GET /theme/current`、`POST /theme/switch`、`POST /theme/install`（git 克隆，GitHub Actions 执行）、`POST /theme/install-npm`（npm 安装）、`GET /theme/install/status/:runId`、`DELETE /theme/:name`（卸载并删除配置文件/草稿/快照）、`GET /theme/plugins` + `POST /theme/plugins` + `DELETE /theme/plugins/:name`、`GET /theme/config` + `POST /theme/config/draft` + `POST /theme/config/publish` + `DELETE /theme/config/draft`
- 部署：`GET/PUT /deploy/config`、`POST /deploy/execute`、`GET /deploy/status`
- 仪表盘：`/dashboard/stats`、`/dashboard/recent`、`/dashboard/system`、`/dashboard/todos*`
- 回收站：`GET /recycle`、`POST /recycle/:id/restore`、`DELETE /recycle/:id`、`POST /recycle/empty`
- 设置：`GET/PUT /settings/{system,github,cos,deploy}`、`PUT /users/profile`、`POST /users/avatar`

统一响应格式：成功 `{ code: 0, data, msg: "ok" }`；失败 `{ code: <状态码>, msg, data: null }`。
