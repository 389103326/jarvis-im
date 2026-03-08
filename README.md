# Jarvis IM 🤖

> 功能完善的即时通讯 Web 应用，Discord 风格深色主题

**当前版本：v1.0.0（正式发布）**

[![Node.js](https://img.shields.io/badge/Node.js-≥18-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-orange)](https://sqlite.org)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 功能亮点

| 功能 | 说明 |
|------|------|
| 💬 实时频道聊天 | Socket.io 全双工，消息 ACK 机制，支持话题线程 |
| 📩 私信（DM） | 一对一私信，已读回执，实时通知 |
| 📞 语音/视频通话 | WebRTC 一对一通话，DM 内直接发起 |
| 📅 定时消息 | 🕐 选择发送时间，服务端自动投递 |
| 🎬 GIF 发送 | Tenor API，trending 浏览 + 搜索 |
| 🖼️ 媒体管理 | 多图粘贴/拖拽预览、画廊灯箱、语音消息录制 |
| 🔔 智能通知 | 桌面通知 + 应用内 Toast，点击直接跳转会话 |
| 🤖 Webhook | 外部系统通过 token 发消息到频道 |
| 🎨 多主题 | Discord 暗色/浅色/午夜/海洋，4 套实时切换 |
| 📱 移动端 | iOS/PWA 适配，触控侧边栏，汉堡菜单入口 |

---

## 快速开始

### 环境要求
- **Node.js ≥ 18**（推荐 v20 LTS）

### 安装 & 启动

```bash
git clone https://github.com/389103326/jarvis-im.git
cd jarvis-im

# 一键启动（自动安装依赖）
bash start.sh
```

或直接启动（使用已构建的前端产物）：

```bash
cd server
npm install
node server.js
```

访问 **http://localhost:3000** 即可开始使用。

### 环境变量（可选）

```bash
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET（生产环境必须）
```

---

## 完整功能列表

### 消息 & 聊天
- ✅ 频道聊天 / 私信（DM）
- ✅ 消息编辑 / 删除 / 回复（引用）
- ✅ 话题线程（Thread Panel，右侧滑出）
- ✅ Emoji 反应（粒子爆炸动画 + Tooltip 显示反应者）
- ✅ 消息置顶 / 转发 / 书签
- ✅ 消息导出（TXT/JSON，最多 5000 条）
- ✅ DM 已读回执（✓ 蓝色标记）
- ✅ 消息 ACK（发送失败提示 + 一键重试）
- ✅ **定时发送**（🕐 按钮 + 服务端自动投递）
- ✅ **GIF 发送**（Tenor API，trending + 搜索）

### 文件 & 媒体
- ✅ 图片粘贴/拖拽（多图预览队列）
- ✅ 图片压缩（Canvas，最大 1280px）
- ✅ 语音消息（录制/播放，1x/1.5x/2x 变速）
- ✅ 媒体画廊（图片+GIF 4列网格，灯箱预览）
- ✅ 用户头像上传（256px 压缩，实时同步）

### 通话
- ✅ WebRTC 一对一语音通话
- ✅ WebRTC 一对一视频通话
- ✅ 来电铃声 UI（脉冲动画 + 接听/拒绝）
- ✅ 通话中控制（静音、视频开关、挂断、计时）

### 通知
- ✅ 浏览器桌面通知（页面隐藏时推送，去重）
- ✅ 应用内 Toast（6 种类型，**点击跳转对应会话**）
- ✅ 消息提醒音效（@提及独立音调）
- ✅ Tab 标题未读计数

### 频道管理
- ✅ 频道分类（Category，侧边栏折叠）
- ✅ 频道通知偏好（全部/仅@/静音）
- ✅ 慢速模式（5s~5min，前端倒计时）
- ✅ Webhook 机器人（外部 POST 发消息）

### 搜索 & 导航
- ✅ 全局跨频道消息搜索（关键词高亮，点击跳转）
- ✅ @提及聚合视图（侧边栏 🔔 Tab）
- ✅ 命令面板（`Ctrl+K`）
- ✅ 键盘快捷键

### 个性化
- ✅ 4 套主题（实时切换）
- ✅ 字体大小 / 消息密度
- ✅ 用户自定义状态 / 简介 / 头像

### 移动端
- ✅ 汉堡菜单（空状态页 + 频道页均有入口）
- ✅ 触控侧边栏抽屉
- ✅ iOS 安全区域 / PWA 支持
- ✅ 格式工具栏折叠

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Node.js + Express + Socket.io |
| 数据库 | SQLite（node-sqlite3-wasm，12 张表） |
| 认证 | JWT + bcrypt |
| 前端 | React 18 + Vite |
| 样式 | TailwindCSS |
| 状态管理 | Zustand |
| 虚拟滚动 | @tanstack/react-virtual |
| 实时通话 | WebRTC + Socket.io 信令 |

---

## 目录结构

```
jarvis-im/
├── server/              # 后端
│   ├── server.js        # 主入口
│   ├── database.js      # SQLite ORM（12 张表）
│   ├── routes/          # REST API 路由
│   ├── middleware/      # JWT 认证
│   ├── utils/           # 工具函数
│   └── uploads/         # 用户头像文件
├── client/              # 前端
│   ├── src/
│   │   ├── components/  # React 组件
│   │   ├── store/       # Zustand 状态
│   │   ├── hooks/       # Socket hook
│   │   └── utils/       # 工具函数
│   └── dist/            # 构建产物（后端静态托管）
├── .env.example         # 环境变量示例
├── start.sh             # 一键启动
├── README.md
├── TECHNICAL.md         # 详细技术文档
└── CHANGELOG.md         # 版本变更记录
```

> **详细部署文档、API 参考、WebSocket 事件：** 见 [TECHNICAL.md](./TECHNICAL.md)

---

Built with ❤️ by Jarvis 🤖
