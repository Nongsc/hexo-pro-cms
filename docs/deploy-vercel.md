# Hexo Pro CMS 部署到 Vercel（新手教程）

本文档带你**从零开始**，把 Hexo Pro CMS 部署到 Vercel。整个过程大约 20~30 分钟，照着做即可。

项目是前后端分离的两个 Vercel 项目：

| 项目 | 目录 | 作用 |
|---|---|---|
| 后端 API | `apps/api` | NestJS 服务端（Serverless Function），负责连接数据库、GitHub、COS |
| 前端 Web | `apps/web` | Vue3 界面（静态站点） |

---

## 0. 前置清单（缺一不可）

部署前请确认你已经有：

1. ✅ 一个 **GitHub 账号**，并且已把本项目代码推到 GitHub（比如 `Nongsc/hexo-pro-cms`）
2. ✅ 一个 **Neon 账号**（PostgreSQL 云数据库，免费即可）
3. ✅ 一个 **腾讯云 COS 存储桶**（图床用，可选，不影响先跑起来）
4. ✅ 一个 **Vercel 账号**（用 GitHub 登录最方便）
5. ✅ 一个 **GitHub Token**（用于后端读写你的博客内容仓库）

> 博客内容仓库（存放 Hexo 文章的仓库，比如 `Nongsc/hexo-blog`）和这个 CMS 代码仓库是**两个不同的仓库**，别搞混。

---

## 1. 准备数据库（Neon）

1. 打开 [neon.tech](https://neon.tech)，用 GitHub 登录，新建一个项目（随便命名，比如 `hexo-pro-cms`）
2. 创建后，进入项目的 **Dashboard → Connection Details**
3. 复制 **「Direct connection」** 那一串（⚠️ **不是** Pooled connection），长这样：

```
postgresql://neondb_owner:xxxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

> ⚠️ 重点：一定要用 **Direct（直连）**，不要用带 `-pooler` 的池化串。池化串在 Vercel 上会连不上数据库。

把这串**保存到记事本**，后面要用。

---

## 2. 创建 GitHub Token

1. GitHub → 右上角头像 → **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. 点 **Generate new token (classic)**
3. 勾选权限：
   - ✅ `repo`（读写你的博客内容仓库）
   - ✅ `workflow`（触发 GitHub Actions，主题安装用）
4. 生成后**立即复制保存**（只显示一次）

---

## 3. 部署后端 API

### 3.1 新建项目

1. Vercel 控制台 → **Add New… → Project**
2. 选择导入你的 CMS 代码仓库（如 `Nongsc/hexo-pro-cms`）
3. 在导入页配置以下内容：

| 设置项 | 值 |
|---|---|
| **Root Directory** | `apps/api` |
| **Framework Preset** | `Other` |

### 3.2 配置构建

| 设置项 | 值 |
|---|---|
| **Build Command** | `pnpm run vercel-build` |
| **Output Directory** | （留空） |
| **Install Command** | （保持默认 `pnpm install`） |

### 3.3 配置 Node 版本（⚠️ 非常关键）

NestJS 12 是 ESM 模块，必须用 Node 22：

- Vercel 项目 → **Settings → General → Node.js Version → 选 `22.x`**

> 如果这一步没设对，部署后访问会报 `ERR_REQUIRE_ESM`。

### 3.4 配置环境变量

项目 → **Settings → Environment Variables**，添加以下变量：

| 变量名 | 值 |
|---|---|
| `DATABASE_URL` | 第 1 步复制的 Neon **直连串** |
| `JWT_SECRET` | 随便一串 30 位以上的随机字符（比如 `aB3xK9...`，别用默认值） |
| `GITHUB_TOKEN` | 第 2 步的 token |
| `GITHUB_OWNER` | 你的博客内容仓库 owner（如 `Nongsc`） |
| `GITHUB_REPO` | 你的博客内容仓库名（如 `hexo-blog`） |
| `GITHUB_BRANCH` | 内容仓库分支（如 `main`） |

> 其余变量（`PORT`、`WEB_ORIGIN` 等）不用填。COS 配置在系统设置里维护，也不需要环境变量。

### 3.5 部署

点 **Deploy**。等 1~2 分钟构建完成。

### 3.6 验证后端

构建完成后，浏览器打开：

```
https://你的API项目名.vercel.app/api/health
```

看到类似下面的 JSON 就说明后端部署成功了：

```json
{"code":0,"msg":"ok","data":{"status":"ok","service":"hexo-pro-cms-api","time":"..."}}
```

> 记下这个域名（`https://xxx.vercel.app`），下一步要用。

---

## 4. 部署前端 Web

### 4.1 新建项目

1. Vercel → **Add New… → Project**
2. 导入**同一个** CMS 代码仓库

### 4.2 配置

| 设置项 | 值 |
|---|---|
| **Root Directory** | `apps/web` |
| **Framework Preset** | `Vite`（一般会自动识别） |

（Build Command 和 Output Directory 已在 `apps/web/vercel.json` 里配好，不用改。）

### 4.3 配置环境变量

| 变量名 | 值 |
|---|---|
| `VITE_API_BASE_URL` | 第 3 步的后端域名，如 `https://你的API项目名.vercel.app`（**末尾不要带 `/`，也不要带 `/api`**） |

### 4.4 部署并验证

点 **Deploy**。完成后打开前端域名，应该能看到登录页。

---

## 5. 配置 COS 跨域（用图床才需要）

图床是「前端直接上传到 COS」，所以 COS 要允许前端域名跨域：

1. 腾讯云 COS 控制台 → 你的存储桶 → **安全管理 → 跨域访问 CORS 设置**
2. 来源 Origin 加上你的前端域名：`https://你的Web项目名.vercel.app`（或临时填 `*` 调试）
3. 方法勾选 `PUT`、`GET`、`POST`、`DELETE`、`HEAD`
4. 保存

> 这一项不影响「登录、文章、页面、配置」等功能，只影响图床上传。可以先跳过，等需要图床时再配。

---

## 6. 首次登录

1. 打开前端域名 → 首次会进入「初始化设置」
2. 注册管理员账号（用户名 + 密码 + 安全问题）
3. 进入后，到「系统设置」里确认/填写：
   - **GitHub 连接**：owner / repo / branch / token
   - **腾讯云 COS**：SecretId / SecretKey / Bucket / Region / 自定义域名

---

## 7. 常见问题排查

| 报错 | 原因 | 解决 |
|---|---|---|
| `ERR_REQUIRE_ESM` | Node 版本太低（NestJS 12 是 ESM） | Settings → General → Node.js Version 选 `22.x` |
| `FUNCTION_INVOCATION_FAILED` | 函数崩了，看 Logs 具体原因 | 见下方细分 |
| `No Output Directory named "public"` | 后端 Output Directory 误填了 `public` | Output Directory **留空** |
| 前端登录报 `network error` | 前端没连上后端 | 检查 `VITE_API_BASE_URL`，且设置后要 **Redeploy** |
| 请求地址少了 `/api` | 前端 baseURL 配置旧 | 拉最新代码（已自动补 `/api` 前缀） |
| `/api/health` 打不开/超时 | 数据库连接失败 | 用 Neon **直连串**，别用 `-pooler` 池化串 |
| 图床上传 CORS 报错 | COS 没允许前端域名 | 见第 5 步 |

**看函数具体报错**：Vercel → 项目 → **Logs**，红字就是真实错误，照着改即可。

---

## 附：本地开发（非部署）

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # 填入 DATABASE_URL、JWT_SECRET 等
pnpm --filter @hexo-pro-cms/api prisma:generate
pnpm --filter @hexo-pro-cms/api prisma:deploy    # 建表（迁移）
pnpm dev:api     # 后端 http://localhost:4300/api
pnpm dev:web     # 前端 http://localhost:8848（/api 自动代理到 4300）
```

> 注意：本地开发也需要 Node ≥ 22。
