/**
 * routes/bookmarks.js - 消息收藏/书签 API
 */

const express = require('express');
const { bookmarkOps, messageOps } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 获取当前用户的所有书签
router.get('/', (req, res) => {
  try {
    const bookmarks = bookmarkOps.findByUser(req.user.id);
    res.json(bookmarks);
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({ error: '获取书签失败' });
  }
});

// 添加书签
router.post('/', (req, res) => {
  try {
    const { messageId, note } = req.body;
    if (!messageId) return res.status(400).json({ error: '消息ID不能为空' });

    const message = messageOps.findById(parseInt(messageId));
    if (!message) return res.status(404).json({ error: '消息不存在' });

    bookmarkOps.add(req.user.id, parseInt(messageId), note || null);
    res.json({ success: true });
  } catch (err) {
    console.error('Add bookmark error:', err);
    res.status(500).json({ error: '添加书签失败' });
  }
});

// 删除书签
router.delete('/:messageId', (req, res) => {
  try {
    const { messageId } = req.params;
    bookmarkOps.remove(req.user.id, parseInt(messageId));
    res.json({ success: true });
  } catch (err) {
    console.error('Remove bookmark error:', err);
    res.status(500).json({ error: '删除书签失败' });
  }
});

// 检查单条消息是否已书签
router.get('/check/:messageId', (req, res) => {
  try {
    const result = bookmarkOps.isBookmarked(req.user.id, parseInt(req.params.messageId));
    res.json({ bookmarked: !!result });
  } catch (err) {
    res.status(500).json({ error: '查询失败' });
  }
});

module.exports = router;
