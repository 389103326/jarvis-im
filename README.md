# Jarvis IM 🤖

> 功能完善的即时通讯 Web 应用，Discord 风格深色主题

## 当前版本：v4.4.0

---

## 功能列表

### 认证系统
- ✅ 用户注册（用户名、密码、随机头像颜色）
- ✅ 用户登录（JWT Token，有效期 7 天）
- ✅ 自动登录（localStorage 存储 token）
- ✅ 密码修改

### 频道系统
- ✅ 默认频道：#general、#random、#tech
- ✅ 用户创建自定义频道
- ✅ 频道未读消息数角标
- ✅ 频道分类（Category）可折叠
- ✅ 频道话题（Topic）设置
- ✅ 慢速模式（5s/30s/1min/5min）
- ✅ 频道通知偏好（全部/仅@/静音）
- ✅ Webhook 机器人支持

### 私信（DM）
- ✅ 点击用户头像发起私信
- ✅ 私信列表显示最后一条消息预览
- ✅ DM 已读回执（✓ 蓝色标记）
- ✅ DM 内语音/视频通话（WebRTC）

### 消息功能
- ✅ 实时发送/接收消息（Socket.io）
- ✅ 消息历史（虚拟滚动 + 分页加载）
- ✅ 消息 ACK 机制（发送失败提示 + 一键重试）
- ✅ 消息编辑 / 删除
- ✅ 消息回复（引用）
- ✅ 话题线程（Thread Panel，右侧滑出）
- ✅ Emoji 反应（含粒子爆炸动画 + Tooltip 显示谁点了）
- ✅ 消息置顶
- ✅ 消息转发
- ✅ 消息书签收藏
- ✅ 消息导出（TXT / JSON，最多 5000 条）
- ✅ @提及高亮显示（@自己更醒目）
- ✅ URL 链接预览卡片（og: 自动解析）
- ✅ 代码块语法高亮 + 一键复制
- ✅ 长消息自动折叠（800字+，点击展开）
- ✅ 消息入场动画（slideIn + fade）
- ✅ 右键上下文菜单（含快捷 Emoji 行）
- ✅ **定时发送**（🕐 按钮选择发送时间，服务端轮询自动投递，v4.3）
- ✅ **GIF 发送**（Tenor API，trending 浏览 + 关键词搜索，双列瀑布流，v4.4）

### 文件 & 媒体
- ✅ 图片粘贴发送（Ctrl+V 多图预览队列，v4.2）
- ✅ 图片拖拽上传（多图拖拽预览，v4.2）
- ✅ 图片上传前 Canvas 压缩（最大 1280px）
- ✅ 语音消息录制（最长 2 分钟，波形动画，变速播放）
- ✅ 媒体画廊（频道内图片 4 列网格 + 灯箱全屏预览）
- ✅ 用户头像图片上传（PNG/JPEG/WebP，自动压缩到 256px，v4.1）

### 搜索 & 导航
- ✅ 全局跨频道消息搜索（关键词高亮，点击跳转定位）
- ✅ @提及聚合视图（侧边栏 🔔 Tab）
- ✅ 命令面板（`Ctrl+K` 快速跳转频道/DM）
- ✅ 键盘快捷键系统（含快捷键说明弹窗）

### 通话（WebRTC，v4.0）
- ✅ DM 内一对一语音通话
- ✅ DM 内一对一视频通话
- ✅ 来电铃声 UI（脉冲动画 + 接听/拒绝按钮）
- ✅ 通话中控制（静音、视频开关、挂断、计时器）
- ✅ 视频大画面 + PIP 本地预览（镜像）

### 通知系统
- ✅ 新消息桌面通知（页面隐藏时推送，去重）
- ✅ 消息提醒音效（Web Audio API 合成，@提及独立音调）
- ✅ Tab 标题未读计数
- ✅ 全局 Toast 通知系统（6 种类型，进度条动画）

### 实时功能
- ✅ 在线/离线状态（头像绿点/灰点）
- ✅ 正在输入状态提示
- ✅ 滚动位置记忆（切换频道恢复位置）
- ✅ 草稿持久化（切换频道不丢输入内容）

### 个性化
- ✅ 主题系统（Discord 暗色 / 浅色 / 午夜 / 海洋，4 套）
- ✅ 字体大小（小/中/大）
- ✅ 消息密度（紧凑/舒适/宽松）
- ✅ 用户自定义状态 / 个人简介
- ✅ 用户头像图片上传（v4.1）
- ✅ 通知偏好设置

### 移动端（v4.0）
- ✅ iOS 安全区域适配（刘海/Home条）
- ✅ PWA 支持（添加到主屏幕）
- ✅ 触控侧边栏抽屉
- ✅ 格式工具栏折叠（小屏优化）
- ✅ 动量滚动

### 系统 & 运维
- ✅ 服务端速率限制（每用户 10s/20条）
- ✅ 健康检查 API（`/api/health` + `/api/stats`）
- ✅ Webhook 外部接入（`POST /incoming/:token`）

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Node.js + Express + Socket.io |
| 数据库 | SQLite（node-sqlite3-wasm） |
| 认证 | JWT + bcrypt |
| 前端 | React 18 + Vite |
| 样式 | TailwindCSS |
| 状态管理 | Zustand |
| 虚拟滚动 | @tanstack/react-virtual |
| 实时通话 | WebRTC (RTCPeerConnection) + Socket.io 信令 |

---

## 快速启动

### 一键启动（推荐）

```bash
cd /home/jumpserver/.openclaw/workspace/jarvis-im
chmod +x start.sh
./start.sh
```

### 手动启动

```bash
# 启动后端
cd server
npm install
node server.js

# 构建前端（另开终端）
cd client
npm install
npm run build

# 访问 http://localhost:3000
```

### 前端开发模式（热重载）

```bash
cd client
npm run dev
# http://localhost:5173（自动代理到后端 3000）
```

---

## 访问地址

| 环境 | 地址 |
|------|------|
| 生产环境 | http://localhost:3000 |
| 前端开发服务器 | http://localhost:5173 |

---

## 目录结构

```
jarvis-im/
├── server/              # 后端
│   ├── server.js        # 主入口（Express + Socket.io）
│   ├── database.js      # SQLite 初始化 & ORM（12 张表）
│   ├── routes/          # REST API 路由
│   ├── middleware/      # JWT 认证中间件
│   ├── utils/           # 工具函数（链接预览等）
│   ├── uploads/         # 用户头像文件
│   └── messages.db      # SQLite 数据库文件（自动创建）
├── client/              # 前端
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store/       # Zustand 状态（auth/chat/call/toast）
│   │   ├── hooks/       # Socket hook
│   │   ├── components/  # React 组件
│   │   └── utils/       # 工具函数（sound/linkPreview）
│   ├── dist/            # 构建产物（由后端静态托管）
│   └── vite.config.js
├── start.sh             # 一键启动脚本
├── README.md            # 本文档
├── TECHNICAL.md         # 详细技术文档
└── CHANGELOG.md         # 版本变更记录
```

---

## 数据存储

| 数据 | 位置 |
|------|------|
| 数据库 | `server/messages.db`（SQLite，12 张表） |
| 用户头像 | `server/uploads/avatars/` |

> 详细部署文档、API 参考、WebSocket 事件列表请见 [TECHNICAL.md](./TECHNICAL.md)

---

Built with ❤️ by Jarvis 🤖
