# 🚀 GitHub Actions 快速配置（5分钟）

## 步骤 1: 准备 Docker Hub 账号

1. 访问 https://hub.docker.com/
2. 注册或登录账号
3. 记下你的用户名（例如：`affadsense`）

## 步骤 2: 创建 Access Token

1. 登录 Docker Hub
2. 点击右上角头像 → **Account Settings**
3. 左侧菜单选择 **Security**
4. 点击 **New Access Token**
5. 填写描述：`GitHub Actions`
6. 权限选择：**Read, Write, Delete**
7. 点击 **Generate**
8. **立即复制 token**（只显示一次！）

## 步骤 3: 配置 GitHub Secrets

1. 打开你的 GitHub 仓库
2. 点击 **Settings** 标签
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**

添加第一个 Secret：
- Name: `DOCKER_HUB_USERNAME`
- Secret: `affadsense`（你的 Docker Hub 用户名）
- 点击 **Add secret**

添加第二个 Secret：
- Name: `DOCKER_HUB_TOKEN`
- Secret: 粘贴刚才复制的 token
- 点击 **Add secret**

## 步骤 4: 选择工作流

### 选项 A: 简单版本（推荐新手）

使用 `.github/workflows/docker-simple.yml`

**特点**：
- ✅ 配置简单
- ✅ 只推送到 Docker Hub
- ✅ 自动生成 `latest` 和 `sha` 标签

**删除另一个文件**：
```bash
rm .github/workflows/docker-build.yml
```

### 选项 B: 完整版本（推荐生产环境）

使用 `.github/workflows/docker-build.yml`

**特点**：
- ✅ 支持多平台（amd64, arm64）
- ✅ 推送到 Docker Hub 和 GHCR
- ✅ 更多标签策略
- ✅ PR 预览构建

**删除另一个文件**：
```bash
rm .github/workflows/docker-simple.yml
```

## 步骤 5: 推送代码

```bash
git add .
git commit -m "feat: add GitHub Actions for Docker build"
git push origin main
```

## 步骤 6: 查看构建

1. 打开 GitHub 仓库
2. 点击 **Actions** 标签
3. 查看正在运行的工作流
4. 等待构建完成（约 3-5 分钟）

## 步骤 7: 验证镜像

构建成功后，拉取镜像测试：

```bash
docker pull affadsense/task-dispatcher-dashboard:latest
docker run -p 3000:3000 affadsense/task-dispatcher-dashboard:latest
```

访问 http://localhost:3000 验证应用正常运行。

## 🎉 完成！

现在每次推送代码，GitHub Actions 会自动构建并推送 Docker 镜像！

## 📝 常用命令

```bash
# 拉取最新镜像
docker pull affadsense/task-dispatcher-dashboard:latest

# 拉取特定版本
docker pull affadsense/task-dispatcher-dashboard:v1.0.0

# 查看所有标签
# 访问 https://hub.docker.com/r/affadsense/task-dispatcher-dashboard/tags
```

## 🔍 故障排查

### 构建失败？

1. 检查 Actions 日志中的错误信息
2. 确认 Secrets 配置正确
3. 确认 Docker Hub 用户名和 token 有效

### 推送失败？

1. 确认 token 有写入权限
2. 确认镜像名称格式正确：`用户名/镜像名`
3. 重新生成 Access Token

### 需要帮助？

查看完整文档：`GITHUB_ACTIONS_SETUP.md`
