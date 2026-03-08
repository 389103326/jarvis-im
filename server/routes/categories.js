/**
 * routes/categories.js - 频道分类 API
 */

const express = require('express');
const router = express.Router();
const { categoryOps, channelOps } = require('../database');
const { authMiddleware } = require('../middleware/auth');

// GET /api/categories - 获取所有分类（含频道列表）
router.get('/', authMiddleware, (req, res) => {
  try {
    const categories = categoryOps.findAll();
    const channels = channelOps.findAll('dm');

    // 将频道挂到对应分类下
    const result = categories.map(cat => ({
      ...cat,
      channels: channels.filter(ch => ch.category_id === cat.id),
    }));

    // 未分类的频道放到末尾
    const uncategorized = channels.filter(ch => !ch.category_id);
    if (uncategorized.length > 0) {
      result.push({
        id: null,
        name: '其他频道',
        position: 999,
        channels: uncategorized,
      });
    }

    res.json(result);
  } catch (err) {
    console.error('GET /api/categories error:', err);
    res.status(500).json({ error: '获取分类失败' });
  }
});

// POST /api/categories - 创建分类
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, position = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '分类名称不能为空' });

    const result = categoryOps.create(name.trim(), position);
    const category = categoryOps.findById(result.lastInsertRowid);
    res.json({ ...category, channels: [] });
  } catch (err) {
    console.error('POST /api/categories error:', err);
    res.status(500).json({ error: '创建分类失败' });
  }
});

// PUT /api/categories/:id - 更新分类
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, position } = req.body;
    const cat = categoryOps.findById(parseInt(id));
    if (!cat) return res.status(404).json({ error: '分类不存在' });

    categoryOps.update(parseInt(id), name ?? cat.name, position ?? cat.position);
    res.json(categoryOps.findById(parseInt(id)));
  } catch (err) {
    console.error('PUT /api/categories error:', err);
    res.status(500).json({ error: '更新分类失败' });
  }
});

// DELETE /api/categories/:id - 删除分类
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    categoryOps.delete(parseInt(id));
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/categories error:', err);
    res.status(500).json({ error: '删除分类失败' });
  }
});

// PUT /api/categories/assign/:channelId - 将频道分配到分类
router.put('/assign/:channelId', authMiddleware, (req, res) => {
  try {
    const { channelId } = req.params;
    const { categoryId } = req.body;
    categoryOps.assignChannel(parseInt(channelId), categoryId ?? null);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/categories/assign error:', err);
    res.status(500).json({ error: '分配分类失败' });
  }
});

module.exports = router;
