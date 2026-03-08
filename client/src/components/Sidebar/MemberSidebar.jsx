/**
 * components/Sidebar/MemberSidebar.jsx - 右侧成员列表（UI 美化版）
 */

import React, { useState } from 'react'
import useChatStore from '../../store/useChatStore'
import useAuthStore from '../../store/useAuthStore'
import Avatar from '../common/Avatar'

export default function MemberSidebar() {
  const { users, onlineUsers, toggleMemberSidebar, openDM, setActiveChannel, fetchMessages } = useChatStore()
  const { user: me } = useAuthStore()
  const [search, setSearch] = useState('')

  const filtered = users.filter(u =>
    !search || u.username.toLowerCase().includes(search.toLowerCase())
  )
  const online = filtered.filter(u => onlineUsers.has(u.id))
  const offline = filtered.filter(u => !onlineUsers.has(u.id))

  const handleDM = async (targetUser) => {
    if (targetUser.id === me?.id) return
    const result = await openDM(targetUser.id)
    if (result.success) {
      setActiveChannel(result.dm.id, 'dm')
      fetchMessages(result.dm.id, 'dm')
    }
  }

  return (
    <div className="flex flex-col w-64 bg-discord-sidebar flex-shrink-0 border-l border-black/20">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-discord-green shadow-[0_0_6px_rgba(87,242,135,0.6)]" />
          <span className="text-xs font-bold text-discord-muted uppercase tracking-widest">
            成员
          </span>
          <span className="text-xs text-discord-muted bg-discord-bg px-1.5 py-0.5 rounded-full font-medium">
            {users.length}
          </span>
        </div>
        <button
          onClick={toggleMemberSidebar}
          className="w-6 h-6 flex items-center justify-center rounded text-discord-muted hover:text-white hover:bg-discord-hover transition-all text-xs"
          title="关闭成员栏"
        >
          ✕
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 pb-3">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-discord-muted text-xs pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索成员..."
            className="w-full bg-discord-bg text-discord-text text-xs pl-7 pr-3 py-1.5 rounded-lg outline-none focus:ring-1 ring-discord-accent/60 placeholder:text-discord-muted transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-discord-muted hover:text-white text-xs"
            >✕</button>
          )}
        </div>
      </div>

      {/* 分割线 */}
      <div className="mx-4 border-t border-discord-bg mb-1" />

      {/* 成员列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-discord-bg">
        {/* 在线成员 */}
        {online.length > 0 && (
          <section>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-discord-green flex-shrink-0" />
              <span className="text-[10px] font-bold text-discord-green uppercase tracking-widest">
                在线 {online.length}
              </span>
            </div>
            {online.map(u => (
              <MemberItem
                key={u.id}
                user={u}
                isOnline={true}
                isMe={u.id === me?.id}
                onDM={() => handleDM(u)}
              />
            ))}
          </section>
        )}

        {/* 离线成员 */}
        {offline.length > 0 && (
          <section className={online.length > 0 ? 'mt-3' : ''}>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-discord-muted flex-shrink-0" />
              <span className="text-[10px] font-bold text-discord-muted uppercase tracking-widest">
                离线 {offline.length}
              </span>
            </div>
            {offline.map(u => (
              <MemberItem
                key={u.id}
                user={u}
                isOnline={false}
                isMe={u.id === me?.id}
                onDM={() => handleDM(u)}
              />
            ))}
          </section>
        )}

        {/* 空状态 */}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-discord-muted text-xs">
            {search ? `没有找到"${search}"` : '暂无成员'}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className="px-4 py-2 border-t border-discord-bg flex items-center gap-3 text-[10px] text-discord-muted">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-discord-green inline-block" />
          {online.length} 在线
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-discord-muted inline-block" />
          {offline.length} 离线
        </span>
      </div>
    </div>
  )
}

function MemberItem({ user, isOnline, isMe, onDM }) {
  const [hovered, setHovered] = useState(false)

  const statusEmoji = (() => {
    const s = user?.custom_status || ''
    const match = s.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u)
    return match ? match[1] : null
  })()

  return (
    <div
      className={`
        group relative flex items-center gap-2.5 px-2 py-2 rounded-lg
        transition-all duration-150 cursor-pointer select-none
        ${isMe
          ? 'hover:bg-discord-accent/10'
          : 'hover:bg-discord-hover'
        }
        ${isOnline ? '' : 'opacity-60 hover:opacity-100'}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={isMe ? undefined : onDM}
      title={isMe ? `${user.username}（我）` : `发送私信给 ${user.username}`}
    >
      {/* 头像 */}
      <div className="relative flex-shrink-0">
        <Avatar user={user} size="sm" />
        <span
          className={`
            absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-sidebar
            transition-colors
            ${isOnline ? 'bg-discord-green' : 'bg-discord-muted/60'}
          `}
        />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium truncate leading-tight ${
            isOnline ? 'text-discord-text group-hover:text-white' : 'text-discord-muted group-hover:text-discord-text'
          }`}>
            {user.username}
            {isMe && <span className="text-[10px] text-discord-muted ml-1 font-normal">(我)</span>}
          </span>
          {statusEmoji && <span className="text-xs flex-shrink-0">{statusEmoji}</span>}
        </div>
        {user.custom_status ? (
          <div className="text-[10px] text-discord-muted truncate leading-tight mt-0.5">
            {user.custom_status.replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, '')}
          </div>
        ) : (
          <div className={`text-[10px] leading-tight mt-0.5 ${isOnline ? 'text-discord-green' : 'text-discord-muted'}`}>
            {isOnline ? '在线' : '离线'}
          </div>
        )}
      </div>

      {/* Hover 时显示的私信按钮 */}
      {!isMe && hovered && (
        <button
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-discord-accent/80 hover:bg-discord-accent text-white text-xs transition-colors"
          title={`私信 ${user.username}`}
          onClick={(e) => { e.stopPropagation(); onDM() }}
        >
          ✉
        </button>
      )}
    </div>
  )
}
