/**
 * components/Chat/LinkPreviewCard.jsx - URL 链接预览卡片
 * 自动检测消息文本中的 URL，获取 OG 标签并展示预览
 */

import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// 简单的客户端内存缓存（避免重复请求）
const previewCache = new Map()

// 提取文本中的第一个 HTTP/HTTPS URL
export function extractFirstUrl(text) {
  if (!text) return null
  const match = text.match(/https?:\/\/[^\s<>"'）】\]]+/)
  return match ? match[0] : null
}

// 是否应该跳过预览（纯图片链接等）
function shouldSkipUrl(url) {
  if (!url) return true
  const ext = url.split('?')[0].split('#')[0].toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|mp4|mp3|pdf|zip|tar|gz)$/.test(ext)) return true
  return false
}

export default function LinkPreviewCard({ url }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!url || dismissed || shouldSkipUrl(url)) return

    // 命中缓存
    if (previewCache.has(url)) {
      const cached = previewCache.get(url)
      if (cached !== null) setPreview(cached)
      return
    }

    setLoading(true)
    axios.get('/api/messages/link-preview', { params: { url }, timeout: 8000 })
      .then(res => {
        if (!mountedRef.current) return
        const data = res.data
        // 如果没有有效数据，不显示卡片
        if (!data.title && !data.description && !data.image) {
          previewCache.set(url, null) // 标记为"无预览"
          setLoading(false)
          return
        }
        previewCache.set(url, data)
        setPreview(data)
        setLoading(false)
      })
      .catch(() => {
        if (mountedRef.current) {
          previewCache.set(url, null)
          setLoading(false)
        }
      })
  }, [url, dismissed])

  if (dismissed || !url || shouldSkipUrl(url)) return null
  if (loading) {
    return (
      <div className="mt-1.5 max-w-sm">
        <div className="bg-discord-sidebar border-l-2 border-discord-accent/30 rounded-r-lg px-3 py-2">
          <div className="skeleton h-3 w-24 rounded mb-1.5" />
          <div className="skeleton h-2.5 w-48 rounded" />
        </div>
      </div>
    )
  }
  if (!preview) return null

  return (
    <div className="mt-1.5 max-w-lg group/card relative">
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 bg-discord-sidebar border-l-2 border-discord-accent rounded-r-lg overflow-hidden hover:bg-discord-hover/50 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* 左侧文字区域 */}
        <div className="flex-1 px-3 py-2.5 min-w-0">
          {/* 站点名 + favicon */}
          <div className="flex items-center gap-1.5 mb-1">
            {preview.favicon && (
              <img
                src={preview.favicon}
                alt=""
                className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                onError={e => { e.target.style.display = 'none' }}
              />
            )}
            <span className="text-xs text-discord-muted truncate">
              {preview.siteName || new URL(preview.url).hostname.replace('www.', '')}
            </span>
          </div>

          {/* 标题 */}
          {preview.title && (
            <div className="text-sm font-semibold text-discord-accent hover:underline line-clamp-2 leading-snug mb-1">
              {preview.title}
            </div>
          )}

          {/* 描述 */}
          {preview.description && (
            <div className="text-xs text-discord-muted line-clamp-2 leading-relaxed">
              {preview.description}
            </div>
          )}
        </div>

        {/* 右侧缩略图 */}
        {preview.image && (
          <div className="flex-shrink-0 w-20 h-16 overflow-hidden rounded-r-lg">
            <img
              src={preview.image}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
        )}
      </a>

      {/* 关闭按钮（hover时显示） */}
      <button
        onClick={e => { e.stopPropagation(); setDismissed(true) }}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-discord-hover border border-discord-bg rounded-full text-discord-muted hover:text-white text-[10px] leading-none items-center justify-center hidden group-hover/card:flex transition-colors z-10"
        title="关闭预览"
      >
        ✕
      </button>
    </div>
  )
}
