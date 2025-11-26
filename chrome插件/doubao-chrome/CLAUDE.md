# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个Chrome浏览器扩展，用于自动化豆包网站(doubao.com)的交互，支持多标签页管理和任务分发。该扩展通过WebSocket与后端服务器通信，实现图片生成任务的自动化处理。

## 核心架构

### 三层架构设计
```
WebSocket Server ↔ Background Script ↔ Content Scripts (多个Tab)
                                    ↕
                                Task Queue
```

### 主要组件

1. **Background Script (background.js)**
   - WebSocket连接管理
   - 多标签页状态管理
   - 任务队列和分发策略
   - 调试器API用于拦截EventStream请求

2. **Content Script (content.js)**
   - 页面DOM操作和自动化
   - 图片URL收集和处理
   - 用户界面增强（下载按钮等）
   - 与background script通信

3. **Settings Panel (settings-panel.js)**
   - 用户配置界面
   - 标签页状态监控
   - WebSocket连接状态显示

## 开发命令和构建

### 安装和加载扩展
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录

### 调试方法
- **Background Script**: 在扩展管理页面点击"service worker"链接
- **Content Script**: 在豆包页面按F12打开开发者工具，查看Console
- **WebSocket调试**: 检查Network面板的WebSocket连接

## 核心功能实现

### 多标签页管理
- 自动检测和管理所有打开的豆包标签页
- 轮询策略分发任务到空闲标签页
- 状态监控：idle(空闲)/busy(忙碌)

### 图片拦截机制
- 使用Chrome Debugger API拦截EventStream请求
- 解析豆包图片生成结果
- 自动去重和批量下载支持

### WebSocket通信
- 单一连接管理多个标签页
- 自动重连机制
- 消息路由和任务分发

## 文件结构说明

```
DoubaoMcpBrowserProxy/
├── manifest.json       # Chrome扩展配置文件
├── background.js       # 后台脚本 - 核心逻辑
├── content.js          # 内容脚本 - 页面交互
├── settings-panel.js   # 设置面板脚本
├── icon-48.png         # 扩展图标
├── icon-128.png        # 扩展图标
└── README.md           # 项目文档
```

## 关键配置

### manifest.json 权限
- `cookies`: Cookie管理
- `webNavigation`: 页面导航监听
- `storage`: 设置存储
- `debugger`: EventStream拦截
- `scripting`: 脚本注入

### 消息类型
- `COMMAND_FROM_SERVER`: 服务器发送的命令
- `TASK_COMPLETED`: 任务完成通知
- `TAB_STATUS_UPDATE`: 标签页状态更新
- `GET_TAB_STATUS`: 获取所有标签页状态
- `FORCE_TASK_DISPATCH`: 强制分发任务

## 改造为grok.com插件的注意事项

### 主要修改点
1. **目标网站变更**: 将`doubao.com`替换为`grok.com`
2. **DOM选择器更新**: 更新内容脚本中的元素选择器
3. **EventStream解析**: 适配grok.com的图片生成API格式
4. **URL匹配规则**: 更新manifest.json中的host_permissions

### 保留的核心架构
- 多标签页管理机制
- WebSocket通信框架
- 任务队列和分发策略
- 设置面板界面

### 需要适配的组件
- 内容脚本中的DOM操作逻辑
- EventStream拦截的数据解析
- 用户界面元素选择器
- 页面导航检测逻辑

## 开发最佳实践

1. **调试扩展**: 使用Chrome扩展管理页面的"service worker"链接调试background脚本
2. **测试多标签页**: 打开多个grok.com标签页测试任务分发
3. **监控WebSocket**: 检查Network面板确保连接正常
4. **验证图片拦截**: 在开发者工具中查看EventStream请求

## 故障排除

### 常见问题
- WebSocket连接失败：检查服务器地址和防火墙设置
- 任务分发不均：验证标签页状态更新机制
- 图片拦截失败：确认调试器正确附加
- 扩展上下文失效：检查内容脚本的chrome.runtime访问

### 调试技巧
- 在background.js中使用`console.log("[Background]", "信息")`
- 在content.js中使用`console.log("[Content]", "信息")`
- 查看Chrome扩展管理页面的错误日志
- 使用Network面板监控WebSocket通信