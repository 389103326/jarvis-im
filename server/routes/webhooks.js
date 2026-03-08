/**
 * routes/webhooks.js - Webhook 管理路由
 * 支持: 创建/删除/列出 Webhook、公开 Webhook 接收端点
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { webhookOps, messageOps, channelOps } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ==================== 管理接口（需要认证） ====================

/**
 * GET /api/webhooks/channel/:channelId - 列出频道所有 Webhook
 */
router.get('/channel/:channelId', authMiddleware, (req, res) => {
  try {
    const { channelId } = req.params;
    const webhooks = webhookOps.findByChannel(parseInt(channelId));
    // 返回时隐藏 token 末尾（安全考虑：只显示前8位）
    res.json(webhooks.map(w => ({
      id: w.id,
      channelId: w.channel_id,
      name: w.name,
      token: w.token, // 完整 token（只有频道成员才能看到）
      tokenPreview: w.token.slice(0, 8) + '...',
      creatorUsername: w.creator_username,
      usageCount: w.usage_count,
      lastUsedAt: w.last_used_at,
      createdAt: w.created_at,
      // 构建完整的 Webhook URL
      url: `/api/webhooks/incoming/${w.token}`,
    })));
  } catch (err) {
    console.error('List webhooks error:', err);
    res.status(500).json({ error: '获取 Webhook 列表失败' });
  }
});

/**
 * POST /api/webhooks/channel/:channelId - 创建新 Webhook
 */
router.post('/channel/:channelId', authMiddleware, (req, res) => {
  try {
    const { channelId } = req.params;
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Webhook 名称不能为空' });
    }

    // 验证频道存在
    const channel = channelOps.findById(parseInt(channelId));
    if (!channel) {
      return res.status(404).json({ error: '频道不存在' });
    }

    // 每个频道最多 10 个 Webhook
    const existing = webhookOps.findByChannel(parseInt(channelId));
    if (existing.length >= 10) {
      return res.status(400).json({ error: '每个频道最多创建 10 个 Webhook' });
    }

    // 生成唯一 token（UUID v4 去掉连字符）
    const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    const result = webhookOps.create(parseInt(channelId), name.trim(), token, req.user.id);

    res.status(201).json({
      id: result.lastInsertRowid,
      channelId: parseInt(channelId),
      name: name.trim(),
      token,
      url: `/api/webhooks/incoming/${token}`,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Create webhook error:', err);
    res.status(500).json({ error: '创建 Webhook 失败' });
  }
});

/**
 * DELETE /api/webhooks/:id - 删除 Webhook
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: '缺少 channelId' });
    }

    webhookOps.delete(parseInt(id), parseInt(channelId));
    res.json({ success: true });
  } catch (err) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ error: '删除 Webhook 失败' });
  }
});

// ==================== 公开接收端点（不需要认证，通过 token 鉴权） ====================

/**
 * POST /api/webhooks/incoming/:token - 接收外部消息推送
 * 请求体: { content: "消息内容", username?: "自定义发送者名", type?: "text" }
 */
router.post('/incoming/:token', (req, res) => {
  try {
    const { token } = req.params;
    const { content, username: botName, type = 'text' } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'content 不能为空' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'content 不能超过 2000 字符' });
    }

    // 验证 token
    const webhook = webhookOps.findByToken(token);
    if (!webhook) {
      return res.status(401).json({ error: 'Webhook token 无效或已禁用' });
    }

    // 获取一个 "Bot" 系统用户 ID（使用创建者 ID，以便消息有 sender）
    // 消息内容附加机器人名称作为标识
    const displayName = botName ? `🤖 ${botName}` : `🤖 ${webhook.name}`;
    const messageContent = content.trim();

    // 保存消息（type=webhook 标识机器人消息）
    const result = messageOps.create(
      webhook.channel_id,
      null,
      webhook.created_by, // 使用创建者账号发送
      messageContent,
      'webhook',
      null,
      null
    );

    // 更新使用计数
    webhookOps.incrementUsage(webhook.id);

    // 需要广播这条消息——通过 module.exports 暴露一个方法由 server.js 注入 io
    const messageId = result.lastInsertRowid;
    const savedMsg = messageOps.findById(messageId);

    // 将 io 实例通过路由 locals 传递
    const io = req.app.get('io');
    if (io && savedMsg) {
      const payload = {
        id: savedMsg.id,
        channelId: savedMsg.channel_id,
        senderId: savedMsg.sender_id,
        username: displayName,
        avatarColor: '#7289DA',
        content: savedMsg.content,
        type: 'webhook',
        isEdited: false,
        isDeleted: false,
        createdAt: savedMsg.created_at,
        reactions: [],
        isNew: true,
        webhookName: webhook.name,
      };
      io.to(`channel:${webhook.channel_id}`).emit('new_message', payload);
    }

    res.json({
      success: true,
      messageId,
      channelId: webhook.channel_id,
    });
  } catch (err) {
    console.error('Webhook incoming error:', err);
    res.status(500).json({ error: '消息推送失败' });
  }
});

module.exports = router;
