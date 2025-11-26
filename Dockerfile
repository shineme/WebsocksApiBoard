# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括 devDependencies）
RUN npm ci

# 复制源代码
COPY . .

# 创建 public 目录（如果不存在）
RUN mkdir -p public

# 构建 Next.js 应用
RUN npm run build

# 生产阶段
FROM node:20-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制必要的文件
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/server.js ./server.js

# 设置正确的权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["node", "server.js"]
