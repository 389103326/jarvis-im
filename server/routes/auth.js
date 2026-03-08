/**
 * routes/auth.js - 用户注册/登录路由
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { userOps, channelOps } = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 注意：修改密码路由需要认证中间件，但这里 auth.js 没有 require authMiddleware
// 我们导入并使用
const { authMiddleware } = require('../middleware/auth');
const AVATAR_COLORS = [
  '#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245',
  '#3498DB', '#E74C3C', '#2ECC71', '#9B59B6', '#F39C12',
  '#1ABC9C', '#E67E22', '#95A5A6', '#16A085', '#8E44AD',
];

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名长度必须在 2-20 个字符之间' });
    if (password.length < 6) return res.status(400).json({ error: '密码长度不能少于 6 位' });

    const existing = userOps.findByUsername(username);
    if (existing) return res.status(409).json({ error: '用户名已被占用' });

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = userOps.create(username, passwordHash, avatarColor);
    const userId = result.lastInsertRowid;

    // 自动加入所有公共频道
    const publicChannels = channelOps.findAll('dm');
    for (const ch of publicChannels) {
      channelOps.addMember(userId, ch.id);
    }

    const token = jwt.sign(
      { id: userId, username, avatarColor },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: userId, username, avatarColor } });
  } catch (err) {
    console.error('Register error:', err);
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: '用户名已被占用' });
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

    const user = userOps.findByUsername(username);
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: '用户名或密码错误' });

    // 确保加入所有公共频道
    const publicChannels = channelOps.findAll('dm');
    for (const ch of publicChannels) {
      channelOps.addMember(user.id, ch.id);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, avatarColor: user.avatar_color },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username, avatarColor: user.avatar_color } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 修改密码（需要认证）
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: '请填写完整' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });

    const user = userOps.findByUsername(req.user.username);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: '当前密码不正确' });

    const newHash = await bcrypt.hash(newPassword, 12);
    require('../database').db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    res.json({ success: true, message: '密码已更改' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: '修改失败' });
  }
});

module.exports = router;
