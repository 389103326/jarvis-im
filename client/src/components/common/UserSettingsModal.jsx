/**
 * components/common/UserSettingsModal.jsx - 用户设置弹窗
 * 支持: 头像颜色选择、自定义状态(emoji+文字)、个人简介、密码修改
 */

import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/useAuthStore'
import useChatStore from '../../store/useChatStore'
import { getSocket } from '../../hooks/useSocket'
import { setSoundEnabled, isSoundEnabled, playMessageSound } from '../../utils/sound'
import Avatar from './Avatar'

// 服务器状态面板
function ServerStatusPanel() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/stats')
      .then(res => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-xs text-discord-muted py-2">加载服务器状态...</div>
  }
  if (!stats) {
    return <div className="text-xs text-discord-muted py-2">服务器状态不可用</div>
  }

  const uptimeSecs = stats.server.uptime
  const hours = Math.floor(uptimeSecs / 3600)
  const minutes = Math.floor((uptimeSecs % 3600) / 60)

  return (
    <div className="bg-discord-bg rounded-lg p-4 space-y-2">
      <h3 className="text-white font-medium mb-2 flex items-center gap-2">
        🖥️ 服务器状态
        <span className="flex items-center gap-1 text-xs text-discord-green font-normal">
          <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-pulse inline-block" />
          运行中
        </span>
        <span className="ml-auto text-xs text-discord-muted font-normal">v{stats.server.version}</span>
      </h3>
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
        <span className="text-discord-muted">在线用户</span>
        <span className="text-discord-text text-right">{stats.server.onlineUsers} 人</span>
        <span className="text-discord-muted">运行时长</span>
        <span className="text-discord-text text-right">{hours}h {minutes}m</span>
        <span className="text-discord-muted">总消息数</span>
        <span className="text-discord-text text-right">{stats.database.totalMessages.toLocaleString()}</span>
        <span className="text-discord-muted">今日消息</span>
        <span className="text-discord-text text-right">{stats.database.messagesPublishedToday}</span>
        <span className="text-discord-muted">注册用户</span>
        <span className="text-discord-text text-right">{stats.database.totalUsers}</span>
        <span className="text-discord-muted">频道数量</span>
        <span className="text-discord-text text-right">{stats.database.totalChannels}</span>
        <span className="text-discord-muted">Emoji 回应</span>
        <span className="text-discord-text text-right">{stats.database.totalReactions.toLocaleString()}</span>
        <span className="text-discord-muted">图片消息</span>
        <span className="text-discord-text text-right">{stats.database.totalImages}</span>
      </div>
    </div>
  )
}

// 预设颜色
const PRESET_COLORS = [
  '#5865F2', // Discord Blue
  '#57F287', // Green
  '#FEE75C', // Yellow
  '#EB459E', // Pink
  '#ED4245', // Red
  '#3498DB', // Sky Blue
  '#9B59B6', // Purple
  '#E67E22', // Orange
  '#1ABC9C', // Teal
  '#2ECC71', // Emerald
  '#E74C3C', // Crimson
  '#95A5A6', // Gray
]

// 常用状态 emoji
const STATUS_EMOJIS = [
  '😊', '😎', '🔥', '💻', '☕', '🎮', '📚', '🎵',
  '🏃', '😴', '🤔', '✨', '🚀', '🎯', '💡', '🎉',
  '😷', '🌙', '⚡', '🎨', '🍕', '🌟', '💪', '🤖',
]

// 主题配置
const THEMES = [
  { id: 'dark', name: 'Discord 暗色', colors: ['#1e1f22', '#2b2d31', '#5865f2'] },
  { id: 'light', name: '浅色', colors: ['#f2f3f5', '#e3e5e8', '#5865f2'] },
  { id: 'midnight', name: '午夜', colors: ['#0d0d0d', '#141414', '#5865f2'] },
  { id: 'ocean', name: '海洋', colors: ['#1a2234', '#1e2a3d', '#3b82f6'] },
]

const FONT_SIZES = [
  { id: 'small', label: '小', size: '13px' },
  { id: 'medium', label: '中', size: '15px' },
  { id: 'large', label: '大', size: '17px' },
]

const DENSITIES = [
  { id: 'compact', label: '紧凑', desc: '更多消息可见' },
  { id: 'cozy', label: '舒适', desc: '均衡间距（默认）' },
  { id: 'spacious', label: '宽松', desc: '更多呼吸空间' },
]

export default function UserSettingsModal({ onClose }) {
  const { user, token } = useAuthStore()
  const { updateUserProfile } = useChatStore()
  const socket = getSocket()

  const [activeTab, setActiveTab] = useState('profile') // 'profile' | 'appearance' | 'notifications' | 'security'

  // 外观设置状态
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('jarvis-theme') || 'dark')
  const [currentFontSize, setCurrentFontSize] = useState(() => localStorage.getItem('jarvis-font-size') || 'medium')
  const [currentDensity, setCurrentDensity] = useState(() => localStorage.getItem('jarvis-density') || 'cozy')

  // 应用主题
  const applyTheme = (themeId) => {
    setCurrentTheme(themeId)
    localStorage.setItem('jarvis-theme', themeId)
    if (themeId === 'dark') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', themeId)
    }
  }

  // 应用字体大小
  const applyFontSize = (sizeId) => {
    setCurrentFontSize(sizeId)
    localStorage.setItem('jarvis-font-size', sizeId)
    const sizeMap = { small: '13px', medium: '15px', large: '17px' }
    document.documentElement.style.setProperty('--dc-font-base', sizeMap[sizeId])
  }

  // 应用消息密度
  const applyDensity = (densityId) => {
    setCurrentDensity(densityId)
    localStorage.setItem('jarvis-density', densityId)
    if (densityId === 'cozy') {
      document.documentElement.removeAttribute('data-density')
    } else {
      document.documentElement.setAttribute('data-density', densityId)
    }
  }

  // 通知设置
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())

  // Profile 表单状态
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || '#5865F2')
  const [customStatus, setCustomStatus] = useState(user?.custom_status || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // 头像上传状态
  const avatarFileRef = useRef(null)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')

  // Security 表单状态
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  // 从 custom_status 解析 emoji 和文字
  const [statusEmoji, setStatusEmoji] = useState(() => {
    const s = user?.custom_status || ''
    const match = s.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*(.*)/u)
    return match ? match[1] : ''
  })
  const [statusText, setStatusText] = useState(() => {
    const s = user?.custom_status || ''
    const match = s.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*(.*)/u)
    return match ? match[2] : s
  })

  // 合成 custom_status
  const composedStatus = statusEmoji
    ? `${statusEmoji} ${statusText}`.trim()
    : statusText

  // 头像图片选择处理（客户端压缩 + 预览）
  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarMsg('❌ 请选择图片文件')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        // Canvas 压缩：最大 256x256
        const MAX = 256
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const compressed = canvas.toDataURL('image/jpeg', 0.88)
        setAvatarPreview(compressed)
        uploadAvatar(compressed)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const uploadAvatar = async (dataUrl) => {
    setUploadingAvatar(true)
    setAvatarMsg('')
    try {
      const res = await axios.post('/api/users/avatar', { imageData: dataUrl })
      const updated = res.data
      // 更新 auth store
      useAuthStore.setState(state => ({
        user: { ...state.user, avatar_url: updated.avatar_url }
      }))
      // 广播给其他用户
      socket?.emit('profile_updated', {
        avatarUrl: updated.avatar_url,
        avatarColor: updated.avatar_color,
        customStatus: updated.custom_status,
        bio: updated.bio,
      })
      updateUserProfile({ id: user.id, avatarUrl: updated.avatar_url, avatarColor: updated.avatar_color })
      setAvatarPreview(updated.avatar_url)
      setAvatarMsg('✅ 头像已更新！')
      setTimeout(() => setAvatarMsg(''), 3000)
    } catch (err) {
      setAvatarMsg('❌ ' + (err.response?.data?.error || '上传失败'))
      setAvatarPreview(user?.avatar_url || null)
    }
    setUploadingAvatar(false)
  }

  const handleRemoveAvatar = async () => {
    if (!avatarPreview && !user?.avatar_url) return
    setUploadingAvatar(true)
    try {
      await axios.delete('/api/users/avatar')
      useAuthStore.setState(state => ({
        user: { ...state.user, avatar_url: null }
      }))
      socket?.emit('profile_updated', { avatarUrl: null, avatarColor: user?.avatar_color })
      updateUserProfile({ id: user.id, avatarUrl: null })
      setAvatarPreview(null)
      setAvatarMsg('已恢复颜色头像')
      setTimeout(() => setAvatarMsg(''), 3000)
    } catch (err) {
      setAvatarMsg('❌ 删除失败')
    }
    setUploadingAvatar(false)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await axios.put('/api/users/profile', {
        avatarColor,
        customStatus: composedStatus || null,
        bio: bio || null,
      })
      const updated = res.data

      // 更新本地 auth store
      useAuthStore.setState(state => ({
        user: {
          ...state.user,
          avatar_color: updated.avatar_color,
          custom_status: updated.custom_status,
          bio: updated.bio,
        }
      }))

      // 广播给其他用户
      socket?.emit('profile_updated', {
        avatarColor: updated.avatar_color,
        customStatus: updated.custom_status,
        bio: updated.bio,
      })

      // 更新聊天 store 中的用户列表
      updateUserProfile({
        id: user.id,
        avatarColor: updated.avatar_color,
        customStatus: updated.custom_status,
      })

      setSaveMsg('✅ 保存成功！')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveMsg('❌ 保存失败：' + (err.response?.data?.error || err.message))
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setPwMsg('❌ 请填写完整')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('❌ 两次密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setPwMsg('❌ 密码至少 6 位')
      return
    }

    setPwSaving(true)
    setPwMsg('')
    try {
      await axios.put('/api/auth/change-password', {
        currentPassword,
        newPassword,
      })
      setPwMsg('✅ 密码已更改，请重新登录')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwMsg('❌ ' + (err.response?.data?.error || '修改失败'))
    }
    setPwSaving(false)
  }

  // 点击背景关闭
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-discord-sidebar rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-bg">
          <h2 className="text-lg font-bold text-white">⚙️ 用户设置</h2>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-discord-hover transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-discord-bg overflow-x-auto">
          {[
            { key: 'profile', label: '👤 个人资料' },
            { key: 'appearance', label: '🎨 外观' },
            { key: 'notifications', label: '🔔 通知' },
            { key: 'security', label: '🔒 账号安全' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-discord-accent text-white'
                  : 'border-transparent text-discord-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ===== 个人资料 Tab ===== */}
          {activeTab === 'profile' && (
            <>
              {/* 头像预览 + 上传 */}
              <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => avatarFileRef.current?.click()}>
                  <Avatar
                    user={{ ...user, avatar_color: avatarColor, avatar_url: avatarPreview }}
                    size="xl"
                  />
                  {/* 悬停遮罩 */}
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? (
                      <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <span className="text-white text-xs font-medium">📷</span>
                    )}
                  </div>
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-lg">{user?.username}</div>
                  {composedStatus && (
                    <div className="text-discord-muted text-sm mt-1">{composedStatus}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => avatarFileRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="text-xs text-discord-accent hover:text-indigo-400 transition-colors disabled:opacity-50"
                    >
                      {uploadingAvatar ? '上传中...' : '更换头像'}
                    </button>
                    {avatarPreview && (
                      <>
                        <span className="text-discord-muted text-xs">·</span>
                        <button
                          onClick={handleRemoveAvatar}
                          disabled={uploadingAvatar}
                          className="text-xs text-discord-red hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          删除头像
                        </button>
                      </>
                    )}
                  </div>
                  {avatarMsg && <div className="text-xs mt-1">{avatarMsg}</div>}
                  <div className="text-xs text-discord-muted mt-1">支持 PNG/JPEG/WebP，最大 2MB</div>
                </div>
              </div>

              {/* 头像颜色选择 */}
              <div>
                <label className="block text-sm font-medium text-discord-muted mb-3">
                  头像颜色
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setAvatarColor(color)}
                      className={`w-10 h-10 rounded-full transition-all hover:scale-110 ${
                        avatarColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-discord-sidebar scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {/* 自定义颜色 */}
                  <label className="w-10 h-10 rounded-full bg-discord-hover flex items-center justify-center cursor-pointer hover:scale-110 transition-all relative overflow-hidden"
                    title="自定义颜色">
                    <span className="text-discord-muted text-xs">🎨</span>
                    <input
                      type="color"
                      value={avatarColor}
                      onChange={e => setAvatarColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* 自定义状态 */}
              <div>
                <label className="block text-sm font-medium text-discord-muted mb-2">
                  自定义状态
                </label>
                <div className="flex gap-2">
                  {/* Emoji 选择器 */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-10 h-10 bg-discord-input rounded-lg flex items-center justify-center text-xl hover:bg-discord-hover transition-colors"
                    >
                      {statusEmoji || '😶'}
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-discord-bg border border-discord-hover rounded-xl shadow-xl p-3">
                        <div className="grid grid-cols-8 gap-1 w-64">
                          <button
                            onClick={() => { setStatusEmoji(''); setShowEmojiPicker(false) }}
                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-discord-hover text-discord-muted text-xs"
                          >
                            ✕
                          </button>
                          {STATUS_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => { setStatusEmoji(emoji); setShowEmojiPicker(false) }}
                              className="w-8 h-8 flex items-center justify-center rounded hover:bg-discord-hover text-xl"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 状态文字 */}
                  <input
                    type="text"
                    value={statusText}
                    onChange={e => setStatusText(e.target.value)}
                    placeholder="在忙什么？（可选）"
                    maxLength={60}
                    className="flex-1 bg-discord-input text-discord-text text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 ring-discord-accent"
                  />
                </div>
                <div className="text-xs text-discord-muted mt-1">{composedStatus || '暂无状态'}</div>
              </div>

              {/* 个人简介 */}
              <div>
                <label className="block text-sm font-medium text-discord-muted mb-2">
                  个人简介
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="介绍一下自己..."
                  maxLength={200}
                  rows={3}
                  className="w-full bg-discord-input text-discord-text text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 ring-discord-accent resize-none"
                />
                <div className="text-xs text-discord-muted text-right">{bio.length}/200</div>
              </div>

              {/* 保存按钮 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-discord-accent hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? '保存中...' : '保存更改'}
                </button>
                {saveMsg && (
                  <span className="text-sm">{saveMsg}</span>
                )}
              </div>
            </>
          )}

          {/* ===== 外观设置 Tab ===== */}
          {activeTab === 'appearance' && (
            <>
              {/* 主题选择 */}
              <div>
                <label className="block text-sm font-medium text-discord-muted mb-3">
                  主题
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => applyTheme(theme.id)}
                      className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                        currentTheme === theme.id
                          ? 'border-discord-accent ring-1 ring-discord-accent/40'
                          : 'border-discord-hover hover:border-discord-muted'
                      }`}
                      style={{ background: theme.colors[0] }}
                    >
                      {/* 主题预览色块 */}
                      <div className="flex gap-1 mb-2">
                        {theme.colors.map((color, i) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-sm flex-shrink-0"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                      <div className="text-xs font-medium" style={{ color: theme.id === 'light' ? '#2e3338' : '#dcddde' }}>
                        {theme.name}
                      </div>
                      {currentTheme === theme.id && (
                        <div className="absolute top-2 right-2 w-4 h-4 bg-discord-accent rounded-full flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 字体大小 */}
              <div>
                <label className="block text-sm font-medium text-discord-muted mb-3">
                  字体大小
                </label>
                <div className="flex gap-2">
                  {FONT_SIZES.map(fs => (
                    <button
                      key={fs.id}
                      onClick={() => applyFontSize(fs.id)}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-center transition-all ${
                        currentFontSize === fs.id
                          ? 'border-discord-accent bg-discord-accent/20 text-white'
                          : 'border-discord-hover text-discord-muted hover:text-white hover:border-discord-muted'
                      }`}
                    >
                      <div style={{ fontSize: fs.size }} className="font-medium leading-none mb-1">Aa</div>
                      <div className="text-xs">{fs.label}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-discord-muted">
                  当前：<span className="text-discord-text">{FONT_SIZES.find(f => f.id === currentFontSize)?.size}</span>
                </div>
              </div>

              {/* 消息密度 */}
              <div>
                <label className="block text-sm font-medium text-discord-muted mb-3">
                  消息密度
                </label>
                <div className="space-y-2">
                  {DENSITIES.map(d => (
                    <button
                      key={d.id}
                      onClick={() => applyDensity(d.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all text-left ${
                        currentDensity === d.id
                          ? 'border-discord-accent bg-discord-accent/10'
                          : 'border-discord-hover hover:border-discord-muted'
                      }`}
                    >
                      <div>
                        <div className={`text-sm font-medium ${currentDensity === d.id ? 'text-white' : 'text-discord-text'}`}>
                          {d.label}
                        </div>
                        <div className="text-xs text-discord-muted">{d.desc}</div>
                      </div>
                      {currentDensity === d.id && (
                        <div className="w-5 h-5 bg-discord-accent rounded-full flex items-center justify-center flex-shrink-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 预览区域 */}
              <div>
                <label className="block text-sm font-medium text-discord-muted mb-2">预览</label>
                <div className="bg-discord-channel rounded-lg p-3 space-y-2">
                  <div className="flex gap-2.5 items-start">
                    <div className="w-8 h-8 rounded-full bg-discord-accent flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">J</div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white">Jarvis</span>
                        <span className="text-xs text-discord-muted">今天 12:00</span>
                      </div>
                      <div className="text-sm text-discord-text">你好！这是消息预览 👋</div>
                    </div>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <div className="w-8 h-8 rounded-full bg-green-600 flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">T</div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white">Tony</span>
                        <span className="text-xs text-discord-muted">今天 12:01</span>
                      </div>
                      <div className="text-sm text-discord-text">主题看起来很棒！</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== 通知设置 Tab ===== */}
          {activeTab === 'notifications' && (
            <>
              <div className="bg-discord-bg rounded-lg p-4 space-y-4">
                <h3 className="text-white font-medium">消息提醒</h3>

                {/* 音效开关 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-discord-text">消息提醒音效</div>
                    <div className="text-xs text-discord-muted mt-0.5">收到新消息时播放提示音</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !soundOn
                      setSoundOn(next)
                      setSoundEnabled(next)
                      if (next) playMessageSound()
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      soundOn ? 'bg-discord-accent' : 'bg-discord-hover'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        soundOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="text-xs text-discord-muted border-t border-discord-bg pt-3">
                  💡 @提及你的消息会播放更响亮的提示音
                </div>
              </div>

              <div className="bg-discord-bg rounded-lg p-4">
                <h3 className="text-white font-medium mb-3">桌面通知</h3>
                <div className="text-sm text-discord-text mb-3">
                  当前权限：
                  <span className={`ml-1 font-medium ${
                    'Notification' in window && Notification.permission === 'granted'
                      ? 'text-discord-green'
                      : 'text-discord-yellow'
                  }`}>
                    {'Notification' in window
                      ? (Notification.permission === 'granted' ? '✅ 已授权' : '⚠️ ' + Notification.permission)
                      : '不支持'
                    }
                  </span>
                </div>
                {'Notification' in window && Notification.permission !== 'granted' && (
                  <button
                    onClick={() => Notification.requestPermission()}
                    className="bg-discord-accent hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    授权桌面通知
                  </button>
                )}
              </div>
            </>
          )}

          {/* ===== 账号安全 Tab ===== */}
          {activeTab === 'security' && (
            <>
              <div className="bg-discord-bg rounded-lg p-4">
                <div className="text-sm text-discord-muted mb-1">用户名</div>
                <div className="text-white font-medium">{user?.username}</div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-4">修改密码</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-discord-muted mb-1">当前密码</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full bg-discord-input text-discord-text text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 ring-discord-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-discord-muted mb-1">新密码</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-discord-input text-discord-text text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 ring-discord-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-discord-muted mb-1">确认新密码</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-discord-input text-discord-text text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 ring-discord-accent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleChangePassword}
                    disabled={pwSaving}
                    className="bg-discord-accent hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {pwSaving ? '修改中...' : '修改密码'}
                  </button>
                  {pwMsg && <span className="text-sm">{pwMsg}</span>}
                </div>
              </div>

              {/* 账号信息 */}
              <div className="bg-discord-bg rounded-lg p-4 space-y-2">
                <h3 className="text-white font-medium mb-2">账号信息</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-discord-muted">用户 ID</span>
                  <span className="text-discord-text font-mono">{user?.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-discord-muted">注册时间</span>
                  <span className="text-discord-text">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '—'}
                  </span>
                </div>
              </div>

              {/* 服务器状态 */}
              <ServerStatusPanel />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
