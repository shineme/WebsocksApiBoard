# GitHub Actions Docker 自动构建配置指南

## 📋 概述

本项目配置了 GitHub Actions 自动构建和推送 Docker 镜像到：
- Docker Hub
- GitHub Container Registry (GHCR)

## 🚀 快速开始

### 方案 1: 使用 Docker Hub（推荐）

#### 1. 创建 Docker Hub 账号
访问 https://hub.docker.com/ 注册账号

#### 2. 创建 Access Token
1. 登录 Docker Hub
2. 点击右上角头像 → Account Settings
3. 选择 Security → New Access Token
4. 输入描述（如：GitHub Actions）
5. 复制生成的 token（只显示一次！）

#### 3. 配置 GitHub Secrets
在你的 GitHub 仓库中：

1. 进入 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下 secrets：

| Secret 名称 | 值 | 说明 |
|------------|-----|------|
| `DOCKER_HUB_USERNAME` | 你的 Docker Hub 用户名 | 例如：affadsense |
| `DOCKER_HUB_TOKEN` | 刚才创建的 Access Token | 从 Docker Hub 复制 |

#### 4. 修改工作流文件（可选）

编辑 `.github/workflows/docker-simple.yml`：

```yaml
tags: |
  ${{ secrets.DOCKER_HUB_USERNAME }}/task-dispatcher-dashboard:latest
  ${{ secrets.DOCKER_HUB_USERNAME }}/task-dispatcher-dashboard:${{ github.sha }}
```

如果想修改镜像名称，将 `task-dispatcher-dashboard` 改为你想要的名称。

#### 5. 推送代码触发构建

```bash
git add .
git commit -m "Add GitHub Actions for Docker build"
git push origin main
```

#### 6. 查看构建状态

1. 进入 GitHub 仓库的 Actions 标签
2. 查看 "Build Docker Image (Simple)" 工作流
3. 等待构建完成（通常 3-5 分钟）

#### 7. 拉取镜像

构建成功后，可以拉取镜像：

```bash
docker pull affadsense/task-dispatcher-dashboard:latest
```

### 方案 2: 使用 GitHub Container Registry

#### 优势
- 无需额外注册
- 与 GitHub 仓库集成
- 免费且无限制

#### 配置步骤

1. **启用 GHCR**
   - GitHub 会自动提供 `GITHUB_TOKEN`
   - 无需额外配置 secrets

2. **使用完整工作流**
   - 使用 `.github/workflows/docker-build.yml`
   - 它会同时推送到 Docker Hub 和 GHCR

3. **拉取镜像**
   ```bash
   docker pull ghcr.io/你的用户名/仓库名:latest
   ```

## 📁 文件说明

### 工作流文件

| 文件 | 说明 | 推荐场景 |
|------|------|----------|
| `.github/workflows/docker-simple.yml` | 简化版，只推送到 Docker Hub | 个人项目，简单部署 |
| `.github/workflows/docker-build.yml` | 完整版，支持多平台和多仓库 | 生产环境，需要多平台支持 |

### 触发条件

#### docker-simple.yml
- 推送到 `main` 分支
- 创建 `v*` 标签（如 v1.0.0）

#### docker-build.yml
- 推送到 `main` 或 `master` 分支
- 创建 `v*` 标签
- Pull Request（仅构建，不推送）

## 🏷️ 镜像标签策略

### 自动生成的标签

| 触发条件 | 生成的标签 | 示例 |
|---------|-----------|------|
| 推送到 main | `latest` | `affadsense/app:latest` |
| 推送到 main | `main-{sha}` | `affadsense/app:main-abc1234` |
| 创建标签 v1.2.3 | `1.2.3`, `1.2`, `1` | `affadsense/app:1.2.3` |
| Pull Request | `pr-{number}` | `affadsense/app:pr-42` |

### 手动指定标签

编辑工作流文件中的 `tags` 部分：

```yaml
tags: |
  ${{ secrets.DOCKER_HUB_USERNAME }}/task-dispatcher-dashboard:latest
  ${{ secrets.DOCKER_HUB_USERNAME }}/task-dispatcher-dashboard:v1.0.0
  ${{ secrets.DOCKER_HUB_USERNAME }}/task-dispatcher-dashboard:stable
```

## 🔧 高级配置

### 1. 多平台构建

默认构建 `linux/amd64` 和 `linux/arm64`：

```yaml
platforms: linux/amd64,linux/arm64
```

如果只需要 amd64：

```yaml
platforms: linux/amd64
```

### 2. 构建缓存

使用 GitHub Actions 缓存加速构建：

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

### 3. 构建参数

传递构建参数到 Dockerfile：

```yaml
build-args: |
  NODE_ENV=production
  API_URL=https://api.example.com
```

在 Dockerfile 中接收：

```dockerfile
ARG NODE_ENV=production
ARG API_URL
ENV NODE_ENV=$NODE_ENV
ENV NEXT_PUBLIC_API_URL=$API_URL
```

### 4. 定时构建

添加定时触发（每周一凌晨 2 点）：

```yaml
on:
  schedule:
    - cron: '0 2 * * 1'
  push:
    branches:
      - main
```

## 🐛 故障排查

### 问题 1: 构建失败 - 认证错误

**错误信息**:
```
Error: Cannot perform an interactive login from a non TTY device
```

**解决方法**:
1. 检查 Secrets 是否正确配置
2. 确认 `DOCKER_HUB_USERNAME` 和 `DOCKER_HUB_TOKEN` 都已设置
3. 重新生成 Docker Hub Access Token

### 问题 2: 推送失败 - 权限错误

**错误信息**:
```
denied: requested access to the resource is denied
```

**解决方法**:
1. 确认 Docker Hub 用户名正确
2. 确认 Access Token 有写入权限
3. 检查镜像名称是否包含用户名前缀

### 问题 3: 构建超时

**解决方法**:
1. 优化 Dockerfile（使用多阶段构建）
2. 启用构建缓存
3. 减少不必要的依赖

### 问题 4: 镜像太大

**解决方法**:
1. 使用 Alpine 基础镜像
2. 使用多阶段构建
3. 清理不必要的文件
4. 配置 `.dockerignore`

## 📊 监控构建

### 查看构建日志
1. GitHub 仓库 → Actions 标签
2. 点击具体的工作流运行
3. 查看每个步骤的详细日志

### 构建状态徽章

在 README.md 中添加：

```markdown
![Docker Build](https://github.com/你的用户名/仓库名/actions/workflows/docker-simple.yml/badge.svg)
```

## 🚢 部署使用

### 拉取并运行镜像

```bash
# 从 Docker Hub 拉取
docker pull affadsense/task-dispatcher-dashboard:latest

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e ADMIN_PASSWORD=your-password \
  --name task-dispatcher \
  affadsense/task-dispatcher-dashboard:latest
```

### 使用 docker-compose

```yaml
version: '3.8'

services:
  app:
    image: affadsense/task-dispatcher-dashboard:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - ADMIN_PASSWORD=affadsense
    restart: unless-stopped
```

## 🔐 安全建议

1. **不要在代码中硬编码密码**
   - 使用环境变量
   - 使用 GitHub Secrets

2. **定期更新 Access Token**
   - 每 3-6 个月更换一次
   - 使用最小权限原则

3. **启用 Docker Content Trust**
   ```bash
   export DOCKER_CONTENT_TRUST=1
   ```

4. **扫描镜像漏洞**
   - 使用 Docker Scout
   - 使用 Trivy 扫描器

## 📚 相关资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker Hub 文档](https://docs.docker.com/docker-hub/)
- [GitHub Container Registry 文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Buildx 文档](https://docs.docker.com/buildx/working-with-buildx/)

## ✅ 检查清单

配置完成后，确认以下项目：

- [ ] Docker Hub 账号已创建
- [ ] Access Token 已生成
- [ ] GitHub Secrets 已配置
- [ ] 工作流文件已添加
- [ ] .dockerignore 已创建
- [ ] 代码已推送到 GitHub
- [ ] Actions 构建成功
- [ ] 镜像可以正常拉取
- [ ] 容器可以正常运行

## 🎉 完成！

现在每次推送代码到 main 分支，GitHub Actions 会自动：
1. 构建 Docker 镜像
2. 推送到 Docker Hub
3. 生成多个标签
4. 支持多平台

你可以随时从 Docker Hub 拉取最新镜像部署！
