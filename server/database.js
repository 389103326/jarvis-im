/**
 * database.js - SQLite 数据库初始化和操作
 * 使用 node-sqlite3-wasm (纯 WASM，无需原生编译)
 */

const { Database } = require('node-sqlite3-wasm');
const path = require('path');

const DB_PATH = path.join(__dirname, 'messages.db');

// 初始化数据库连接
const db = new Database(DB_PATH);

// 启用 WAL 模式提升性能
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/**
 * 初始化数据库表结构
 */
function initDatabase() {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#5865F2',
      status TEXT DEFAULT 'offline',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME
    )
  `);

  // 频道表
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      topic TEXT,
      type TEXT DEFAULT 'public',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 兼容性迁移：添加新列
  try { db.exec('ALTER TABLE channels ADD COLUMN topic TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN custom_status TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN bio TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE channels ADD COLUMN slow_mode_seconds INTEGER DEFAULT 0'); } catch(e) {}

  // 私信表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1_id INTEGER NOT NULL,
      user2_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user1_id, user2_id)
    )
  `);

  // 消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER,
      dm_channel_id INTEGER,
      sender_id INTEGER NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'text',
      reply_to INTEGER,
      is_edited BOOLEAN DEFAULT 0,
      is_deleted BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 消息回应表
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji)
    )
  `);

  // 频道成员/未读计数表
  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_members (
      user_id INTEGER,
      channel_id INTEGER,
      last_read_at DATETIME,
      PRIMARY KEY(user_id, channel_id)
    )
  `);

  // 固定消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS pinned_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL UNIQUE,
      channel_id INTEGER,
      pinned_by INTEGER NOT NULL,
      pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 频道分类表
  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 兼容性迁移：为 channels 表添加 category_id 列
  try { db.exec('ALTER TABLE channels ADD COLUMN category_id INTEGER REFERENCES channel_categories(id)'); } catch(e) {}

  // 书签/收藏表
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, message_id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id, created_at DESC)');

  // Thread 支持：为 messages 表添加 thread_parent_id 列
  try { db.exec('ALTER TABLE messages ADD COLUMN thread_parent_id INTEGER'); } catch(e) {}
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_thread_parent_id ON messages(thread_parent_id, created_at)');

  // DM 已读回执表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_read_receipts (
      dm_channel_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      last_read_message_id INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(dm_channel_id, user_id)
    )
  `);

  // Webhook 表（入站 Webhook，允许外部服务推消息到频道）
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_webhooks_token ON webhooks(token)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_webhooks_channel_id ON webhooks(channel_id)');

  // 初始化默认分类（仅当无分类时）
  const catCount = db.get('SELECT COUNT(*) as cnt FROM channel_categories');
  if (catCount.cnt === 0) {
    db.run('INSERT INTO channel_categories (name, position) VALUES (?, ?)', ['文字频道', 0]);
    db.run('INSERT INTO channel_categories (name, position) VALUES (?, ?)', ['公告', 1]);
    // 将现有频道归入默认分类
    const defaultCat = db.get('SELECT id FROM channel_categories WHERE name = ?', ['文字频道']);
    if (defaultCat) {
      db.run('UPDATE channels SET category_id = ? WHERE category_id IS NULL', [defaultCat.id]);
    }
  }

  // 定时消息表（消息调度）
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER,
      dm_channel_id INTEGER,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      reply_to INTEGER,
      thread_parent_id INTEGER,
      scheduled_at DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status, scheduled_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_messages_sender ON scheduled_messages(sender_id, status)');

  // ==================== 索引优化 ====================
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_dm_channel_id ON messages(dm_channel_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_pinned_channel_id ON pinned_messages(channel_id)');

  // 创建默认频道
  const defaultChannels = [
    { name: 'general', description: '通用讨论频道', topic: '欢迎来到 Jarvis IM！' },
    { name: 'random', description: '随便聊聊', topic: '' },
    { name: 'tech', description: '技术交流', topic: '' },
  ];

  for (const ch of defaultChannels) {
    db.run(
      'INSERT OR IGNORE INTO channels (name, description, topic, type) VALUES (?, ?, ?, ?)',
      [ch.name, ch.description, ch.topic, 'public']
    );
  }

  console.log('✅ Database initialized successfully');
}

// ==================== 用户操作 ====================

const userOps = {
  create: (username, passwordHash, avatarColor) =>
    db.run('INSERT INTO users (username, password_hash, avatar_color) VALUES (?, ?, ?)',
      [username, passwordHash, avatarColor]),

  findByUsername: (username) =>
    db.get('SELECT * FROM users WHERE username = ?', [username]),

  findById: (id) =>
    db.get('SELECT id, username, avatar_color, avatar_url, status, custom_status, bio, created_at, last_seen FROM users WHERE id = ?', [id]),

  findAll: () =>
    db.all('SELECT id, username, avatar_color, avatar_url, status, custom_status, last_seen FROM users ORDER BY username'),

  updateStatus: (status, id) =>
    db.run('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', [status, id]),

  updateLastSeen: (id) =>
    db.run('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [id]),

  updateProfile: (id, { avatarColor, customStatus, bio }) =>
    db.run('UPDATE users SET avatar_color = ?, custom_status = ?, bio = ? WHERE id = ?',
      [avatarColor, customStatus ?? null, bio ?? null, id]),

  updateAvatarUrl: (id, avatarUrl) =>
    db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, id]),
};

// ==================== 频道操作 ====================

const channelOps = {
  findAll: (excludeType = 'dm') =>
    db.all('SELECT * FROM channels WHERE type != ? ORDER BY name', [excludeType]),

  findById: (id) =>
    db.get('SELECT * FROM channels WHERE id = ?', [id]),

  create: (name, description, type, createdBy) =>
    db.run('INSERT INTO channels (name, description, type, created_by) VALUES (?, ?, ?, ?)',
      [name, description, type, createdBy]),

  update: (id, userId, { name, description, topic, slowModeSeconds }) => {
    const channel = db.get('SELECT * FROM channels WHERE id = ?', [id]);
    if (!channel) return;
    db.run(
      'UPDATE channels SET name = ?, description = ?, topic = ?, slow_mode_seconds = ? WHERE id = ?',
      [name ?? channel.name, description ?? channel.description, topic ?? channel.topic,
       slowModeSeconds !== undefined ? slowModeSeconds : (channel.slow_mode_seconds || 0), id]
    );
  },

  addMember: (userId, channelId) =>
    db.run('INSERT OR IGNORE INTO channel_members (user_id, channel_id, last_read_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [userId, channelId]),

  updateLastRead: (userId, channelId) =>
    db.run('UPDATE channel_members SET last_read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND channel_id = ?',
      [userId, channelId]),

  getUnreadCount: (channelId, userId) => {
    const result = db.get(`
      SELECT COUNT(*) as count FROM messages 
      WHERE channel_id = ? 
      AND sender_id != ?
      AND is_deleted = 0
      AND created_at > COALESCE(
        (SELECT last_read_at FROM channel_members WHERE user_id = ? AND channel_id = ?),
        '1970-01-01'
      )
    `, [channelId, userId, userId, channelId]);
    return result?.count || 0;
  },
};

// ==================== 私信操作 ====================

const dmOps = {
  findOrCreate: (userId1, userId2) => {
    const u1 = Math.min(userId1, userId2);
    const u2 = Math.max(userId1, userId2);
    db.run('INSERT OR IGNORE INTO dm_channels (user1_id, user2_id) VALUES (?, ?)', [u1, u2]);
  },

  findByUsers: (userId1, userId2) => {
    const u1 = Math.min(userId1, userId2);
    const u2 = Math.max(userId1, userId2);
    return db.get('SELECT * FROM dm_channels WHERE user1_id = ? AND user2_id = ?', [u1, u2]);
  },

  findById: (id) =>
    db.get('SELECT * FROM dm_channels WHERE id = ?', [id]),

  findByUserId: (userId) =>
    db.all(`
      SELECT dc.*, 
        CASE WHEN dc.user1_id = ? THEN dc.user2_id ELSE dc.user1_id END as other_user_id
      FROM dm_channels dc 
      WHERE dc.user1_id = ? OR dc.user2_id = ?
    `, [userId, userId, userId]),
};

// ==================== 消息操作 ====================

const messageOps = {
  create: (channelId, dmChannelId, senderId, content, type, replyTo, threadParentId = null) =>
    db.run(`
      INSERT INTO messages (channel_id, dm_channel_id, sender_id, content, type, reply_to, thread_parent_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [channelId, dmChannelId, senderId, content, type, replyTo, threadParentId]),

  findByChannel: (channelId, before, limit) =>
    db.all(`
      SELECT m.*, u.username, u.avatar_color,
        rm.content as reply_content, ru.username as reply_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages rm ON m.reply_to = rm.id
      LEFT JOIN users ru ON rm.sender_id = ru.id
      WHERE m.channel_id = ? AND m.id < ? AND m.thread_parent_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [channelId, before, limit]),

  findByChannelInitial: (channelId, limit) =>
    db.all(`
      SELECT m.*, u.username, u.avatar_color,
        rm.content as reply_content, ru.username as reply_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages rm ON m.reply_to = rm.id
      LEFT JOIN users ru ON rm.sender_id = ru.id
      WHERE m.channel_id = ? AND m.thread_parent_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [channelId, limit]),

  findByDM: (dmChannelId, before, limit) =>
    db.all(`
      SELECT m.*, u.username, u.avatar_color,
        rm.content as reply_content, ru.username as reply_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages rm ON m.reply_to = rm.id
      LEFT JOIN users ru ON rm.sender_id = ru.id
      WHERE m.dm_channel_id = ? AND m.id < ? AND m.thread_parent_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [dmChannelId, before, limit]),

  findByDMInitial: (dmChannelId, limit) =>
    db.all(`
      SELECT m.*, u.username, u.avatar_color,
        rm.content as reply_content, ru.username as reply_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages rm ON m.reply_to = rm.id
      LEFT JOIN users ru ON rm.sender_id = ru.id
      WHERE m.dm_channel_id = ? AND m.thread_parent_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [dmChannelId, limit]),

  findById: (id) =>
    db.get(`
      SELECT m.*, u.username, u.avatar_color
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [id]),

  edit: (content, messageId, senderId) =>
    db.run(`
      UPDATE messages SET content = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND sender_id = ?
    `, [content, messageId, senderId]),

  delete: (messageId, senderId) =>
    db.run(`
      UPDATE messages SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND sender_id = ?
    `, [messageId, senderId]),

  search: (channelId, pattern) =>
    db.all(`
      SELECT m.*, u.username, u.avatar_color
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.channel_id = ? OR ? IS NULL)
      AND m.is_deleted = 0
      AND m.thread_parent_id IS NULL
      AND m.content LIKE ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [channelId, channelId, pattern]),

  getLastDMMessage: (dmChannelId) =>
    db.get(`
      SELECT m.*, u.username FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.dm_channel_id = ? AND m.is_deleted = 0 AND m.thread_parent_id IS NULL
      ORDER BY m.created_at DESC LIMIT 1
    `, [dmChannelId]),

  // 获取 @提及 指定用户的所有消息
  findMentions: (username, limit = 50, before = null) => {
    const pattern = `%@${username}%`;
    if (before) {
      return db.all(`
        SELECT m.*, u.username, u.avatar_color,
          ch.name as channel_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN channels ch ON m.channel_id = ch.id
        WHERE m.content LIKE ?
        AND m.is_deleted = 0
        AND m.type = 'text'
        AND m.id < ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [pattern, before, limit]);
    }
    return db.all(`
      SELECT m.*, u.username, u.avatar_color,
        ch.name as channel_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN channels ch ON m.channel_id = ch.id
      WHERE m.content LIKE ?
      AND m.is_deleted = 0
      AND m.type = 'text'
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [pattern, limit]);
  },

  // ==================== Thread 操作 ====================

  // 获取一个线程的所有回复
  findByThread: (threadParentId, limit = 100) =>
    db.all(`
      SELECT m.*, u.username, u.avatar_color
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.thread_parent_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at ASC
      LIMIT ?
    `, [threadParentId, limit]),

  // 获取线程统计（回复数量 + 最后一条回复 + 参与者）
  getThreadStats: (messageId) => {
    const stats = db.get(`
      SELECT 
        COUNT(*) as reply_count,
        MAX(m.created_at) as last_reply_at
      FROM messages m
      WHERE m.thread_parent_id = ? AND m.is_deleted = 0
    `, [messageId]);

    const participants = db.all(`
      SELECT DISTINCT u.id, u.username, u.avatar_color
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.thread_parent_id = ? AND m.is_deleted = 0
      LIMIT 3
    `, [messageId]);

    const lastReply = db.get(`
      SELECT m.content, u.username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.thread_parent_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT 1
    `, [messageId]);

    return {
      replyCount: stats?.reply_count || 0,
      lastReplyAt: stats?.last_reply_at || null,
      participants: participants || [],
      lastReply: lastReply || null,
    };
  },
};

// ==================== 反应操作 ====================

const reactionOps = {
  add: (messageId, userId, emoji) =>
    db.run('INSERT OR IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
      [messageId, userId, emoji]),

  remove: (messageId, userId, emoji) =>
    db.run('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [messageId, userId, emoji]),

  findByMessage: (messageId) =>
    db.all(`
      SELECT r.emoji, r.user_id, u.username
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = ?
      ORDER BY r.created_at
    `, [messageId]),
};

// ==================== 固定消息操作 ====================

const pinOps = {
  pin: (messageId, channelId, userId) =>
    db.run('INSERT OR IGNORE INTO pinned_messages (message_id, channel_id, pinned_by) VALUES (?, ?, ?)',
      [messageId, channelId, userId]),

  unpin: (messageId) =>
    db.run('DELETE FROM pinned_messages WHERE message_id = ?', [messageId]),

  isPinned: (messageId) =>
    db.get('SELECT id FROM pinned_messages WHERE message_id = ?', [messageId]),

  findByChannel: (channelId) =>
    db.all(`
      SELECT pm.message_id, pm.pinned_at,
        m.content, m.type, m.sender_id, m.created_at as msg_created_at,
        u.username, u.avatar_color,
        pb.username as pinned_by_username
      FROM pinned_messages pm
      JOIN messages m ON pm.message_id = m.id
      JOIN users u ON m.sender_id = u.id
      JOIN users pb ON pm.pinned_by = pb.id
      WHERE pm.channel_id = ?
      ORDER BY pm.pinned_at DESC
    `, [channelId]),
};

// ==================== 频道分类操作 ====================

const categoryOps = {
  findAll: () =>
    db.all('SELECT * FROM channel_categories ORDER BY position, name'),

  findById: (id) =>
    db.get('SELECT * FROM channel_categories WHERE id = ?', [id]),

  create: (name, position = 0) =>
    db.run('INSERT INTO channel_categories (name, position) VALUES (?, ?)', [name, position]),

  update: (id, name, position) =>
    db.run('UPDATE channel_categories SET name = ?, position = ? WHERE id = ?',
      [name, position, id]),

  delete: (id) =>
    db.run('DELETE FROM channel_categories WHERE id = ?', [id]),

  assignChannel: (channelId, categoryId) =>
    db.run('UPDATE channels SET category_id = ? WHERE id = ?', [categoryId, channelId]),
};

// ==================== 书签操作 ====================

const bookmarkOps = {
  add: (userId, messageId, note = null) =>
    db.run('INSERT OR IGNORE INTO bookmarks (user_id, message_id, note) VALUES (?, ?, ?)',
      [userId, messageId, note]),

  remove: (userId, messageId) =>
    db.run('DELETE FROM bookmarks WHERE user_id = ? AND message_id = ?', [userId, messageId]),

  isBookmarked: (userId, messageId) =>
    db.get('SELECT id FROM bookmarks WHERE user_id = ? AND message_id = ?', [userId, messageId]),

  findByUser: (userId) =>
    db.all(`
      SELECT bk.id, bk.message_id, bk.note, bk.created_at as bookmarked_at,
        m.content, m.type, m.created_at as msg_created_at, m.channel_id, m.dm_channel_id,
        u.username, u.avatar_color,
        ch.name as channel_name
      FROM bookmarks bk
      JOIN messages m ON bk.message_id = m.id
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN channels ch ON m.channel_id = ch.id
      WHERE bk.user_id = ?
      ORDER BY bk.created_at DESC
    `, [userId]),
};

/**
 * 获取消息的所有反应（按 emoji 分组）
 */
function getMessageReactions(messageId) {
  const rawReactions = reactionOps.findByMessage(messageId);
  const grouped = {};

  for (const r of rawReactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    }
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push({ id: r.user_id, username: r.username });
  }

  return Object.values(grouped);
}

// ==================== Webhook 操作 ====================

const webhookOps = {
  create: (channelId, name, token, createdBy) =>
    db.run(
      'INSERT INTO webhooks (channel_id, name, token, created_by) VALUES (?, ?, ?, ?)',
      [channelId, name, token, createdBy]
    ),

  findByChannel: (channelId) =>
    db.all(
      'SELECT w.*, u.username as creator_username FROM webhooks w JOIN users u ON w.created_by = u.id WHERE w.channel_id = ? AND w.is_active = 1 ORDER BY w.created_at DESC',
      [channelId]
    ),

  findByToken: (token) =>
    db.get('SELECT * FROM webhooks WHERE token = ? AND is_active = 1', [token]),

  delete: (id, channelId) =>
    db.run('UPDATE webhooks SET is_active = 0 WHERE id = ? AND channel_id = ?', [id, channelId]),

  incrementUsage: (id) =>
    db.run('UPDATE webhooks SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [id]),
};

// ==================== DM 已读回执操作 ====================

const dmReadOps = {
  // 更新某用户在某 DM 频道中的最后已读消息
  markRead: (dmChannelId, userId, messageId) =>
    db.run(`
      INSERT INTO dm_read_receipts (dm_channel_id, user_id, last_read_message_id, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(dm_channel_id, user_id) DO UPDATE SET
        last_read_message_id = excluded.last_read_message_id,
        updated_at = CURRENT_TIMESTAMP
      WHERE excluded.last_read_message_id > last_read_message_id
    `, [dmChannelId, userId, messageId]),

  // 获取某 DM 频道中对方的已读消息 ID
  getReadStatus: (dmChannelId, userId) =>
    db.get(`
      SELECT last_read_message_id, updated_at 
      FROM dm_read_receipts 
      WHERE dm_channel_id = ? AND user_id = ?
    `, [dmChannelId, userId]),
};

// ==================== 定时消息操作 ====================

const scheduledMessageOps = {
  create: ({ channelId, dmChannelId, senderId, content, type = 'text', replyTo, threadParentId, scheduledAt }) =>
    db.run(
      `INSERT INTO scheduled_messages
        (channel_id, dm_channel_id, sender_id, content, type, reply_to, thread_parent_id, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        channelId || null,
        dmChannelId || null,
        senderId,
        content,
        type,
        replyTo || null,
        threadParentId || null,
        scheduledAt,
      ]
    ),

  // 获取所有 pending 且到期的定时消息（含发送者信息）
  getPending: () =>
    db.all(`
      SELECT sm.*, u.username, u.avatar_color, u.avatar_url
      FROM scheduled_messages sm
      JOIN users u ON sm.sender_id = u.id
      WHERE sm.status = 'pending' AND sm.scheduled_at <= datetime('now')
      ORDER BY sm.scheduled_at ASC
    `),

  markSent: (id) =>
    db.run("UPDATE scheduled_messages SET status = 'sent' WHERE id = ?", [id]),

  cancel: (id, userId) =>
    db.run(
      "UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ? AND sender_id = ? AND status = 'pending'",
      [id, userId]
    ),

  // 列出某用户的 pending 定时消息（可按频道/DM过滤）
  findByUser: (userId, channelId, dmChannelId) => {
    if (channelId) {
      return db.all(
        `SELECT * FROM scheduled_messages WHERE sender_id = ? AND channel_id = ? AND status = 'pending' ORDER BY scheduled_at ASC`,
        [userId, channelId]
      );
    } else if (dmChannelId) {
      return db.all(
        `SELECT * FROM scheduled_messages WHERE sender_id = ? AND dm_channel_id = ? AND status = 'pending' ORDER BY scheduled_at ASC`,
        [userId, dmChannelId]
      );
    }
    return db.all(
      `SELECT * FROM scheduled_messages WHERE sender_id = ? AND status = 'pending' ORDER BY scheduled_at ASC`,
      [userId]
    );
  },
};

module.exports = {
  db,
  initDatabase,
  userOps,
  channelOps,
  dmOps,
  messageOps,
  reactionOps,
  pinOps,
  categoryOps,
  bookmarkOps,
  dmReadOps,
  webhookOps,
  scheduledMessageOps,
  getMessageReactions,
};
