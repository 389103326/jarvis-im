/**
 * routes/channels.js - 频道管理路由
 */

const express = require('express');
const { channelOps, pinOps, categoryOps } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const channels = channelOps.findAll('dm');
    const channelsWithUnread = channels.map(ch => ({
      ...ch,
      unreadCount: channelOps.getUnreadCount(ch.id, req.user.id),
    }));
    res.json(channelsWithUnread);
  } catch (err) {
    console.error('Get channels error:', err);
    res.status(500).json({ error: '获取频道列表失败' });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, description, categoryId } = req.body;
    if (!name) return res.status(400).json({ error: '频道名称不能为空' });

    const normalizedName = name.toLowerCase().replace(/[^a-z0-9\-_\u4e00-\u9fa5]/g, '-');
    if (!normalizedName || normalizedName.length > 50) return res.status(400).json({ error: '频道名称长度无效' });

    const result = channelOps.create(normalizedName, description || '', 'public', req.user.id);
    const channelId = result.lastInsertRowid;
    channelOps.addMember(req.user.id, channelId);

    // 分配到指定分类（若提供）
    if (categoryId) {
      categoryOps.assignChannel(channelId, categoryId);
    } else {
      // 默认分配到第一个分类
      const cats = categoryOps.findAll();
      if (cats.length > 0) {
        categoryOps.assignChannel(channelId, cats[0].id);
      }
    }

    const channel = channelOps.findById(channelId);
    res.status(201).json({ ...channel, unreadCount: 0 });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: '频道名称已存在' });
    console.error('Create channel error:', err);
    res.status(500).json({ error: '创建频道失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const channel = channelOps.findById(parseInt(req.params.id));
    if (!channel) return res.status(404).json({ error: '频道不存在' });
    res.json(channel);
  } catch (err) {
    res.status(500).json({ error: '获取频道信息失败' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const channelId = parseInt(req.params.id);
    const { name, description, topic } = req.body;
    channelOps.update(channelId, req.user.id, { name, description, topic });
    const channel = channelOps.findById(channelId);
    res.json(channel);
  } catch (err) {
    console.error('Update channel error:', err);
    res.status(500).json({ error: '更新频道失败' });
  }
});

router.get('/:id/pins', (req, res) => {
  try {
    const channelId = parseInt(req.params.id);
    const pins = pinOps.findByChannel(channelId);
    res.json(pins);
  } catch (err) {
    console.error('Get pins error:', err);
    res.status(500).json({ error: '获取固定消息失败' });
  }
});

module.exports = router;
