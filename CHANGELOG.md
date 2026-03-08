# Changelog

## [v4.4] 2026-03-08

---

### v4.4.0（20:29）
- **GIF 支持**：
  - 输入框新增 `GIF` 按钮，点击弹出 GIF 选择器面板
  - 新增 `GifPicker.jsx` 组件：双列瀑布流布局，实时搜索防抖（400ms）
  - 接入 Tenor API v1：默认展示 Trending GIFs，支持中文关键词搜索
  - 加载状态：旋转动画 + 错误重试按钮，空结果友好提示
  - GIF 选择后以 `type: 'gif'` 消息格式发送（content 存 Tenor CDN URL）
  - `MessageItem.jsx` 新增 GIF 类型渲染：展示动态图 + 左下角 `GIF` 徽章
  - GIF 消息支持点击灯箱预览（复用 ImageLightbox）
  - `MediaGallery.jsx` 画廊支持 GIF 类型消息（`type === 'gif'` 纳入展示）
  - GIF/Emoji/定时发送三个弹出面板互斥（打开一个自动关闭其他）
  - 底部提示文案更新，加入 🎬 GIF 快捷操作说明
  - Bundle：464.3 KB JS / 41.5 KB CSS（+5.5 KB）

## [v4.3] 2026-03-08

---

### v4.3.0（19:29）
- **消息调度（定时发送）**：
  - 输入框新增 🕐 按钮，点击弹出定时发送面板
  - `datetime-local` 原生时间选择器，最小值自动设为当前时间 +1 分钟
  - 发送前实时预览消息内容，内容为空时给出明确提示
  - 前端校验：定时时间必须至少在 1 分钟之后
  - Socket 事件：`schedule_message`（创建）/ `cancel_scheduled`（取消）/ `list_scheduled`（查询）
  - 服务端每 15 秒轮询一次到期消息，自动存入 messages 表并广播 `new_message`（带 `isScheduled: true` 标记）
  - 定时消息到达时向发送者广播 `scheduled_delivered` 事件（实时更新面板计数）
  - 新增 `ScheduledMessagesPanel.jsx`：查看/取消当前频道的待发定时消息列表
  - ChatHeader 顶栏新增 🕐 入口按钮，角标显示当前频道待发数量
  - 数据库新增 `scheduled_messages` 表（11 列，含 status pending/sent/cancelled）
  - 新增 `scheduledMessageOps`（create / getPending / markSent / cancel / findByUser）
  - Bundle：458.8 KB JS / 40.9 KB CSS（+7.8 KB）

## [v4.2] 2026-03-08

---

### v4.2.0（18:29）
- **多图粘贴/拖拽预览发送**：
  - `Ctrl+V` 粘贴图片时，收集剪贴板内所有图片（含多图同时粘贴场景），进入预览队列而非立即发送
  - 拖拽多张图片到输入框同样进入预览队列（不再逐张立即发送）
  - 文件上传按钮支持 `multiple` 多选，批量加入预览队列
  - 新增 `FilePreviewPanel` 组件：展示待发图片缩略图 80×80，角标显示文件大小（KB）
  - 每张缩略图右上角 ✕ 按钮可单独移除；底部「清空全部」按钮一键清空队列
  - 发送按钮文案自适应：有待发图片时显示「发送 (N图)」，回车键同样触发发送全部
  - 发送顺序：先发文字，再依次发送各张图片（各自独立消息）
  - Object URL 生命周期管理：移除/清空/切换频道时自动 `revokeObjectURL`，防止内存泄漏
  - 拖拽提示文案更新为「支持多图」
  - Bundle：451 KB JS / 40.7 KB CSS（+5 KB，纯前端组件）

## [v4.1] 2026-03-08

---

### v4.1.0（17:35）
- **用户头像上传**：支持自定义图片头像，替代原来仅支持颜色的字母头像
  - 设置弹窗头像区域新增悬停遮罩 + 📷 图标，点击可选择图片文件
  - 客户端 Canvas 压缩（最大 256×256，JPEG 0.88 质量），减小传输体积
  - 服务端 `POST /api/users/avatar`：接收 base64 数据，验证格式/大小（≤2MB），保存为文件
  - 服务端 `DELETE /api/users/avatar`：删除图片文件并清空记录，恢复颜色字母头像
  - 静态文件服务：`/uploads/avatars/` 路径，Express `express.static` 托管
  - `Avatar.jsx` 支持 `avatar_url` 优先展示图片，`<img>` onError 自动 fallback 到颜色头像
  - Socket 广播 `user_profile_changed` 携带 `avatarUrl`，实时同步其他在线用户的头像显示
  - `useChatStore.updateUserProfile` 支持 `avatarUrl` 字段更新
  - 数据库迁移：`users` 表新增 `avatar_url TEXT` 列（兼容性 ALTER TABLE）

## [v4.0] 2026-03-08

---

### v4.0.0（17:30）
- **移动端适配完善**：
  - iOS 安全区域支持：`viewport-fit=cover` + `env(safe-area-inset-*)` 防止内容被刘海/Home条遮挡
  - `apple-mobile-web-app-capable` PWA 支持，状态栏黑色透明
  - 格式工具栏移动端折叠：小屏下默认收起，点击 `Aa ▲` 按钮展开，节省垂直空间
  - 输入区底部安全区 padding（`.safe-area-bottom` 工具类）
  - 触控按钮最小高度 36px，`-webkit-overflow-scrolling: touch` 动量滚动
- **WebRTC 一对一通话**（`useCallStore` + `VoiceCallModal` + 服务端信令）：
  - 支持语音通话和视频通话（DM 频道顶栏新增 📞/📹 按钮）
  - 完整 ICE 协商：STUN 打洞（Google stun:stun.l.google.com:19302）
  - 来电铃声 UI：脉冲头像动画 + 铃声图标抖动 + 接听/拒绝按钮
  - 通话中控制：静音/取消静音、视频开/关、挂断、通话计时
  - 视频通话：大画面显示对方，右下角 PIP 显示本人（镜像）
  - 自动处理 ICE candidate 积压（等待 remoteDescription 后统一添加）
  - 服务端新增 5 个 WebRTC 信令 Socket 事件：`webrtc_call_offer / answer / ice_candidate / hangup / reject`
  - 对方离线时发送失败通知（`webrtc_call_failed`）
  - 挂断/拒绝时 Toast 提示

## [v2.3+] 2026-03-07

> 今日共完成 10+ 轮迭代（v2.1 → v2.3.0），以下为各版本功能汇总。

---

### v2.3.0（20:53）
- **前端图片压缩**：上传前 Canvas 压缩至 1280px / 质量 0.82，最大支持 10MB
- **消息字数限制（2000字）**：接近上限变色预警，超限禁用发送
- **Reaction 用户气泡 Tooltip**：hover 反应按钮展示具名用户列表
- **滚动位置记忆**：切换频道精确恢复位置，有新消息才跳底部
- **服务端健康检查 API**：`/api/health` + `/api/stats`（运行时长、在线数、消息统计）
- **用户设置-服务器状态面板**：账号 Tab 底部集成实时服务器状态卡

---

### v1.7（18:43）
- **浏览器通知修复**：仅在页面隐藏时推送，加 tag 去重 + 5秒自动关闭
- **Avatar 在线状态绿点**：主消息头像启用 showStatus，在线绿/离线灰
- **消息反应动画优化**：hover/active 缩放、等宽数字防跳动
- **长消息折叠（CollapsibleMessageContent）**：超 800 字/20 行自动折叠，渐变遮罩 + 展开按钮

---

### v1.5（17:43）
- **语音消息（Voice Messages）**：麦克风录制（最长 2min），实时波形动画，AudioPlayer 支持 1x/1.5x/2x 变速
- **Emoji 反应爆炸动画（Reaction Burst）**：点击时 6 颗粒子飞散，CSS 动画，无性能影响
- **慢速模式（Slow Mode）**：频道级冷却（5s~5min），前端倒计时，服务端 per-user 校验

---

### v3.5（15:52）
- **Webhook 机器人支持**：`webhooks` 表 + `/api/webhooks` CRUD + `/incoming/:token` 外部发消息接口，ChatHeader Webhook 管理弹窗，Bot 消息显示蓝色徽章
- **消息导出**：`/api/messages/export`，支持 TXT/JSON，最多 5000 条
- **通知偏好 UI 确认**：频道级通知与 useSocket 通知逻辑联动确认
- **Tab 标题未读计数确认**：DocumentTitle 组件正确实现

---

### v2.4（16:50）
- **右键上下文菜单**：含快捷 Emoji 反应行，自动防溢出，操作覆盖回复/转发/收藏/固定/编辑/删除
- **全局 Toast 通知系统**：右下角滑入，6 种类型（info/success/error/warning/reaction/mention），进度条 + 最多 5 条
- **代码块复制按钮**：悬浮时右上角出现，点击后 2 秒恢复
- **媒体画廊**：4 列瀑布网格 + 灯箱（键盘切换、缩略图导航条、下载）
- **消息反应 Toast 通知**：他人反应你的消息时应用内弹出通知

---

### v2.3（14:55）
- **话题/线程系统（Thread Panel）**：右侧滑入面板，父消息置顶，实时 WebSocket 同步，消息徽章显示回复数+参与者
- **数据库升级**：`thread_parent_id` 列+索引，`dm_read_receipts` 表，索引总数升至 14
- **DM 已读回执**：打开 DM 自动 emit，对方收到 ✓ 蓝色标记

---

### v2.3（13:43）
- **主题系统（4套）**：CSS 变量全量迁移，Discord 暗色/浅色/午夜/海洋，无闪烁实时切换
- **外观设置 Tab**：主题选择器（色板预览）、字体大小（3档）、消息密度（3档），localStorage 持久化
- **频道通知右键菜单**：右键弹出全部/仅@/静音三档，已静音频道显示 🔕 图标

---

### v2.2（12:43）
- **URL 链接预览卡片**：og: 标签解析，双层缓存（内存 10min + 服务端）
- **消息提醒音效**：Web Audio API 合成，零依赖，@提及独立音调，用户设置可开关
- **@提及聚合视图**：侧边栏 🔔 Tab，一键跳转+高亮定位
- **服务端速率限制**：每用户 10s 内最多 20 条消息

---

### v2.1（05:31）
- **频道分类系统**：`channel_categories` 表，侧边栏按分类折叠展示
- **@提及高亮渲染**：消息内 @username 蓝色标签，@自己更醒目
- **消息入场动画**：新消息 slideIn 0.18s ease-out
- **消息草稿持久化**：切换频道自动保存/恢复，localStorage 存储

---

## [v2.0] 2026-03-06（历史基础版本）

初始完整功能版本，包含：
- 用户注册/登录（JWT）
- 频道聊天 + DM
- 消息 ACK 机制
- 无限上滚分页加载
- Emoji 反应
- 消息置顶/转发/书签
- 全局搜索
- 命令面板（Ctrl+K）
- 键盘快捷键
- 用户自定义状态/简介
- 骨架屏加载动画
