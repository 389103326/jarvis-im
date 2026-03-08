# Jarvis IM — 技术文档

> 最后更新：2026-03-08（v4.4.0）

## 项目概述

Jarvis IM 是一个类 Discord 风格的实时通讯应用，支持频道聊天、私信、话题线程、Webhook 机器人、WebRTC 语音/视频通话、定时消息等功能。

- **服务地址：** http://localhost:3000
- **当前版本：** v4.4.0
- **当前 Bundle：** ~464 KB JS（gzip ~141 KB）/ 41.5 KB CSS
- **技术栈：** React + Zustand + Socket.io（前端）/ Express + Socket.io + SQLite（后端）

---

## 架构总览

```
jarvis-im/
├── client/                  # 前端（React + Vite）
│   └── src/
│       ├── components/
│       │   ├── Auth/        # 登录/注册
│       │   ├── Chat/        # 聊天区域核心组件
│       │   ├── Sidebar/     # 侧边栏（频道列表、DM列表、成员列表等）
│       │   ├── Layout/      # 布局组件
│       │   └── common/      # 通用组件（Avatar、命令面板、书签、快捷键等）
│       ├── hooks/
│       │   └── useSocket.js # WebSocket 核心 Hook
│       ├── store/
│       │   ├── useAuthStore.js     # 用户认证状态
│       │   ├── useChatStore.js     # 消息/频道状态
│       │   ├── useCallStore.js     # WebRTC 通话状态（v4.0）
│       │   └── useToastStore.js    # 全局 Toast 通知
│       └── utils/           # 工具函数
├── server/                  # 后端（Node.js + Express）
│   ├── routes/              # REST API 路由
│   ├── middleware/          # 认证中间件
│   ├── utils/               # 工具函数（链接预览等）
│   ├── uploads/             # 用户头像文件存储目录（v4.1）
│   ├── database.js          # SQLite 初始化 & ORM
│   └── server.js            # 主入口（Express + Socket.io）
├── start.sh                 # 一键启动脚本
├── README.md
├── TECHNICAL.md             # 本文档
└── CHANGELOG.md             # 版本变更记录
```

---

## 数据库结构（12 张表）

| 表名 | 说明 |
|------|------|
| `users` | 用户账号（含 avatarColor、customStatus、bio、**avatar_url** v4.1） |
| `channels` | 频道（含 slowModeSeconds、topic、description） |
| `dm_channels` | 私信频道 |
| `messages` | 消息（含 type、replyTo、thread_parent_id、isAudio、isScheduled 等） |
| `reactions` | Emoji 反应 |
| `channel_members` | 频道成员关系 |
| `pinned_messages` | 置顶消息 |
| `channel_categories` | 频道分类 |
| `bookmarks` | 书签 |
| `dm_read_receipts` | DM 已读回执 |
| `webhooks` | Webhook 机器人配置 |
| `scheduled_messages` | 定时消息（status: pending/sent/cancelled，v4.3） |

### scheduled_messages 表结构（v4.3 新增）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `channel_id` | INTEGER | 目标频道 ID（nullable） |
| `dm_channel_id` | INTEGER | 目标 DM 频道 ID（nullable） |
| `user_id` | INTEGER | 发送者 ID |
| `content` | TEXT | 消息内容 |
| `scheduled_at` | DATETIME | 预计发送时间 |
| `status` | TEXT | pending / sent / cancelled |
| `created_at` | DATETIME | 创建时间 |
| `sent_at` | DATETIME | 实际发送时间（nullable） |
| `message_id` | INTEGER | 发送成功后对应的消息 ID（nullable） |
| `type` | TEXT | 消息类型（默认 text） |

---

## REST API

### 认证 `/api/auth`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 注册 |
| POST | `/login` | 登录，返回 JWT |
| PUT | `/change-password` | 修改密码（需认证） |

### 用户 `/api/users`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取全部用户列表 |
| GET | `/me` | 当前用户信息 |
| PUT | `/profile` | 更新头像色/自定义状态/简介 |
| POST | `/avatar` | 上传用户头像（base64，≤2MB，v4.1） |
| DELETE | `/avatar` | 删除用户头像，恢复字母头像（v4.1） |
| GET | `/dm/list/all` | DM 列表 |
| POST | `/dm/:targetUserId` | 创建/获取 DM 频道 |
| GET | `/:id` | 指定用户详情 |

### 频道 `/api/channels`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 频道列表 |
| POST | `/` | 创建频道 |
| GET | `/:id` | 频道详情 |
| PUT | `/:id` | 更新频道（名称/描述/话题/慢速模式） |
| GET | `/:id/pins` | 置顶消息列表 |

### 消息 `/api/messages`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/channel/:channelId` | 频道消息（支持分页） |
| GET | `/dm/:dmChannelId` | DM 消息 |
| GET | `/search` | 全局搜索（跨频道） |
| GET | `/mentions` | @提及当前用户的消息 |
| GET | `/:id/thread` | 话题线程回复 |
| GET | `/link-preview` | URL 链接预览（含 og: 解析+缓存） |
| GET | `/export` | 消息导出（TXT/JSON，最多 5000 条） |

### 书签 `/api/bookmarks`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 书签列表 |
| POST | `/` | 添加书签 |
| DELETE | `/:messageId` | 删除书签 |
| GET | `/check/:messageId` | 检查是否已收藏 |

### 频道分类 `/api/categories`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 分类列表 |
| POST | `/` | 创建分类 |
| PUT | `/:id` | 重命名分类 |
| DELETE | `/:id` | 删除分类 |
| PUT | `/assign/:channelId` | 指定频道归属分类 |

### Webhook `/api/webhooks`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/channel/:channelId` | 频道的 Webhook 列表 |
| POST | `/channel/:channelId` | 创建 Webhook |
| DELETE | `/:id` | 删除 Webhook |
| POST | `/incoming/:token` | **外部调用入口**，发送消息到频道 |

### 系统
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 服务健康状态 |
| GET | `/api/stats` | 详细统计（在线人数、消息数等） |

### 静态资源
| 路径 | 说明 |
|------|------|
| `/uploads/avatars/:filename` | 用户头像图片（Express static，v4.1） |
| `/assets/*` | 前端 Vite 构建产物 |

---

## WebSocket 事件

### 客户端 → 服务端
| 事件 | 参数 | 说明 |
|------|------|------|
| `join_channel` | channelId | 加入频道房间 |
| `leave_channel` | channelId | 离开频道房间 |
| `join_thread` | threadParentId | 加入话题线程房间 |
| `leave_thread` | threadParentId | 离开话题线程房间 |
| `send_message` | channelId/dmChannelId, content, type, replyTo, tempId, threadParentId | 发送消息 |
| `edit_message` | messageId, content | 编辑消息 |
| `delete_message` | messageId | 删除消息 |
| `pin_message` | messageId | 置顶消息 |
| `unpin_message` | messageId | 取消置顶 |
| `get_pinned_messages` | channelId | 获取置顶列表 |
| `add_reaction` | messageId, emoji | 添加 Emoji 反应 |
| `remove_reaction` | messageId, emoji | 删除 Emoji 反应 |
| `typing_start` | channelId/dmChannelId | 开始输入 |
| `typing_stop` | channelId/dmChannelId | 停止输入 |
| `mark_read` | channelId | 标记已读 |
| `dm_mark_read` | dmChannelId, messageId | DM 已读 |
| `update_channel` | channelId, name, description, topic, slowModeSeconds | 更新频道设置 |
| `profile_updated` | avatarColor, customStatus, bio, avatarUrl | 更新用户资料（v4.1 加 avatarUrl） |
| `schedule_message` | channelId/dmChannelId, content, scheduledAt | 创建定时消息（v4.3） |
| `cancel_scheduled` | scheduledMessageId | 取消定时消息（v4.3） |
| `list_scheduled` | channelId | 查询频道待发定时消息（v4.3） |
| `webrtc_call_offer` | targetUserId, offer, callType | 发起 WebRTC 通话（v4.0） |
| `webrtc_call_answer` | targetUserId, answer | 回应通话（v4.0） |
| `webrtc_call_ice_candidate` | targetUserId, candidate | 传递 ICE candidate（v4.0） |
| `webrtc_hangup` | targetUserId | 挂断通话（v4.0） |
| `webrtc_reject` | targetUserId | 拒绝来电（v4.0） |

### 服务端 → 客户端
| 事件 | 说明 |
|------|------|
| `message_ack` | 消息发送成功确认（含 tempId→realId 映射） |
| `message_fail` | 消息发送失败（含原因） |
| `new_message` | 广播新消息（定时消息带 `isScheduled: true`） |
| `message_edited` | 广播消息编辑 |
| `message_deleted` | 广播消息删除 |
| `reaction_updated` | 广播 Emoji 反应变更 |
| `reaction_received` | 他人对你的消息点了反应（用于通知） |
| `pinned_messages` | 置顶消息列表 |
| `message_pinned` / `message_unpinned` | 置顶状态变更 |
| `typing` | 正在输入状态 |
| `user_connected` / `user_disconnected` | 在线状态变化 |
| `online_users` | 当前在线用户列表 |
| `dm_read` | DM 已读通知 |
| `channel_updated` | 频道信息更新 |
| `user_profile_changed` | 用户资料变更广播（含 avatarUrl，v4.1） |
| `scheduled_messages` | 频道定时消息列表（v4.3） |
| `scheduled_delivered` | 定时消息发送成功通知给发送者（v4.3） |
| `webrtc_call_incoming` | 收到通话请求（v4.0） |
| `webrtc_call_answered` | 对方接听（v4.0） |
| `webrtc_ice_candidate` | 收到 ICE candidate（v4.0） |
| `webrtc_call_ended` | 通话结束（v4.0） |
| `webrtc_call_rejected` | 来电被拒绝（v4.0） |
| `webrtc_call_failed` | 通话发起失败（对方离线，v4.0） |

---

## 前端组件列表

### Chat 区域
| 组件 | 说明 |
|------|------|
| `ChatArea.jsx` | 聊天区域主容器 |
| `ChatHeader.jsx` | 频道头部（含搜索、媒体画廊、Webhook 管理、导出、定时消息入口） |
| `MessageList.jsx` | 消息列表（虚拟滚动 `@tanstack/react-virtual`、无限上滚加载、滚动位置记忆） |
| `MessageItem.jsx` | 单条消息（含 Markdown 渲染、代码块复制、@高亮、链接预览、长消息折叠、线程徽章、已读回执） |
| `MessageInput.jsx` | 输入框（含草稿持久化、字数限制 2000、慢速模式倒计时、定时发送 🕐 按钮） |
| `FilePreviewPanel.jsx` | 多图预览面板（粘贴/拖拽多图缩略图确认，v4.2） |
| `GifPicker.jsx` | GIF 选择器（Tenor API，trending/搜索，双列瀑布流，v4.4） |
| `ScheduledMessagesPanel.jsx` | 定时消息列表面板（查看/取消待发消息，v4.3） |
| `EmojiPicker.jsx` | Emoji 选择器 |
| `ContextMenu.jsx` | 消息右键上下文菜单 |
| `ThreadPanel.jsx` | 话题线程侧边面板 |
| `LinkPreviewCard.jsx` | URL 链接预览卡片 |
| `AudioPlayer.jsx` | 语音消息播放器（含变速） |
| `VoiceRecorder.jsx` | 语音录制界面（含波形动画） |
| `VoiceCallModal.jsx` | WebRTC 通话弹窗（语音/视频，含来电铃声、通话计时，v4.0） |
| `MediaGallery.jsx` | 媒体画廊（图片网格 + 灯箱） |
| `SearchResults.jsx` | 全局搜索结果（跨频道分组 + 关键词高亮） |
| `ForwardModal.jsx` | 消息转发弹窗 |
| `UserProfileCard.jsx` | 用户资料卡片 |

### 侧边栏
| 组件 | 说明 |
|------|------|
| `Sidebar.jsx` | 侧边栏主容器（移动端触控抽屉，v4.0） |
| `ChannelList.jsx` | 频道列表（含分类折叠、通知偏好右键菜单） |
| `DMList.jsx` | 私信列表 |
| `MemberSidebar.jsx` | 成员列表侧边栏 |
| `MentionsList.jsx` | @提及视图 Tab |
| `UserList.jsx` | 用户列表 |

### 通用组件
| 组件 | 说明 |
|------|------|
| `Avatar.jsx` | 头像（支持 avatar_url 图片、在线状态绿点，v4.1） |
| `BookmarkPanel.jsx` | 书签面板 |
| `CommandPalette.jsx` | 命令面板（`Ctrl+K` 唤出） |
| `KeyboardShortcuts.jsx` | 快捷键说明弹窗 |
| `ToastContainer.jsx` | 全局 Toast 通知（info/success/error/warning/reaction/mention 6种类型） |
| `UserSettingsModal.jsx` | 用户设置弹窗（账号安全/通知/外观 Tab，含头像上传，v4.1） |

---

## 功能清单（已完成）

### 核心通讯
- [x] 用户注册/登录（JWT 认证）
- [x] 频道聊天（实时 WebSocket）
- [x] 私信（DM）
- [x] 消息 ACK 机制（发送成功/失败确认，失败可一键重试）
- [x] 消息编辑 / 删除
- [x] 消息回复（引用）
- [x] 话题线程（Thread Panel，类 Discord）
- [x] Emoji 反应（含粒子爆炸动画）
- [x] 消息置顶
- [x] 消息转发
- [x] 消息书签收藏
- [x] 消息导出（TXT / JSON）
- [x] DM 已读回执（✓ 标记）
- [x] 语音/视频通话（WebRTC 一对一，v4.0）
- [x] 定时消息（v4.3）
- [x] GIF 支持（Tenor API，双列瀑布流搜索，v4.4）

### 用户体验
- [x] 正在输入状态提示
- [x] 消息草稿持久化（切换频道不丢内容）
- [x] 消息字数限制（2000 字，接近上限变色提示）
- [x] 消息长内容折叠（800字+自动折叠，点击展开）
- [x] 滚动位置记忆（切换频道后恢复位置）
- [x] 虚拟滚动（@tanstack/react-virtual，大量消息时性能优化）
- [x] 无限上滚加载（分页加载历史消息）
- [x] 消息入场动画（slideIn + fade）
- [x] @提及高亮（自己的 @更醒目）
- [x] 浏览器通知（页面隐藏时推送，含去重）
- [x] 消息提醒音效（Web Audio API 合成，@提及单独音调）
- [x] 代码块一键复制
- [x] URL 链接预览卡片（og: 解析，双层缓存）
- [x] 图片上传前压缩（Canvas，最大 1280px）
- [x] 多图粘贴/拖拽预览队列确认后发送（v4.2）
- [x] 语音消息录制（MediaRecorder API，含波形动画、变速播放）
- [x] 右键上下文菜单（含快捷 Emoji 反应行）
- [x] 全局 Toast 通知系统（6 种类型，进度条动画）

### 频道管理
- [x] 频道分类（Category，侧边栏折叠展示）
- [x] 频道通知偏好（全部/仅@/静音，右键设置）
- [x] 频道慢速模式（5s/10s/30s/1min/5min，前端倒计时）
- [x] 频道话题（Topic）设置
- [x] Webhook 支持（创建/管理/外部 POST 发消息，Bot 徽章）
- [x] 媒体画廊（频道内所有图片网格展示，灯箱预览）

### 搜索 & 导航
- [x] 全局跨频道消息搜索（按频道分组，关键词高亮，点击跳转+高亮定位）
- [x] @提及聚合视图（侧边栏 🔔 Tab）
- [x] 命令面板（`Ctrl+K` 快速跳转频道/DM）
- [x] 键盘快捷键（含快捷键说明弹窗）

### 个性化
- [x] 主题系统（Discord 暗色 / 浅色 / 午夜 / 海洋，4 套，实时无闪烁切换）
- [x] 字体大小（3 档：13/15/17px）
- [x] 消息密度（3 档：紧凑/舒适/宽松）
- [x] 用户自定义状态 / 个人简介
- [x] 用户头像图片上传（v4.1）
- [x] 在线状态指示（头像绿点）
- [x] 通知偏好设置（音效开关、桌面通知授权）

### 移动端（v4.0）
- [x] iOS 安全区域支持（viewport-fit=cover + env safe-area-inset）
- [x] apple-mobile-web-app-capable PWA 支持
- [x] 格式工具栏移动端折叠（`Aa ▲` 按钮展开）
- [x] 触控侧边栏抽屉（滑动手势）
- [x] 触控按钮最小高度 36px / 动量滚动

### 系统
- [x] 服务端速率限制（每用户 10s 内最多 20 条）
- [x] 健康检查 API（`/api/health` + `/api/stats`）
- [x] Tab 标题未读计数

---

## 已知问题 / TODO

### 中优先级
- [ ] **GIF 支持**：~~集成 Tenor 或 Giphy API，在 Emoji Picker 旁加 GIF 入口~~ ✅ 已完成 v4.4
- [ ] **频道权限管理**：只读频道、仅管理员发言等权限控制
- [ ] **i18n 多语言**：前端国际化支持

### 低优先级
- [ ] **数据库维护**：定时 WAL checkpoint + VACUUM，防止 db 文件无限增长
- [ ] **WebSocket 心跳监控**：服务端统计 ping 延迟，超时主动清理
- [ ] **无障碍访问（ARIA）**：补充 ARIA 标签，提升可访问性
- [ ] **消息翻译**：集成翻译 API，一键翻译消息内容
- [ ] **上下文溢出优化**：cron 迭代任务 prompt 过长，可进一步精简

---

## 部署指南

### 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | ≥ 18.0 | 推荐 v20 LTS |
| npm | ≥ 9.0 | 随 Node.js 自带 |
| 磁盘空间 | ≥ 500 MB | 含 node_modules |
| 内存 | ≥ 512 MB | 建议 1 GB+ |
| 操作系统 | Linux / macOS / Windows | Linux 推荐 |

### 快速部署（本地 / 单机）

```bash
# 1. 进入项目目录
cd /home/jumpserver/.openclaw/workspace/jarvis-im

# 2. 一键启动（会自动安装依赖并构建）
chmod +x start.sh
./start.sh

# 访问 http://localhost:3000
```

`start.sh` 会依次执行：
1. 安装后端依赖（`server/npm install`）
2. 启动后端服务（`node server.js`，后台运行）
3. 安装前端依赖（`client/npm install`）
4. 构建前端（`npm run build`）
5. 前端产物由后端 Express 静态托管

### 手动分步部署

#### 1. 部署后端

```bash
cd server
npm install

# 生产环境启动
NODE_ENV=production node server.js

# 或使用 pm2（进程守护，推荐生产使用）
npm install -g pm2
pm2 start server.js --name jarvis-im-server
pm2 save
pm2 startup   # 设置开机自启
```

#### 2. 构建前端

```bash
cd client
npm install

# 生产构建
npm run build
# 产物输出到 client/dist/，由后端 server.js 静态托管
```

#### 3. 前端开发模式（热重载）

```bash
cd client
npm run dev
# 访问 http://localhost:5173（会 proxy 到后端 3000）
```

### 进程守护（PM2）

```bash
# 安装 pm2
npm install -g pm2

# 启动服务
cd server
pm2 start server.js --name jarvis-im

# 常用命令
pm2 status          # 查看进程状态
pm2 logs jarvis-im  # 查看实时日志
pm2 restart jarvis-im
pm2 stop jarvis-im
pm2 delete jarvis-im

# 开机自启配置
pm2 save
pm2 startup
```

### 反向代理（Nginx）

适用于生产环境，将 80/443 流量代理到本地 3000 端口：

```nginx
server {
    listen 80;
    server_name im.yourdomain.com;

    # 强制 HTTPS（推荐）
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name im.yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # WebSocket 支持（Socket.io 必须）
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # 上传文件（头像等）
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        client_max_body_size 10m;
    }

    # API + 前端静态资源
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> ⚠️ **WebRTC 注意**：语音/视频通话要求 HTTPS 环境（浏览器安全策略限制 `getUserMedia`）。本地开发可用 localhost 豁免，生产必须配 SSL。

### 环境变量

服务端支持以下环境变量（可在启动前设置或写入 `.env`）：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `JWT_SECRET` | `jarvis-im-secret-key` | JWT 签名密钥，**生产必须修改** |
| `NODE_ENV` | `development` | 运行环境（production/development） |
| `DB_PATH` | `./messages.db` | SQLite 数据库文件路径 |
| `UPLOAD_DIR` | `./uploads` | 头像文件上传目录 |

```bash
# 示例：生产启动
PORT=3000 JWT_SECRET=your-super-secret-key NODE_ENV=production node server.js
```

### 数据持久化

| 数据 | 位置 | 说明 |
|------|------|------|
| 数据库 | `server/messages.db` | SQLite 文件，包含所有消息、用户、频道数据 |
| 用户头像 | `server/uploads/avatars/` | PNG/JPEG 图片文件 |

**备份建议：**

```bash
# 备份数据库
cp server/messages.db server/messages.db.bak.$(date +%Y%m%d)

# 备份头像
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz server/uploads/
```

### Docker 部署（可选）

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app

# 安装后端依赖
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# 安装前端依赖并构建
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# 复制服务端源码
COPY server/ ./server/

# 创建上传目录
RUN mkdir -p server/uploads/avatars

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  jarvis-im:
    build: .
    ports:
      - "3000:3000"
    environment:
      - JWT_SECRET=your-super-secret-key
      - NODE_ENV=production
    volumes:
      - ./data/messages.db:/app/server/messages.db
      - ./data/uploads:/app/server/uploads
    restart: unless-stopped
```

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 健康检查

```bash
# 检查服务状态
curl http://localhost:3000/api/health

# 查看详细统计
curl http://localhost:3000/api/stats
```

返回示例：
```json
{
  "status": "ok",
  "uptime": 3600,
  "onlineUsers": 5,
  "totalMessages": 1234,
  "totalUsers": 20,
  "totalChannels": 8
}
```

### 常见问题排查

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| 3000 端口被占用 | 其他进程占用 | `lsof -i :3000` 查找并 kill，或修改 PORT 环境变量 |
| WebSocket 连接失败 | Nginx 未配置 Upgrade | 检查 Nginx 配置中的 WebSocket headers |
| 头像上传失败 | uploads 目录权限问题 | `chmod 755 server/uploads/avatars` |
| WebRTC 无法通话 | 非 HTTPS 环境 | 生产环境必须配 SSL；本地用 localhost |
| 数据库锁定错误 | 多进程访问 SQLite | 确保只启动一个 server.js 实例 |
| 前端白屏 | 未执行 build | `cd client && npm run build` |

---

## 启动方式汇总

```bash
# 一键启动（推荐，开发/测试）
cd /home/jumpserver/.openclaw/workspace/jarvis-im
bash start.sh

# 仅启动后端（已有构建产物时）
cd server && node server.js

# 前端开发热重载
cd client && npm run dev

# 生产（PM2）
cd server && pm2 start server.js --name jarvis-im
```
