/**
 * server.js - Jarvis IM 主服务器
 * Express + Socket.io + SQLite (node-sqlite3-wasm)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { initDatabase, userOps, channelOps, dmOps, messageOps, reactionOps, pinOps, categoryOps, bookmarkOps, dmReadOps, webhookOps, scheduledMessageOps, getMessageReactions, db } = require('./database');
const { socketAuthMiddleware } = require('./middleware/auth');

// 路由
const authRouter = require('./routes/auth');
const channelsRouter = require('./routes/channels');
const messagesRouter = require('./routes/messages');
const usersRouter = require('./routes/users');
const categoriesRouter = require('./routes/categories');
const bookmarksRouter = require('./routes/bookmarks');
const webhooksRouter = require('./routes/webhooks');

const PORT = process.env.PORT || 3000;

// 初始化数据库
initDatabase();

const app = express();
const httpServer = http.createServer(app);

// Socket.io 配置
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB（支持图片传输）
});

// ==================== Express 中间件 ====================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件（上传的头像等）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== 健康检查 & 统计 API ====================

const SERVER_START_TIME = Date.now()
const SERVER_VERSION = '2.4.0'

app.get('/api/health', (req, res) => {
  const uptimeSecs = Math.floor((Date.now() - SERVER_START_TIME) / 1000)
  const hours = Math.floor(uptimeSecs / 3600)
  const minutes = Math.floor((uptimeSecs % 3600) / 60)
  const seconds = uptimeSecs % 60

  res.json({
    status: 'ok',
    version: SERVER_VERSION,
    uptime: uptimeSecs,
    uptimeHuman: `${hours}h ${minutes}m ${seconds}s`,
    onlineUsers: onlineUsers.size,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/stats', (req, res) => {
  try {
    // 数据库统计
    const totalUsers = db?.get('SELECT COUNT(*) as cnt FROM users')?.cnt ?? 0
    const totalMessages = db?.get('SELECT COUNT(*) as cnt FROM messages WHERE is_deleted = 0')?.cnt ?? 0
    const totalChannels = db?.get('SELECT COUNT(*) as cnt FROM channels')?.cnt ?? 0
    const totalReactions = db?.get('SELECT COUNT(*) as cnt FROM reactions')?.cnt ?? 0
    const totalImages = db?.get('SELECT COUNT(*) as cnt FROM messages WHERE type = ?', ['image'])?.cnt ?? 0
    const msgToday = db?.get(
      "SELECT COUNT(*) as cnt FROM messages WHERE date(created_at) = date('now') AND is_deleted = 0"
    )?.cnt ?? 0

    res.json({
      server: {
        version: SERVER_VERSION,
        uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
        onlineUsers: onlineUsers.size,
      },
      database: {
        totalUsers,
        totalMessages,
        totalChannels,
        totalReactions,
        totalImages,
        messagesPublishedToday: msgToday,
      },
    })
  } catch (err) {
    console.error('[Stats] error:', err)
    res.status(500).json({ error: 'stats unavailable' })
  }
})

// API 路由
app.use('/api/auth', authRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/webhooks', webhooksRouter);

// 将 io 实例注入 app，供 webhooks 路由广播消息
app.set('io', io);

// 托管前端静态文件（生产环境）
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback - 所有非 API 请求返回 index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <html><body style="background:#1e1f22;color:#dcddde;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <div style="font-size:4rem">🤖</div>
            <h1>Jarvis IM 后端运行中</h1>
            <p>请先构建前端：cd client && npm run build</p>
            <p>或使用开发模式：cd client && npm run dev</p>
          </div>
        </body></html>
      `);
    }
  });
});

// ==================== 工具函数 ====================

// 消息速率限制：每用户每 10 秒最多 20 条
const rateBuckets = new Map(); // userId -> { count, resetAt }

// 慢速模式：记录每用户每频道最后发送时间
// key: `${userId}:${channelId}`, value: timestamp (ms)
const slowModeLastSent = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(userId, { count: 1, resetAt: now + 10000 });
    return true;
  }
  if (bucket.count >= 20) return false;
  bucket.count++;
  return true;
}

// 定期清理过期桶（每分钟）
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets.entries()) {
    if (now > v.resetAt) rateBuckets.delete(k);
  }
}, 60000);

function formatMessage(message, replyTo = null) {
  let replyContent = null;
  let replyUsername = null;
  if (replyTo) {
    const replyMsg = messageOps.findById(replyTo);
    if (replyMsg) {
      replyContent = replyMsg.content;
      replyUsername = replyMsg.username;
    }
  }

  // 获取线程统计（如果是频道消息且不是线程回复本身）
  let threadStats = null;
  if (message.channel_id && !message.thread_parent_id) {
    const stats = messageOps.getThreadStats(message.id);
    if (stats.replyCount > 0) {
      threadStats = stats;
    }
  }

  return {
    id: message.id,
    channelId: message.channel_id,
    dmChannelId: message.dm_channel_id,
    senderId: message.sender_id,
    username: message.username,
    avatarColor: message.avatar_color,
    content: message.content,
    type: message.type,
    replyTo: message.reply_to,
    threadParentId: message.thread_parent_id || null,
    replyContent,
    replyUsername,
    isEdited: !!message.is_edited,
    isDeleted: !!message.is_deleted,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
    reactions: [],
    threadStats,
  };
}

// ==================== Socket.io 实时通信 ====================

// 在线用户 Map: userId -> socketId
const onlineUsers = new Map();
// 正在输入用户: channelKey -> Set<userId>
const typingUsers = new Map();

// Socket 认证中间件
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`[Socket] 用户上线: ${user.username} (${socket.id})`);

  // 更新用户状态为在线
  onlineUsers.set(user.id, socket.id);
  userOps.updateStatus('online', user.id);

  // 通知所有人该用户上线
  io.emit('user_status_changed', { userId: user.id, status: 'online' });

  // 发送当前在线用户列表给新连接的用户
  const onlineUserIds = Array.from(onlineUsers.keys());
  socket.emit('online_users', onlineUserIds);

  // ==================== 频道事件 ====================

  socket.on('join_channel', ({ channelId }) => {
    const roomName = `channel:${channelId}`;
    socket.join(roomName);
    // 确保用户是频道成员
    if (typeof channelId === 'number' || /^\d+$/.test(String(channelId))) {
      channelOps.addMember(user.id, parseInt(channelId));
    }
  });

  socket.on('leave_channel', ({ channelId }) => {
    socket.leave(`channel:${channelId}`);
  });

  // ==================== Thread 事件 ====================

  socket.on('join_thread', ({ threadParentId }) => {
    socket.join(`thread:${threadParentId}`);
  });

  socket.on('leave_thread', ({ threadParentId }) => {
    socket.leave(`thread:${threadParentId}`);
  });

  // ==================== DM 已读回执 ====================

  socket.on('dm_mark_read', ({ dmChannelId, messageId }) => {
    try {
      dmReadOps.markRead(dmChannelId, user.id, messageId);
      // 通知 DM 频道的另一方
      const dmChannel = dmOps.findById(dmChannelId);
      if (dmChannel) {
        const otherUserId = dmChannel.user1_id === user.id ? dmChannel.user2_id : dmChannel.user1_id;
        const otherSocket = onlineUsers.get(otherUserId);
        if (otherSocket) {
          io.to(otherSocket).emit('dm_read_receipt', {
            dmChannelId,
            userId: user.id,
            lastReadMessageId: messageId,
          });
        }
      }
    } catch (err) {
      console.error('[Socket] dm_mark_read error:', err);
    }
  });

  socket.on('update_channel', ({ channelId, name, description, topic, slowModeSeconds }) => {
    try {
      channelOps.update(channelId, user.id, { name, description, topic, slowModeSeconds });
      const channel = channelOps.findById(channelId);
      if (channel) {
        io.to(`channel:${channelId}`).emit('channel_updated', channel);
        // 同步更新所有连接用户的频道列表
        io.emit('channel_updated', channel);
      }
    } catch (err) {
      console.error('[Socket] update_channel error:', err);
    }
  });

  // ==================== 消息事件 ====================

  socket.on('send_message', ({ channelId, dmChannelId, content, type = 'text', replyTo, tempId, threadParentId }) => {
    try {
      if (!content && type === 'text') return;
      if (!channelId && !dmChannelId) return;

      // 速率限制检查
      if (!checkRateLimit(user.id)) {
        socket.emit('message_fail', { tempId, error: '发送太频繁，请稍候再试' });
        return;
      }

      // 慢速模式检查（仅频道消息，非线程消息）
      if (channelId && !threadParentId) {
        const channel = channelOps.findById(channelId);
        const slowSecs = channel?.slow_mode_seconds || 0;
        if (slowSecs > 0) {
          const smKey = `${user.id}:${channelId}`;
          const lastSent = slowModeLastSent.get(smKey) || 0;
          const elapsed = (Date.now() - lastSent) / 1000;
          if (elapsed < slowSecs) {
            const remaining = Math.ceil(slowSecs - elapsed);
            socket.emit('message_fail', { tempId, error: `慢速模式：请等待 ${remaining} 秒后再发送` });
            return;
          }
          slowModeLastSent.set(smKey, Date.now());
        }
      }

      // 保存消息到数据库（支持 threadParentId）
      const result = messageOps.create(
        channelId || null,
        dmChannelId || null,
        user.id,
        content,
        type,
        replyTo || null,
        threadParentId || null
      );

      const messageId = result.lastInsertRowid;
      const message = messageOps.findById(messageId);
      const formattedMessage = { ...formatMessage(message, replyTo), tempId };

      if (threadParentId) {
        // 线程消息：广播到线程房间
        const threadRoom = `thread:${threadParentId}`;
        socket.to(threadRoom).emit('new_thread_message', formattedMessage);

        // 同时通知频道中的所有人：线程有新回复（更新 threadStats）
        const parentMsg = messageOps.findById(threadParentId);
        if (parentMsg?.channel_id) {
          const stats = messageOps.getThreadStats(threadParentId);
          io.to(`channel:${parentMsg.channel_id}`).emit('thread_stats_updated', {
            messageId: threadParentId,
            threadStats: stats,
          });
        }

        // ACK
        socket.emit('message_ack', { tempId, messageId, createdAt: message.created_at });

      } else if (channelId) {
        // 普通频道消息
        socket.to(`channel:${channelId}`).emit('new_message', { ...formattedMessage, isNew: true });
        socket.emit('message_ack', { tempId, messageId, createdAt: message.created_at });

      } else if (dmChannelId) {
        // 私信消息
        const dmChannel = dmOps.findById(dmChannelId);
        if (dmChannel) {
          const user1Socket = onlineUsers.get(dmChannel.user1_id);
          const user2Socket = onlineUsers.get(dmChannel.user2_id);
          if (user1Socket && user1Socket !== socket.id) io.to(user1Socket).emit('new_message', { ...formattedMessage, isNew: true });
          if (user2Socket && user2Socket !== socket.id && user2Socket !== user1Socket) {
            io.to(user2Socket).emit('new_message', { ...formattedMessage, isNew: true });
          }
        }
        socket.emit('message_ack', { tempId, messageId, createdAt: message.created_at });
      }

    } catch (err) {
      console.error('[Socket] send_message error:', err);
      socket.emit('message_fail', { tempId, error: '消息发送失败，请重试' });
    }
  });

  // ==================== 定时消息事件 ====================

  // 创建定时消息
  socket.on('schedule_message', ({ channelId, dmChannelId, content, type = 'text', replyTo, threadParentId, scheduledAt }) => {
    try {
      if (!content?.trim()) return;
      if (!channelId && !dmChannelId) return;

      // 校验时间：至少 1 分钟后
      const scheduledTime = new Date(scheduledAt);
      const now = new Date();
      if (isNaN(scheduledTime.getTime()) || scheduledTime - now < 60000) {
        socket.emit('schedule_fail', { error: '定时时间必须至少在 1 分钟之后' });
        return;
      }

      // 速率限制
      if (!checkRateLimit(user.id)) {
        socket.emit('schedule_fail', { error: '操作太频繁，请稍候' });
        return;
      }

      const result = scheduledMessageOps.create({
        channelId: channelId || null,
        dmChannelId: dmChannelId || null,
        senderId: user.id,
        content,
        type,
        replyTo: replyTo || null,
        threadParentId: threadParentId || null,
        scheduledAt: scheduledTime.toISOString(),
      });

      socket.emit('schedule_ack', {
        id: result.lastInsertRowid,
        channelId: channelId || null,
        dmChannelId: dmChannelId || null,
        content,
        type,
        scheduledAt: scheduledTime.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      console.log(`[Schedule] 用户 ${user.username} 定时消息 #${result.lastInsertRowid} 将在 ${scheduledTime.toLocaleString()} 发送`);
    } catch (err) {
      console.error('[Socket] schedule_message error:', err);
      socket.emit('schedule_fail', { error: '定时消息创建失败' });
    }
  });

  // 取消定时消息
  socket.on('cancel_scheduled', ({ id }) => {
    try {
      const result = scheduledMessageOps.cancel(id, user.id);
      if (result.changes > 0) {
        socket.emit('scheduled_cancelled', { id });
      } else {
        socket.emit('schedule_fail', { error: '无法取消该定时消息（已发送或不存在）' });
      }
    } catch (err) {
      console.error('[Socket] cancel_scheduled error:', err);
    }
  });

  // 查询定时消息列表
  socket.on('list_scheduled', ({ channelId, dmChannelId }) => {
    try {
      const messages = scheduledMessageOps.findByUser(user.id, channelId, dmChannelId);
      socket.emit('scheduled_list', { messages });
    } catch (err) {
      console.error('[Socket] list_scheduled error:', err);
    }
  });

  socket.on('edit_message', ({ messageId, content }) => {
    try {
      if (!content?.trim()) return;

      const result = messageOps.edit(content, messageId, user.id);
      if (result.changes === 0) return;

      const message = messageOps.findById(messageId);

      if (message?.channel_id) {
        io.to(`channel:${message.channel_id}`).emit('message_edited', {
          messageId,
          content,
          updatedAt: message.updated_at,
        });
      } else if (message?.dm_channel_id) {
        const dmChannel = dmOps.findById(message.dm_channel_id);
        if (dmChannel) {
          const u1Socket = onlineUsers.get(dmChannel.user1_id);
          const u2Socket = onlineUsers.get(dmChannel.user2_id);
          const payload = { messageId, content, updatedAt: message.updated_at };
          if (u1Socket) io.to(u1Socket).emit('message_edited', payload);
          if (u2Socket && u2Socket !== u1Socket) io.to(u2Socket).emit('message_edited', payload);
        }
      }
    } catch (err) {
      console.error('[Socket] edit_message error:', err);
    }
  });

  socket.on('delete_message', ({ messageId }) => {
    try {
      const message = messageOps.findById(messageId);
      if (!message) return;

      const result = messageOps.delete(messageId, user.id);
      if (result.changes === 0) return;

      if (message.channel_id) {
        io.to(`channel:${message.channel_id}`).emit('message_deleted', { messageId });
      } else if (message.dm_channel_id) {
        const dmChannel = dmOps.findById(message.dm_channel_id);
        if (dmChannel) {
          const u1Socket = onlineUsers.get(dmChannel.user1_id);
          const u2Socket = onlineUsers.get(dmChannel.user2_id);
          if (u1Socket) io.to(u1Socket).emit('message_deleted', { messageId });
          if (u2Socket && u2Socket !== u1Socket) io.to(u2Socket).emit('message_deleted', { messageId });
        }
      }
    } catch (err) {
      console.error('[Socket] delete_message error:', err);
    }
  });

  // ==================== 固定消息事件 ====================

  socket.on('pin_message', ({ messageId }) => {
    try {
      const message = messageOps.findById(messageId);
      if (!message || !message.channel_id) return;

      const alreadyPinned = pinOps.isPinned(messageId);
      if (alreadyPinned) return;

      pinOps.pin(messageId, message.channel_id, user.id);
      const pinnedMessages = pinOps.findByChannel(message.channel_id);

      io.to(`channel:${message.channel_id}`).emit('pinned_messages_updated', {
        channelId: message.channel_id,
        pinnedMessages,
      });

      // 系统消息：固定通知
      const sysMsgResult = messageOps.create(
        message.channel_id, null, user.id,
        `📌 ${user.username} 固定了一条消息`, 'system', null
      );
      const sysMsg = messageOps.findById(sysMsgResult.lastInsertRowid);
      if (sysMsg) {
        io.to(`channel:${message.channel_id}`).emit('new_message', formatMessage(sysMsg));
      }
    } catch (err) {
      console.error('[Socket] pin_message error:', err);
    }
  });

  socket.on('unpin_message', ({ messageId }) => {
    try {
      const message = messageOps.findById(messageId);
      if (!message || !message.channel_id) return;

      pinOps.unpin(messageId);
      const pinnedMessages = pinOps.findByChannel(message.channel_id);

      io.to(`channel:${message.channel_id}`).emit('pinned_messages_updated', {
        channelId: message.channel_id,
        pinnedMessages,
      });
    } catch (err) {
      console.error('[Socket] unpin_message error:', err);
    }
  });

  socket.on('get_pinned_messages', ({ channelId }) => {
    try {
      const pinnedMessages = pinOps.findByChannel(channelId);
      socket.emit('pinned_messages_updated', { channelId, pinnedMessages });
    } catch (err) {
      console.error('[Socket] get_pinned_messages error:', err);
    }
  });

  // ==================== 反应事件 ====================

  socket.on('add_reaction', ({ messageId, emoji }) => {
    try {
      reactionOps.add(messageId, user.id, emoji);
      const reactions = getMessageReactions(messageId);
      const message = messageOps.findById(messageId);
      const payload = { messageId, reactions };

      if (message?.channel_id) {
        io.to(`channel:${message.channel_id}`).emit('reaction_updated', payload);
      } else if (message?.dm_channel_id) {
        const dmChannel = dmOps.findById(message.dm_channel_id);
        if (dmChannel) {
          const u1Socket = onlineUsers.get(dmChannel.user1_id);
          const u2Socket = onlineUsers.get(dmChannel.user2_id);
          if (u1Socket) io.to(u1Socket).emit('reaction_updated', payload);
          if (u2Socket && u2Socket !== u1Socket) io.to(u2Socket).emit('reaction_updated', payload);
        }
      }

      // 通知消息原作者（若非自己反应）
      if (message && message.sender_id !== user.id) {
        const authorSocket = onlineUsers.get(message.sender_id);
        if (authorSocket) {
          io.to(authorSocket).emit('reaction_received', {
            messageId,
            emoji,
            reactorUsername: user.username,
            reactorAvatarColor: user.avatar_color,
            reactorId: user.id,
            messagePreview: message.content ? message.content.slice(0, 60) : null,
          });
        }
      }
    } catch (err) {
      console.error('[Socket] add_reaction error:', err);
    }
  });

  socket.on('remove_reaction', ({ messageId, emoji }) => {
    try {
      reactionOps.remove(messageId, user.id, emoji);
      const reactions = getMessageReactions(messageId);
      const message = messageOps.findById(messageId);
      const payload = { messageId, reactions };

      if (message?.channel_id) {
        io.to(`channel:${message.channel_id}`).emit('reaction_updated', payload);
      } else if (message?.dm_channel_id) {
        const dmChannel = dmOps.findById(message.dm_channel_id);
        if (dmChannel) {
          const u1Socket = onlineUsers.get(dmChannel.user1_id);
          const u2Socket = onlineUsers.get(dmChannel.user2_id);
          if (u1Socket) io.to(u1Socket).emit('reaction_updated', payload);
          if (u2Socket && u2Socket !== u1Socket) io.to(u2Socket).emit('reaction_updated', payload);
        }
      }
    } catch (err) {
      console.error('[Socket] remove_reaction error:', err);
    }
  });

  // ==================== 输入状态事件 ====================

  socket.on('typing_start', ({ channelId, dmChannelId }) => {
    const key = channelId ? `channel:${channelId}` : `dm:${dmChannelId}`;
    if (!typingUsers.has(key)) typingUsers.set(key, new Set());
    typingUsers.get(key).add(user.id);

    const payload = { userId: user.id, username: user.username, channelId, dmChannelId };

    if (channelId) {
      socket.to(`channel:${channelId}`).emit('user_typing', payload);
    } else if (dmChannelId) {
      const dmChannel = dmOps.findById(dmChannelId);
      if (dmChannel) {
        const otherId = dmChannel.user1_id === user.id ? dmChannel.user2_id : dmChannel.user1_id;
        const otherSocket = onlineUsers.get(otherId);
        if (otherSocket) io.to(otherSocket).emit('user_typing', payload);
      }
    }
  });

  socket.on('typing_stop', ({ channelId, dmChannelId }) => {
    const key = channelId ? `channel:${channelId}` : `dm:${dmChannelId}`;
    typingUsers.get(key)?.delete(user.id);

    const payload = { userId: user.id, channelId, dmChannelId };

    if (channelId) {
      socket.to(`channel:${channelId}`).emit('user_stop_typing', payload);
    } else if (dmChannelId) {
      const dmChannel = dmOps.findById(dmChannelId);
      if (dmChannel) {
        const otherId = dmChannel.user1_id === user.id ? dmChannel.user2_id : dmChannel.user1_id;
        const otherSocket = onlineUsers.get(otherId);
        if (otherSocket) io.to(otherSocket).emit('user_stop_typing', payload);
      }
    }
  });

  socket.on('mark_read', ({ channelId }) => {
    try {
      channelOps.updateLastRead(user.id, channelId);
    } catch (err) {
      console.error('[Socket] mark_read error:', err);
    }
  });

  // ==================== 用户资料更新 ====================

  socket.on('profile_updated', ({ avatarColor, customStatus, bio, avatarUrl }) => {
    try {
      // 广播给所有在线用户，让他们刷新用户列表
      io.emit('user_profile_changed', {
        userId: user.id,
        username: user.username,
        avatarColor: avatarColor || user.avatar_color,
        customStatus: customStatus || null,
        bio: bio || null,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
      });
    } catch (err) {
      console.error('[Socket] profile_updated error:', err);
    }
  });

  // ==================== WebRTC 信令 ====================

  /**
   * 主叫方发起通话 Offer
   * targetUserId: 被叫用户ID
   * dmChannelId: 关联的DM频道
   * callType: 'voice' | 'video'
   * offer: RTCSessionDescriptionInit
   */
  socket.on('webrtc_call_offer', ({ targetUserId, dmChannelId, callType, offer }) => {
    try {
      const targetSocket = [...io.sockets.sockets.values()].find(
        s => s.user?.id === parseInt(targetUserId)
      )
      if (!targetSocket) {
        socket.emit('webrtc_call_failed', { reason: '对方不在线' })
        return
      }
      targetSocket.emit('webrtc_call_offer', {
        fromUser: {
          id: user.id,
          username: user.username,
          avatarColor: user.avatar_color,
        },
        dmChannelId,
        callType,
        offer,
      })
      console.log(`[WebRTC] ${user.username} -> ${targetUserId} 发起 ${callType} 通话`)
    } catch (err) {
      console.error('[WebRTC] call_offer error:', err)
    }
  })

  /**
   * 被叫方返回 Answer
   */
  socket.on('webrtc_call_answer', ({ targetUserId, answer }) => {
    try {
      const targetSocket = [...io.sockets.sockets.values()].find(
        s => s.user?.id === parseInt(targetUserId)
      )
      targetSocket?.emit('webrtc_call_answer', { answer })
      console.log(`[WebRTC] ${user.username} 接听了通话`)
    } catch (err) {
      console.error('[WebRTC] call_answer error:', err)
    }
  })

  /**
   * 交换 ICE 候选
   */
  socket.on('webrtc_ice_candidate', ({ targetUserId, candidate }) => {
    try {
      const targetSocket = [...io.sockets.sockets.values()].find(
        s => s.user?.id === parseInt(targetUserId)
      )
      targetSocket?.emit('webrtc_ice_candidate', { candidate })
    } catch (err) {
      console.error('[WebRTC] ice_candidate error:', err)
    }
  })

  /**
   * 主动挂断
   */
  socket.on('webrtc_call_hangup', ({ targetUserId }) => {
    try {
      const targetSocket = [...io.sockets.sockets.values()].find(
        s => s.user?.id === parseInt(targetUserId)
      )
      targetSocket?.emit('webrtc_call_hangup', { fromUserId: user.id })
      console.log(`[WebRTC] ${user.username} 挂断了通话`)
    } catch (err) {
      console.error('[WebRTC] call_hangup error:', err)
    }
  })

  /**
   * 拒绝来电
   */
  socket.on('webrtc_call_reject', ({ targetUserId }) => {
    try {
      const targetSocket = [...io.sockets.sockets.values()].find(
        s => s.user?.id === parseInt(targetUserId)
      )
      targetSocket?.emit('webrtc_call_reject', { fromUserId: user.id })
      console.log(`[WebRTC] ${user.username} 拒绝了通话`)
    } catch (err) {
      console.error('[WebRTC] call_reject error:', err)
    }
  })

  // ==================== 断线处理 ====================

  socket.on('disconnect', () => {
    console.log(`[Socket] 用户下线: ${user.username}`);
    onlineUsers.delete(user.id);
    userOps.updateStatus('offline', user.id);
    io.emit('user_status_changed', { userId: user.id, status: 'offline' });

    for (const [key, users] of typingUsers.entries()) {
      if (users.has(user.id)) {
        users.delete(user.id);
        const [type, id] = key.split(':');
        if (type === 'channel') {
          io.to(key).emit('user_stop_typing', { userId: user.id, channelId: parseInt(id) });
        }
      }
    }
  });
});

// ==================== 定时消息轮询（每 15 秒检查一次到期消息）====================

function deliverScheduledMessages() {
  try {
    const pending = scheduledMessageOps.getPending();
    if (!pending.length) return;

    console.log(`[Schedule] 检测到 ${pending.length} 条到期定时消息，开始发送...`);

    for (const sm of pending) {
      try {
        // 保存到 messages 表
        const result = messageOps.create(
          sm.channel_id,
          sm.dm_channel_id,
          sm.sender_id,
          sm.content,
          sm.type,
          sm.reply_to,
          sm.thread_parent_id
        );
        const messageId = result.lastInsertRowid;
        const message = messageOps.findById(messageId);
        const formatted = formatMessage(message);

        // 广播消息
        if (sm.channel_id) {
          io.to(`channel:${sm.channel_id}`).emit('new_message', { ...formatted, isNew: true, isScheduled: true });
        } else if (sm.dm_channel_id) {
          const dmChannel = dmOps.findById(sm.dm_channel_id);
          if (dmChannel) {
            const u1Socket = onlineUsers.get(dmChannel.user1_id);
            const u2Socket = onlineUsers.get(dmChannel.user2_id);
            if (u1Socket) io.to(u1Socket).emit('new_message', { ...formatted, isNew: true, isScheduled: true });
            if (u2Socket && u2Socket !== u1Socket) io.to(u2Socket).emit('new_message', { ...formatted, isNew: true, isScheduled: true });
          }
        }

        // 通知发送者：定时消息已送达
        const senderSocket = onlineUsers.get(sm.sender_id);
        if (senderSocket) {
          io.to(senderSocket).emit('scheduled_delivered', {
            scheduledId: sm.id,
            messageId,
            channelId: sm.channel_id,
            dmChannelId: sm.dm_channel_id,
          });
        }

        scheduledMessageOps.markSent(sm.id);
        console.log(`[Schedule] 定时消息 #${sm.id} 已送达（来自 ${sm.username}）`);
      } catch (err) {
        console.error(`[Schedule] 定时消息 #${sm.id} 发送失败:`, err);
      }
    }
  } catch (err) {
    console.error('[Schedule] deliverScheduledMessages error:', err);
  }
}

// 启动定时检查（15 秒一次）
setInterval(deliverScheduledMessages, 15000);

// ==================== 启动服务器 ====================

httpServer.listen(PORT, () => {
  console.log(`🚀 Jarvis IM Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  httpServer.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
