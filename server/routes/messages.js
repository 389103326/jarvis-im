/**
 * routes/messages.js - 消息历史路由
 */

const express = require('express');
const { messageOps, getMessageReactions } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { fetchLinkPreview } = require('../utils/linkPreview');

const router = express.Router();
router.use(authMiddleware);

function formatMessage(msg) {
  return {
    id: msg.id,
    channelId: msg.channel_id,
    dmChannelId: msg.dm_channel_id,
    senderId: msg.sender_id,
    username: msg.username,
    avatarColor: msg.avatar_color,
    content: msg.content,
    type: msg.type,
    replyTo: msg.reply_to,
    replyContent: msg.reply_content,
    replyUsername: msg.reply_username,
    threadParentId: msg.thread_parent_id || null,
    isEdited: !!msg.is_edited,
    isDeleted: !!msg.is_deleted,
    createdAt: msg.created_at,
    updatedAt: msg.updated_at,
    reactions: getMessageReactions(msg.id),
    channelName: msg.channel_name || null,
    // 添加 threadStats（仅对主消息）
    threadStats: (() => {
      if (msg.thread_parent_id) return null;
      const stats = messageOps.getThreadStats(msg.id);
      return stats.replyCount > 0 ? stats : null;
    })(),
  };
}

router.get('/channel/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const { before, limit = 50 } = req.query;

    let messages;
    if (before) {
      messages = messageOps.findByChannel(parseInt(channelId), parseInt(before), parseInt(limit));
    } else {
      messages = messageOps.findByChannelInitial(parseInt(channelId), parseInt(limit));
    }

    messages.reverse();
    res.json(messages.map(formatMessage));
  } catch (err) {
    console.error('Get channel messages error:', err);
    res.status(500).json({ error: '获取消息失败' });
  }
});

router.get('/dm/:dmChannelId', (req, res) => {
  try {
    const { dmChannelId } = req.params;
    const { before, limit = 50 } = req.query;

    let messages;
    if (before) {
      messages = messageOps.findByDM(parseInt(dmChannelId), parseInt(before), parseInt(limit));
    } else {
      messages = messageOps.findByDMInitial(parseInt(dmChannelId), parseInt(limit));
    }

    messages.reverse();
    res.json(messages.map(formatMessage));
  } catch (err) {
    console.error('Get DM messages error:', err);
    res.status(500).json({ error: '获取消息失败' });
  }
});

router.get('/search', (req, res) => {
  try {
    const { q, channelId } = req.query;
    if (!q?.trim()) return res.status(400).json({ error: '搜索关键词不能为空' });

    const messages = messageOps.search(channelId ? parseInt(channelId) : null, `%${q}%`);
    res.json(messages.map(formatMessage));
  } catch (err) {
    console.error('Search messages error:', err);
    res.status(500).json({ error: '搜索失败' });
  }
});

/**
 * GET /api/messages/mentions - 获取当前用户被 @提及 的消息
 */
router.get('/mentions', (req, res) => {
  try {
    const username = req.user.username;
    const { limit = 50, before } = req.query;
    const messages = messageOps.findMentions(username, parseInt(limit), before ? parseInt(before) : null);
    res.json(messages.map(formatMessage));
  } catch (err) {
    console.error('Get mentions error:', err);
    res.status(500).json({ error: '获取提及失败' });
  }
});

/**
 * GET /api/messages/:id/thread - 获取指定消息的线程回复
 */
router.get('/:id/thread', (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100 } = req.query;

    // 获取父消息
    const parent = messageOps.findById(parseInt(id));
    if (!parent) return res.status(404).json({ error: '消息不存在' });

    // 获取线程回复
    const replies = messageOps.findByThread(parseInt(id), parseInt(limit));
    const stats = messageOps.getThreadStats(parseInt(id));

    res.json({
      parent: {
        id: parent.id,
        channelId: parent.channel_id,
        senderId: parent.sender_id,
        username: parent.username,
        avatarColor: parent.avatar_color,
        content: parent.content,
        type: parent.type,
        createdAt: parent.created_at,
        reactions: getMessageReactions(parent.id),
      },
      replies: replies.map(m => ({
        id: m.id,
        threadParentId: m.thread_parent_id,
        senderId: m.sender_id,
        username: m.username,
        avatarColor: m.avatar_color,
        content: m.content,
        type: m.type,
        isEdited: !!m.is_edited,
        isDeleted: !!m.is_deleted,
        createdAt: m.created_at,
        reactions: getMessageReactions(m.id),
      })),
      stats,
    });
  } catch (err) {
    console.error('Get thread messages error:', err);
    res.status(500).json({ error: '获取线程消息失败' });
  }
});

/**
 * GET /api/messages/link-preview?url=... - 获取链接预览数据（OG标签）
 */
router.get('/link-preview', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL 参数缺失' });

  // 验证 URL 格式
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: '仅支持 HTTP/HTTPS 链接' });
    }
  } catch {
    return res.status(400).json({ error: '无效的 URL 格式' });
  }

  try {
    const data = await fetchLinkPreview(url);
    res.json(data);
  } catch (err) {
    // 不报错，返回空数据（前端会静默处理）
    res.json({ url, title: '', description: '', image: '', siteName: '', favicon: '' });
  }
});

/**
 * GET /api/messages/export - 导出频道/DM 聊天记录
 * 查询参数: channelId / dmChannelId, format (json|txt), limit (max 5000)
 */
router.get('/export', (req, res) => {
  try {
    const { channelId, dmChannelId, format = 'json', limit = 1000 } = req.query;
    const exportLimit = Math.min(parseInt(limit) || 1000, 5000);

    if (!channelId && !dmChannelId) {
      return res.status(400).json({ error: '必须指定 channelId 或 dmChannelId' });
    }

    let messages = [];
    if (channelId) {
      messages = messageOps.findByChannelInitial(parseInt(channelId), exportLimit);
      messages.reverse();
    } else {
      messages = messageOps.findByDMInitial(parseInt(dmChannelId), exportLimit);
      messages.reverse();
    }

    if (format === 'txt') {
      const lines = messages
        .filter(m => !m.is_deleted)
        .map(m => {
          const time = new Date(m.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
          const type = m.type === 'image' ? '[图片]' : m.type === 'webhook' ? '[Bot]' : '';
          const content = m.is_deleted ? '[已删除]' : (m.type === 'image' ? '[图片消息]' : m.content);
          return `[${time}] ${m.username}: ${type}${content}`;
        });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="jarvis-im-export-${Date.now()}.txt"`);
      return res.send(lines.join('\n'));
    }

    // JSON 格式
    const exportData = {
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        username: m.username,
        content: m.is_deleted ? null : m.content,
        type: m.type,
        isDeleted: !!m.is_deleted,
        isEdited: !!m.is_edited,
        createdAt: m.created_at,
        replyTo: m.reply_to || null,
      })),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jarvis-im-export-${Date.now()}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('Export messages error:', err);
    res.status(500).json({ error: '导出失败' });
  }
});

module.exports = router;
