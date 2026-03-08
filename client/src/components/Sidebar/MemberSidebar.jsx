/**
 * components/Sidebar/MemberSidebar.jsx - 右侧成员列表
 */

import React from 'react'
import useChatStore from '../../store/useChatStore'
import Avatar from '../common/Avatar'

export default function MemberSidebar() {
  const { users, onlineUsers, toggleMemberSidebar } = useChatStore()

  const online = users.filter(u => onlineUsers.has(u.id))
  const offline = users.filter(u => !onlineUsers.has(u.id))

  return (
    <div className="flex flex-col w-56 bg-discord-sidebar flex-shrink-0 border-l border-discord-bg">
      {/* 标题 */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-discord-bg">
        <span className="text-xs font-semibold text-discord-muted uppercase tracking-wider">
          成员列表
        </span>
        <button
          onClick={toggleMemberSidebar}
          className="text-discord-muted hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-discord-hover transition-colors"
        >
          ✕
        </button>
      </div>

      {/* 成员列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* 在线成员 */}
        {online.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-discord-muted uppercase tracking-wider">
              在线 — {online.length}
            </div>
            {online.map(u => (
              <MemberItem key={u.id} user={u} isOnline={true} />
            ))}
          </div>
        )}

        {/* 离线成员 */}
        {offline.length > 0 && (
          <div className="mt-2">
            <div className="px-3 py-1.5 text-xs font-semibold text-discord-muted uppercase tracking-wider">
              离线 — {offline.length}
            </div>
            {offline.map(u => (
              <MemberItem key={u.id} user={u} isOnline={false} />
            ))}
          </div>
        )}

        {users.length === 0 && (
          <div className="px-3 py-4 text-center text-discord-muted text-xs">
            暂无成员
          </div>
        )}
      </div>
    </div>
  )
}

function MemberItem({ user, isOnline }) {
  const { openDM, setActiveChannel, fetchMessages } = useChatStore()
  const { user: me } = useChatStore(s => ({ user: s.users }))

  const handleClick = async () => {
    // 点击可发起私信
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer hover:bg-discord-hover transition-colors"
      title={user.username}
    >
      <div className="relative flex-shrink-0">
        <Avatar user={user} size="sm" />
        {/* 在线状态点 */}
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-discord-sidebar ${
            isOnline ? 'bg-discord-green' : 'bg-discord-muted'
          }`}
        />
      </div>
      <span className={`text-sm truncate ${isOnline ? 'text-discord-text' : 'text-discord-muted'}`}>
        {user.username}
      </span>
    </div>
  )
}
