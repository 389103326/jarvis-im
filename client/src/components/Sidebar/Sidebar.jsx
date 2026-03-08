/**
 * components/Sidebar/Sidebar.jsx - 侧边栏主组件
 * 支持: 频道/DM/提及/用户 Tab、移动端抽屉模式
 */

import React, { useState, useEffect } from 'react'
import useChatStore from '../../store/useChatStore'
import useAuthStore from '../../store/useAuthStore'
import ChannelList from './ChannelList'
import UserList from './UserList'
import DMList from './DMList'
import MentionsList from './MentionsList'
import Avatar from '../common/Avatar'
import UserSettingsModal from '../common/UserSettingsModal'

export default function Sidebar({ isMobileDrawer = false, onMobileClose }) {
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar, fetchChannels, fetchUsers, fetchDMList, fetchCategories, categories, activeType } = useChatStore()
  const [activeTab, setActiveTab] = useState('channels')

  // 当外部触发 DM（如点击用户列表），自动切换侧边栏到私信 Tab
  useEffect(() => {
    if (activeType === 'dm') {
      setActiveTab('dms')
    }
  }, [activeType])
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [createCategoryId, setCreateCategoryId] = useState(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const createChannel = useChatStore(state => state.createChannel)

  useEffect(() => {
    fetchChannels()
    fetchCategories()
    fetchUsers()
    fetchDMList()
  }, [])

  const handleOpenCreateChannel = (categoryId) => {
    setCreateCategoryId(categoryId)
    setShowCreateChannel(true)
    setNewChannelName('')
    setNewChannelDesc('')
  }

  const handleCreateChannel = async (e) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    const result = await createChannel(newChannelName.trim(), newChannelDesc.trim(), createCategoryId)
    if (result.success) {
      setShowCreateChannel(false)
      setNewChannelName('')
      setNewChannelDesc('')
      setCreateCategoryId(null)
    } else {
      alert(result.error)
    }
  }

  const createCategoryName = createCategoryId
    ? categories.find(c => c.id === createCategoryId)?.name
    : null

  // 从 custom_status 提取 emoji（用于底部显示）
  const statusEmoji = (() => {
    const s = user?.custom_status || ''
    const match = s.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u)
    return match ? match[1] : null
  })()

  // 移动端抽屉模式：固定宽度 + 全高度
  // 桌面端折叠状态时：icon-only 窄栏
  const isCollapsed = !isMobileDrawer && !sidebarOpen

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center w-14 bg-discord-bg py-3 gap-2">
        <button
          onClick={toggleSidebar}
          className="w-10 h-10 bg-discord-sidebar rounded-full flex items-center justify-center text-discord-muted hover:text-white transition-colors"
          title="打开侧边栏"
        >
          ☰
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-discord-sidebar flex-shrink-0 ${
      isMobileDrawer
        ? 'w-72 h-full shadow-2xl'
        : 'w-60'
    }`}>
      {/* 顶部 Tab + 关闭按钮 */}
      <div className="flex items-center px-3 pt-3 pb-2 border-b border-discord-bg gap-1">
        <button
          onClick={() => setActiveTab('channels')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'channels' ? 'bg-discord-accent text-white' : 'text-discord-muted hover:text-white'
          }`}
        >
          # 频道
        </button>
        <button
          onClick={() => setActiveTab('dms')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'dms' ? 'bg-discord-accent text-white' : 'text-discord-muted hover:text-white'
          }`}
        >
          ✉ 私信
        </button>
        <button
          onClick={() => setActiveTab('mentions')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'mentions' ? 'bg-discord-accent text-white' : 'text-discord-muted hover:text-white'
          }`}
          title="@提及消息"
        >
          🔔
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'users' ? 'bg-discord-accent text-white' : 'text-discord-muted hover:text-white'
          }`}
        >
          👥
        </button>
        {/* 移动端：关闭按钮；桌面端：折叠按钮 */}
        {isMobileDrawer ? (
          <button
            onClick={onMobileClose}
            className="ml-1 text-discord-muted hover:text-white w-7 h-7 flex items-center justify-center rounded hover:bg-discord-hover transition-colors"
            title="关闭"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={toggleSidebar}
            className="ml-1 text-discord-muted hover:text-white text-xs px-1"
            title="折叠侧边栏"
          >
            ◀
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto py-2">
        {activeTab === 'channels' && (
          <>
            {/* 全局创建频道按钮（无分类时显示）*/}
            {categories.length === 0 && (
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-discord-muted uppercase tracking-wider">频道</span>
                <button
                  onClick={() => handleOpenCreateChannel(null)}
                  className="text-discord-muted hover:text-white text-lg leading-none"
                  title="创建频道"
                >
                  +
                </button>
              </div>
            )}

            {/* 创建频道表单 */}
            {showCreateChannel && (
              <form onSubmit={handleCreateChannel} className="mx-3 mb-3 bg-discord-bg rounded-lg p-3 space-y-2">
                {createCategoryName && (
                  <div className="text-xs text-discord-muted">
                    在 <span className="text-discord-accent">{createCategoryName}</span> 中创建频道
                  </div>
                )}
                <input
                  type="text"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="频道名称"
                  className="w-full bg-discord-input text-discord-text text-sm px-2 py-1.5 rounded outline-none focus:ring-1 ring-discord-accent"
                  autoFocus
                />
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  placeholder="描述（可选）"
                  className="w-full bg-discord-input text-discord-text text-sm px-2 py-1.5 rounded outline-none focus:ring-1 ring-discord-accent"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-discord-accent text-white text-xs py-1.5 rounded hover:bg-indigo-600"
                  >
                    创建
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateChannel(false); setCreateCategoryId(null) }}
                    className="flex-1 bg-discord-hover text-discord-muted text-xs py-1.5 rounded hover:text-white"
                  >
                    取消
                  </button>
                </div>
              </form>
            )}

            <ChannelList onCreateChannel={handleOpenCreateChannel} />
          </>
        )}

        {activeTab === 'dms' && <DMList />}
        {activeTab === 'mentions' && <MentionsList />}
        {activeTab === 'users' && <UserList />}
      </div>

      {/* 底部用户信息 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-discord-bg">
        <Avatar user={user} size="sm" showStatus />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-white truncate">{user?.username}</span>
            {statusEmoji && <span className="text-sm">{statusEmoji}</span>}
          </div>
          <div className="text-xs text-discord-muted truncate">
            {user?.custom_status
              ? (user.custom_status.length > 20 ? user.custom_status.slice(0, 20) + '…' : user.custom_status)
              : <span className="text-discord-green">在线</span>
            }
          </div>
        </div>
        {/* 设置按钮 */}
        <button
          onClick={() => setShowSettings(true)}
          className="text-discord-muted hover:text-white text-sm px-1.5 py-1 rounded transition-colors"
          title="用户设置"
        >
          ⚙️
        </button>
        <button
          onClick={logout}
          className="text-discord-muted hover:text-discord-red text-xs px-2 py-1 rounded transition-colors"
          title="退出登录"
        >
          退出
        </button>
      </div>

      {/* 用户设置弹窗 */}
      {showSettings && (
        <UserSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
