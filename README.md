# 吾师（wushi）

面向小学课堂的 AI 讨论助手：教师建课 → 学生分组用手机加入 → AI 扮演学科导师引导学生讨论 → 教师实时看到各组进度 → 课堂结束自动生成课堂评价并导出 Excel。

> ⚠️ 本仓库当前为 **Public**：`src/lib/constants.ts` 内含默认教师访问码（应用只在内网 `http://10.200.223.1:3003` 运行，公网不可达）。真实教师名单与访问码（`吾师已注册人员.csv`、`access-codes.csv`）**不入库**；历史中曾误提交的 `access-codes.csv` 已于 2026-11-13 从 Git 历史中清除。

## 功能概览

- **教师端**：访问码登录 / 建课（学科、年级、班级、核心问题、追问、讨论要求）/ 启动课堂 / 课堂控制台（实时看板：小组状态、发言数、深度、关键词云、AI 简报）/ 课堂报告 / 导出。
- **资料下发**：教师上传 Word / PDF / 图片（一次最多 10 张图片，自动合并为画廊），手动下发到本堂课；学生在讨论页在线预览（图片画廊、PDF 内嵌、docx 浏览器渲染），横屏自动左右分栏；课堂结束自动清除。
- **分轮讨论**：一节课可多次讨论，每轮有独立问题、讨论要求和配套资料；教师点「发布下一轮」推进，可逐轮生成 AI 小结、按轮查看各组对话。
- **学生端**：输入年级班级小组加入 → 与 AI 导师讨论（系统消息、AI 引导、讨论总结）→ 提交讨论成果。
- **实时**：Socket.IO 推送课堂与小组更新。
- **AI**：DeepSeek（`DEEPSEEK_API_KEY`），支持语文 / 数学 / 科学 / 道法四科引导策略。

## 技术栈

Next.js 16（App Router，`output: "standalone"`）+ 自定义 `server.ts`、Socket.IO、Prisma 7（PostgreSQL 16）、Redis 7、Tailwind + shadcn/ui、exceljs、jose（JWT）。

## 本地开发

需要 Node 22+、PostgreSQL 16、Redis 7（可用 Docker 起）。

```bash
cp .env.example .env        # 填写 DATABASE_URL / REDIS_URL / JWT_SECRET / DEEPSEEK_API_KEY
npm install
npx prisma db push          # 建表
npm run dev                 # tsx server.ts，默认 http://localhost:3000
```

## 部署（NAS / Docker）

线上环境：Synology NAS `10.200.223.1:3003`，`docker compose` 编排 app + PostgreSQL + Redis，代码目录 `/volume1/docker/classroom-ai`。

```bash
cd classroom-ai
./deploy/check.sh           # 三方核对：本地代码 = NAS 源码 = 运行容器
./deploy/backup-db.sh       # 备份数据库（schema 变更前必做）
./deploy/backup-files.sh    # 备份 uploads/ 与 exports/（可选）
./deploy/deploy.sh --dry-run  # 预览差异
./deploy/deploy.sh          # 同步源码 + 重建容器 + 健康检查
```

细节见 [`deploy/README.md`](deploy/README.md)。要点：

- `.env` 只存在于 NAS（含生产密码），不入库、不参与同步；`exports/`、`uploads/` 是线上数据卷，不参与同步。
- 容器启动时执行 `prisma db push --accept-data-loss`，**改 schema 前务必先备份数据库**。
- 部署会重建容器（约 20–60 秒不可用），**避开上课时间**。

## 版本与回退

| 版本 | 说明 |
| --- | --- |
| `v1.4` | 教师会话恢复（2026-06-08），NAS 长期运行的基线 |
| `v20251113` | 「20251113 版本」：V1.5 一致性核对 + 部署工具固化后的线上代码快照 |
| `v1.6` | 资料下发 + 分轮讨论（2026-11-13 部署上线，线上运行版本） |
| `v1.6.1` | 班级/年级名称兼容修复（一班/1班 均可匹配），2026-11-13 热修部署 |
| `v1.6.2` | 多轮讨论体验修复（提交页自动提示新一轮、仪表盘提交开关），2026-11-16 部署上线（线上运行版本） |
| `v1.6.3` | 学生端多轮停留页：确认提交后不离开讨论页、新一轮自动恢复输入 |
| `v1.6.4` | 启动课堂即第一轮发布：可设置首轮问题/要求、允许提交开关，并直接上传参考文件下发 |
| `v1.6.5` | 恢复课堂简报（表现优异的小组 / 需要关注的小组），讨论中随时生成（2026-11-17 部署上线，线上运行版本） |

回退到某个版本：

```bash
git fetch --tags
git checkout -b rollback v20251113   # 或 v1.4
```

要回退线上，再在 NAS 上执行 `./deploy/deploy.sh`（或 `docker compose up -d --build`）即可。

## 目录结构

```
src/app         页面与 API 路由（teacher/ student/ api/）
src/services    AI 讨论管理、LLM 客户端、Excel 导出
src/agents      学生 / 教师 / 报告 Agent
src/lib         认证、常量、Prisma/Redis、Socket
src/repositories 数据访问层
prisma/         数据模型（schema.prisma）
deploy/         部署与核对脚本、备份脚本
docker/         Dockerfile、entrypoint.sh
tools/          访问码生成等运维脚本
```

## 迭代记录

项目整体设计见工作区根目录 `DESIGN.md`；功能迭代记录见 `吾师功能迭代记录.docx`。
