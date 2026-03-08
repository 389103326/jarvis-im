/**
 * auth.js middleware - JWT 验证中间件
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jarvis-im-secret-2024';

/**
 * 验证 JWT Token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }
  
  const token = authHeader.slice(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token 已过期，请重新登录' });
    }
    return res.status(401).json({ error: '无效的 Token' });
  }
}

/**
 * Socket.io 认证中间件
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('未授权'));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('无效的 Token'));
  }
}

module.exports = { authMiddleware, socketAuthMiddleware, JWT_SECRET };
