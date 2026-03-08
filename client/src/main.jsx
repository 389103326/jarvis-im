import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ==================== 主题系统初始化（渲染前执行，避免闪烁）====================

function initTheme() {
  // 主题
  const theme = localStorage.getItem('jarvis-theme') || 'dark'
  if (theme !== 'dark') {
    document.documentElement.setAttribute('data-theme', theme)
  }

  // 字体大小
  const fontSize = localStorage.getItem('jarvis-font-size') || 'medium'
  const fontSizeMap = { small: '13px', medium: '15px', large: '17px' }
  document.documentElement.style.setProperty('--dc-font-base', fontSizeMap[fontSize] || '15px')

  // 消息密度
  const density = localStorage.getItem('jarvis-density') || 'cozy'
  if (density !== 'cozy') {
    document.documentElement.setAttribute('data-density', density)
  }
}

initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
