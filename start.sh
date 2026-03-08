#!/bin/bash
# Jarvis IM 启动脚本
set -e

# 自动检测脚本所在目录（解决绝对路径问题）
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$BASE_DIR/server"
CLIENT_DIR="$BASE_DIR/client"

echo "🤖 启动 Jarvis IM..."
echo "📂 项目目录: $BASE_DIR"

# 安装后端依赖
echo ""
echo "📦 安装后端依赖..."
cd "$SERVER_DIR"
npm install

# 检查是否需要构建前端
if [ ! -f "$CLIENT_DIR/dist/index.html" ]; then
  echo ""
  echo "📦 安装前端依赖..."
  cd "$CLIENT_DIR"
  npm install

  echo "🔨 构建前端..."
  npm run build
  echo "✅ 前端构建完成"
else
  echo "✅ 前端已有构建产物，跳过构建"
fi

# 启动后端服务
echo ""
echo "🚀 启动后端服务..."
cd "$SERVER_DIR"

# 创建上传目录（如果不存在）
mkdir -p uploads/avatars

node server.js &
SERVER_PID=$!
echo "✅ 后端服务已启动 (PID: $SERVER_PID)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Jarvis IM 已就绪！"
echo "🌐 访问地址: http://localhost:${PORT:-3000}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "按 Ctrl+C 停止服务"

# 等待后台进程
wait $SERVER_PID
