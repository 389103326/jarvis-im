/**
 * components/Sidebar/UserList.jsx - 在线用户列表
 */

import React from 'react'
import useChatStore from '../../store/useChatStore'
import useAuthStore from '../../store/useAuthStore'
import Avatar from '../common/Avatar'

export default function UserList() {
  const { users, onlineUsers, openDM, setActiveChannel, fetchMessages } = useChatStore()
  const { user: me } = useAuthStore()
  
  const handleUserClick = async (targetUser) => {
    if (targetUser.id === me?.id) return
    
    const result = await openDM(targetUser.id)
    if (result.success) {
      setActiveChannel(result.dm.id, 'dm')
      fetchMessages(result.dm.id, 'dm')
    }
  }
  
  // 在线用户在前
  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = onlineUsers.has(a.id)
    const bOnline = onlineUsers.has(b.id)
    if (aOnline !== bOnline) return bOnline - aOnline
    return a.username.localeCompare(b.username)
  })
  
  const onlineList = sortedUsers.filter(u => onlineUsers.has(u.id))
  const offlineList = sortedUsers.filter(u => !onlineUsers.has(u.id))
  
  return (
    <div>
      {onlineList.length > 0 && (
        <>
          <div className="px-3 mb-1">
            <span className="text-xs font-semibold text-discord-muted uppercase tracking-wider">
              在线 — {onlineList.length}
            </span>
          </div>
          {onlineList.map(user => (
            <UserItem key={user.id} user={user} isMe={user.id === me?.id} onClick={() => handleUserClick(user)} />
          ))}
        </>
      )}
      
      {offlineList.length > 0 && (
        <>
          <div className="px-3 mt-3 mb-1">
            <span className="text-xs font-semibold text-discord-muted uppercase tracking-wider">
              离线 — {offlineList.length}
            </span>
          </div>
          {offlineList.map(user => (
            <UserItem key={user.id} user={user} isMe={user.id === me?.id} onClick={() => handleUserClick(user)} />
          ))}
        </>
      )}
    </div>
  )
}

function UserItem({ user, isMe, onClick }) {
  // 从 custom_status 提取 emoji
  const statusEmoji = (() => {
    const s = user?.custom_status || ''
    const match = s.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u)
    return match ? match[1] : null
  })()

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md ${
        isMe ? 'cursor-default' : 'cursor-pointer channel-item'
      } text-discord-muted hover:text-white`}
      onClick={isMe ? undefined : onClick}
    >
      <Avatar user={user} size="sm" showStatus />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm truncate">{user.username}{isMe && ' (我)'}</span>
          {statusEmoji && <span className="text-xs">{statusEmoji}</span>}
        </div>
        {user.custom_status && (
          <div className="text-xs text-discord-muted truncate" title={user.custom_status}>
            {user.custom_status.length > 20 ? user.custom_status.slice(0, 20) + '…' : user.custom_status}
          </div>
        )}
      </div>
    </div>
  )
}
