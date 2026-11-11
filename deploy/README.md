# 部署与一致性核对 SOP

本地仓库是唯一源码来源（source of truth）。NAS 只运行本仓库构建出来的代码；
每次迭代完成后用 `deploy.sh` 部署、用 `check.sh` 核对三方一致。

```
本地仓库  ──tar over ssh──▶  /volume1/docker/classroom-ai  ──docker compose build──▶  运行容器 /app
   ▲                                  ▲                                      ▲
   └──────────── check.sh 逐文件 sha256 三方比对 ─────────────────────────────┘
```

## 一、首次配置（本机一次性）

1. 生成专用 SSH 密钥（无口令，供脚本自动登录）：

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/wushi_nas_ed25519 -N ""
   ```

2. 把公钥装到 NAS（需要一次密码登录）。若 DSM 未开启「用户主目录」服务，
   先在 DSM 控制面板 → 用户与群组 → 高级 → 勾选「启用用户主目录」，再执行：

   ```bash
   sshpass -p '<NAS密码>' ssh admin-01@10.200.223.1 \
     'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys' \
     < ~/.ssh/wushi_nas_ed25519.pub
   ```

   验证：`ssh -i ~/.ssh/wushi_nas_ed25519 admin-01@10.200.223.1 'echo ok'`

3. 生成配置文件：

   ```bash
   cp deploy/nas.env.example deploy/nas.env   # 填入 NAS 密码
   ```

   `deploy/nas.env` 含密码，已被 `.gitignore` 排除，**不要提交**。

## 二、日常命令

| 命令 | 作用 |
| --- | --- |
| `./deploy/check.sh` | 三方一致性核对 + 运行状态，一行给出结论（只读） |
| `./deploy/deploy.sh --dry-run` | 只看本地与 NAS 的差异，不改动任何东西 |
| `./deploy/deploy.sh --sync` | 只同步源码到 NAS，不构建、不重启 |
| `./deploy/deploy.sh` | 全量：同步源码 → NAS 上 `docker compose up -d --build` → 轮询健康检查 → 打印容器状态 |
| `./deploy/backup-db.sh` | 备份 NAS 数据库到 `backups/`（改动 schema 前务必执行） |

完整迭代顺序：

```bash
./deploy/backup-db.sh          # 涉及数据库时
./deploy/deploy.sh             # 同步 + 构建 + 重启（中断约 20–60 秒，避开上课时间）
./deploy/check.sh              # 必须看到「三方完全一致 ✅」
```

最后别忘了更新 `../吾师功能迭代记录.docx` 并 `git commit`。

## 三、check.sh 的三段核对

1. **本地 ↔ NAS 源码目录**：逐文件 SHA-256 全量比对，116 个文件应完全一致。
   排除：`node_modules/ .next/ .git/ .claude/ exports/ deploy/ *.tsbuildinfo .DS_Store .env*`
2. **NAS 源码 ↔ 运行容器**：比对 `/app` 内 `src/ prisma/ public/ tools/ server.ts entrypoint.sh`。
   容器内多出本地已删除的文件 = ⚠️ 非阻断（下次部署后消失）；容器代码落后 = ❌。
3. **运行状态**：HTTP 200 + 容器 `running/healthy` + 镜像构建时间。

## 四、注意事项

- **.env 只在 NAS**：生产密钥（POSTGRES_PASSWORD / JWT_SECRET / DEEPSEEK_API_KEY）不写入本地、不参与同步。
- **exports/ 是线上数据**：课程导出 Excel 在这里，不参与同步，不要 `--delete` 它。
- **schema 变更风险**：容器启动时 `docker/entrypoint.sh` 会执行
  `npx prisma db push --accept-data-loss`，改 `prisma/schema.prisma` 前必须先 `./deploy/backup-db.sh`。
- **避开上课时间重启**：`docker compose up -d` 会重建 app 容器，中断 20–60 秒。
  只想验证能否构建时，直接在 NAS 上执行 `sudo docker-compose build`（不重启）。
- **为什么不用 rsync**：DSM 的 `/usr/bin/rsync` 被 Synology 改造过，非交互 `--server` 模式会直接返回
  `Permission denied, please try again.`，因此同步改用 `tar over ssh`。
- **SSH 报 Permission denied**：通常是连续密码登录失败触发了 DSM 账号保护（约 10 分钟自解）。
  改用密钥登录即可避免；密码只用于 `sudo -S` 提权。
- **docker 不在 PATH**：DSM 7 的路径是 `/var/packages/ContainerManager/target/usr/bin/docker`，
  已写在 `nas.env`。

## 五、回滚

1. **代码**：`git log --oneline` 找到上一个基线，`git revert`/`git checkout` 后重新 `./deploy/deploy.sh`。
2. **数据库**：从 `backups/` 里最近的 `classroom_ai_*.sql.gz` 恢复：

   ```bash
   gunzip -c backups/classroom_ai_xxx.sql.gz | ssh admin-01@10.200.223.1 \
     "sudo /var/packages/ContainerManager/target/usr/bin/docker exec -i classroom-ai-db-1 psql -U postgres -d classroom_ai"
   ```

3. **镜像**：部署前后可用 `docker tag classroom-ai-app:latest classroom-ai-app:rollback`
   保留上一版镜像，需要时 `docker tag` 回去再 `up -d`（不重新构建）。
