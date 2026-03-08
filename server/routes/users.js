/**
 * routes/users.js - 用户信息路由
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { userOps, dmOps, messageOps } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 确保 uploads/avatars 目录存在
const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

router.get('/', (req, res) => {
  try {
    const users = userOps.findAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

router.get('/me', (req, res) => {
  try {
    const user = userOps.findById(req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户资料
router.put('/profile', (req, res) => {
  try {
    const { avatarColor, customStatus, bio } = req.body;
    userOps.updateProfile(req.user.id, {
      avatarColor: avatarColor || '#5865F2',
      customStatus: customStatus || null,
      bio: bio || null,
    });
    const updated = userOps.findById(req.user.id);
    res.json(updated);
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: '更新资料失败' });
  }
});

// 上传头像图片（base64）
router.post('/avatar', (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: '缺少图片数据' });

    // 解析 data URL
    const matches = imageData.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: '图片格式不支持，请使用 PNG/JPEG/WebP' });

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // 限制 2MB
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: '图片大小不能超过 2MB' });
    }

    // 删除旧头像文件
    const existingUser = userOps.findById(req.user.id);
    if (existingUser?.avatar_url) {
      const oldFile = path.join(__dirname, '..', existingUser.avatar_url.replace(/^\/uploads\//, 'uploads/'));
      try { fs.unlinkSync(oldFile); } catch (e) {}
    }

    // 保存新头像
    const filename = `${req.user.id}_${Date.now()}.${ext}`;
    const filepath = path.join(AVATAR_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    userOps.updateAvatarUrl(req.user.id, avatarUrl);

    const updated = userOps.findById(req.user.id);
    res.json(updated);
  } catch (err) {
    console.error('avatar upload error:', err);
    res.status(500).json({ error: '头像上传失败' });
  }
});

// 删除头像（恢复颜色头像）
router.delete('/avatar', (req, res) => {
  try {
    const user = userOps.findById(req.user.id);
    if (user?.avatar_url) {
      const oldFile = path.join(__dirname, '..', user.avatar_url.replace(/^\/uploads\//, 'uploads/'));
      try { fs.unlinkSync(oldFile); } catch (e) {}
    }
    userOps.updateAvatarUrl(req.user.id, null);
    const updated = userOps.findById(req.user.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '删除头像失败' });
  }
});

// 注意：这个路由必须在 /dm/list/all 之前，但是会匹配到 'dm' 字符串
// 所以用数字 ID 路由在后
router.get('/dm/list/all', (req, res) => {
  try {
    const myId = req.user.id;
    const dmChannels = dmOps.findByUserId(myId);

    const result = dmChannels.map(dm => {
      const otherUser = userOps.findById(dm.other_user_id);
      const lastMessage = messageOps.getLastDMMessage(dm.id);
      return { ...dm, otherUser, lastMessage: lastMessage || null };
    });

    result.sort((a, b) => {
      const ta = a.lastMessage?.created_at || a.created_at;
      const tb = b.lastMessage?.created_at || b.created_at;
      return new Date(tb) - new Date(ta);
    });

    res.json(result);
  } catch (err) {
    console.error('Get DM list error:', err);
    res.status(500).json({ error: '获取私信列表失败' });
  }
});

router.post('/dm/:targetUserId', (req, res) => {
  try {
    const myId = req.user.id;
    const targetId = parseInt(req.params.targetUserId);

    if (myId === targetId) return res.status(400).json({ error: '不能给自己发私信' });

    const target = userOps.findById(targetId);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    dmOps.findOrCreate(myId, targetId);
    const dmChannel = dmOps.findByUsers(myId, targetId);
    const lastMessage = messageOps.getLastDMMessage(dmChannel.id);

    res.json({ ...dmChannel, otherUser: target, lastMessage: lastMessage || null });
  } catch (err) {
    console.error('DM channel error:', err);
    res.status(500).json({ error: '创建私信频道失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const user = userOps.findById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

module.exports = router;
