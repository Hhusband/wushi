FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma (schema + generated client at src/generated/prisma)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

# Custom server + source (needed for server.ts imports)
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src

# Batch code generation tool
COPY --from=builder /app/tools ./tools

# All node_modules (includes tsx and all dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Startup script
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# 统一源码权限：构建上下文里个别文件可能是 0600（由某些编辑器/同步工具创建），
# 会被原样带进镜像；运行时以 nextjs 用户（uid 1001）读取 src 会 permission denied。
RUN chmod -R a+rX ./src ./prisma ./public ./tools ./server.ts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
