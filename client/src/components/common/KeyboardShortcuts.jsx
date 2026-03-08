/**
 * components/common/KeyboardShortcuts.jsx - 键盘快捷键帮助弹窗
 * 触发: 按 ? 键（非输入状态下）或点击 ? 按钮
 */

import React, { useEffect } from 'react'

const SHORTCUTS = [
  {
    category: '导航',
    items: [
      { keys: ['Ctrl', 'K'], desc: '打开命令面板（快速跳转频道/用户）' },
      { keys: ['Alt', '↑ / ↓'], desc: '切换到上一个/下一个频道' },
      { keys: ['Esc'], desc: '关闭弹窗 / 取消回复' },
      { keys: ['?'], desc: '显示键盘快捷键帮助' },
    ]
  },
  {
    category: '消息输入',
    items: [
      { keys: ['Enter'], desc: '发送消息' },
      { keys: ['Shift', 'Enter'], desc: '换行' },
      { keys: ['Ctrl', 'B'], desc: '**粗体**' },
      { keys: ['Ctrl', 'I'], desc: '*斜体*' },
      { keys: ['Ctrl', 'E'], desc: '`行内代码`' },
      { keys: ['Ctrl', 'Shift', 'X'], desc: '~~删除线~~' },
      { keys: ['↑ / ↓'], desc: '@提及补全列表上下选择' },
    ]
  },
  {
    category: '消息操作',
    items: [
      { keys: ['悬停 → ✏️'], desc: '编辑自己的消息' },
      { keys: ['悬停 → 🗑️'], desc: '删除自己的消息' },
      { keys: ['悬停 → ↩'], desc: '回复消息' },
      { keys: ['悬停 → 📌'], desc: '固定消息（频道）' },
      { keys: ['点击引用'], desc: '跳转到被引用的原消息' },
    ]
  },
  {
    category: '界面',
    items: [
      { keys: ['◀ 折叠'], desc: '折叠/展开左侧边栏' },
      { keys: ['👥 按钮'], desc: '显示/隐藏成员列表' },
      { keys: ['⚙️ 按钮'], desc: '打开用户设置' },
      { keys: ['滚轮 → 顶部'], desc: '自动加载更多历史消息' },
    ]
  },
]

export default function KeyboardShortcuts({ onClose }) {
  // Esc 关闭
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="shortcuts-modal w-full max-w-2xl max-h-[80vh] bg-discord-sidebar rounded-xl shadow-2xl border border-discord-bg overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-discord-bg">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            ⌨️ 键盘快捷键
          </h2>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white text-xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 内容区域 */}
        <div className="overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {SHORTCUTS.map(section => (
            <div key={section.category}>
              <h3 className="text-xs font-semibold text-discord-muted uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <span className="text-discord-text text-sm flex-1">{item.desc}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && (
                            <span className="text-discord-muted text-xs">+</span>
                          )}
                          <kbd>{k}</kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="px-5 py-3 border-t border-discord-bg text-center">
          <p className="text-discord-muted text-xs">按 <kbd>?</kbd> 或 <kbd>Esc</kbd> 关闭</p>
        </div>
      </div>
    </div>
  )
}
