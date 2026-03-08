/**
 * utils/format.js - 工具函数
 */

/**
 * 格式化消息时间
 * 今天显示时间，其他显示日期
 */
export function formatMessageTime(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()

  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

/**
 * 格式化完整时间（悬停显示）
 */
export function formatFullTime(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 格式化时间分隔线（日期+时间）
 */
export function formatTimeDivider(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isToday) return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  if (isYesterday) return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * 判断两条消息是否需要时间分隔线（间隔 > 5 分钟）
 */
export function needsTimeDivider(prevMsg, currMsg) {
  if (!prevMsg) return false
  const prev = new Date(prevMsg.createdAt)
  const curr = new Date(currMsg.createdAt)
  return (curr - prev) > 5 * 60 * 1000
}

/**
 * 判断消息是否可以合并（同一人连续发送，间隔 < 5 分钟）
 */
export function isGroupedMessage(prevMsg, currMsg) {
  if (!prevMsg) return false
  if (prevMsg.senderId !== currMsg.senderId) return false
  if (prevMsg.type === 'system' || currMsg.type === 'system') return false
  const prev = new Date(prevMsg.createdAt)
  const curr = new Date(currMsg.createdAt)
  return (curr - prev) < 5 * 60 * 1000
}

/**
 * 简单 Markdown 渲染
 * 支持: **bold**, *italic*, `code`, ```code block```, [link](url), auto links
 */
export function renderMarkdown(text) {
  if (!text) return []

  // 先处理代码块（多行）
  const segments = []
  const codeBlockRegex = /```([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'codeblock', content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  // 对每个文本段落，解析行内格式
  const result = []
  for (const seg of segments) {
    if (seg.type === 'codeblock') {
      result.push({ type: 'codeblock', content: seg.content, key: `cb_${result.length}` })
    } else {
      const inlineResult = parseInline(seg.content, result.length)
      result.push(...inlineResult)
    }
  }

  return result
}

function parseInline(text, keyOffset = 0) {
  const parts = []
  // 解析顺序: 行内代码, 粗体, 斜体, 删除线, 链接, 自动链接
  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s]+)/g
  let lastIndex = 0
  let match
  let i = 0

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'plain', content: text.slice(lastIndex, match.index), key: `p_${keyOffset}_${i++}` })
    }

    const token = match[0]
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push({ type: 'code', content: token.slice(1, -1), key: `ic_${keyOffset}_${i++}` })
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push({ type: 'bold', content: token.slice(2, -2), key: `b_${keyOffset}_${i++}` })
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push({ type: 'italic', content: token.slice(1, -1), key: `it_${keyOffset}_${i++}` })
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push({ type: 'strikethrough', content: token.slice(2, -2), key: `s_${keyOffset}_${i++}` })
    } else if (match[2] && match[3]) {
      parts.push({ type: 'link', content: match[2], href: match[3], key: `lk_${keyOffset}_${i++}` })
    } else if (token.startsWith('http')) {
      parts.push({ type: 'link', content: token, href: token, key: `al_${keyOffset}_${i++}` })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'plain', content: text.slice(lastIndex), key: `p_${keyOffset}_${i++}` })
  }

  return parts
}

/**
 * 处理消息内容中的 @提及
 * 返回 React 元素数组
 */
export function renderMentions(content, users = []) {
  if (!content) return content

  const parts = []
  const mentionRegex = /@([a-zA-Z0-9_\u4e00-\u9fa5]+)/g
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    const username = match[1]
    const isUser = users.some(u => u.username === username)

    if (isUser) {
      parts.push({ type: 'mention', username, key: match.index })
    } else {
      parts.push(match[0])
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

/**
 * 代码语法高亮 - 内置轻量实现
 * 支持: JS/TS/Python/Go/Rust/Shell 通用关键字
 * 返回 token 数组: { type: 'keyword'|'string'|'comment'|'number'|'builtin'|'plain', value }
 */
const KEYWORDS = new Set([
  // JS/TS
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'class', 'extends', 'new',
  'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch',
  'finally', 'throw', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of',
  'null', 'undefined', 'true', 'false', 'this', 'super', 'static',
  // Python
  'def', 'pass', 'lambda', 'yield', 'with', 'as', 'not', 'and', 'or',
  'elif', 'except', 'raise', 'global', 'nonlocal', 'assert', 'del',
  // Go
  'package', 'func', 'type', 'struct', 'interface', 'map', 'chan', 'go',
  'defer', 'select', 'range', 'make', 'len', 'cap', 'append',
  // Rust
  'fn', 'let', 'mut', 'use', 'mod', 'pub', 'impl', 'trait', 'enum',
  'match', 'where', 'ref', 'move', 'unsafe', 'extern', 'crate',
  // Shell
  'echo', 'export', 'source', 'alias',
])

export function highlightCode(code) {
  const tokens = []
  let i = 0
  const len = code.length

  while (i < len) {
    // 注释（// 单行）
    if (code[i] === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      const comment = end === -1 ? code.slice(i) : code.slice(i, end)
      tokens.push({ type: 'comment', value: comment })
      i += comment.length
      continue
    }

    // 注释（# Python/Shell）
    if (code[i] === '#' && (i === 0 || code[i - 1] === '\n' || code[i - 1] === ' ')) {
      const end = code.indexOf('\n', i)
      const comment = end === -1 ? code.slice(i) : code.slice(i, end)
      tokens.push({ type: 'comment', value: comment })
      i += comment.length
      continue
    }

    // 字符串（单引号/双引号/模板字符串）
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i]
      let j = i + 1
      while (j < len) {
        if (code[j] === '\\') { j += 2; continue }
        if (code[j] === quote) { j++; break }
        j++
      }
      tokens.push({ type: 'string', value: code.slice(i, j) })
      i = j
      continue
    }

    // 数字
    if (/\d/.test(code[i]) && (i === 0 || /\W/.test(code[i - 1]))) {
      let j = i
      while (j < len && /[\d._xXbBoO]/.test(code[j])) j++
      tokens.push({ type: 'number', value: code.slice(i, j) })
      i = j
      continue
    }

    // 标识符（关键字 / 内置 / 普通）
    if (/[a-zA-Z_$\u4e00-\u9fa5]/.test(code[i])) {
      let j = i
      while (j < len && /[\w\u4e00-\u9fa5]/.test(code[j])) j++
      const word = code.slice(i, j)
      if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word })
      } else if (/^[A-Z]/.test(word) && word.length > 1) {
        tokens.push({ type: 'builtin', value: word }) // 类名/构造函数
      } else {
        tokens.push({ type: 'plain', value: word })
      }
      i = j
      continue
    }

    // 其余字符逐字追加
    const last = tokens[tokens.length - 1]
    if (last && last.type === 'plain') {
      last.value += code[i]
    } else {
      tokens.push({ type: 'plain', value: code[i] })
    }
    i++
  }

  return tokens
}


export function getAvatarInitial(username) {
  if (!username) return '?'
  return username[0].toUpperCase()
}

/**
 * 图片文件转 base64
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 检查是否是图片文件
 */
export function isImageFile(file) {
  return file.type.startsWith('image/')
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ==================== Emoji 短码数据库 ====================

/**
 * Emoji 短码列表 — 支持 :fire: 风格自动补全
 * 每项: { code, emoji, aliases? }
 */
export const EMOJI_SHORTCODES = [
  { code: 'thumbsup',        emoji: '👍', aliases: ['+1', 'like', 'good'] },
  { code: 'thumbsdown',      emoji: '👎', aliases: ['-1', 'bad'] },
  { code: 'heart',           emoji: '❤️', aliases: ['love', 'red_heart'] },
  { code: 'smile',           emoji: '😄', aliases: ['happy', 'grin'] },
  { code: 'joy',             emoji: '😂', aliases: ['laugh', 'lol', 'haha'] },
  { code: 'rofl',            emoji: '🤣', aliases: ['rolling_laugh'] },
  { code: 'wow',             emoji: '😮', aliases: ['open_mouth', 'surprised'] },
  { code: 'cry',             emoji: '😢', aliases: ['sad', 'tear'] },
  { code: 'angry',           emoji: '😡', aliases: ['mad', 'rage'] },
  { code: 'fire',            emoji: '🔥', aliases: ['hot', 'lit'] },
  { code: 'check',           emoji: '✅', aliases: ['done', 'ok', 'yes', 'tick'] },
  { code: 'eyes',            emoji: '👀', aliases: ['looking', 'see'] },
  { code: 'pray',            emoji: '🙏', aliases: ['thanks', 'please', 'folded_hands'] },
  { code: '100',             emoji: '💯', aliases: ['perfect', 'hundred'] },
  { code: 'tada',            emoji: '🎉', aliases: ['party', 'celebrate', 'congrats'] },
  { code: 'rocket',          emoji: '🚀', aliases: ['launch', 'ship'] },
  { code: 'star',            emoji: '⭐', aliases: ['stars', 'favorite'] },
  { code: 'sparkles',        emoji: '✨', aliases: ['magic', 'glitter'] },
  { code: 'thinking',        emoji: '🤔', aliases: ['think', 'hmm'] },
  { code: 'wave',            emoji: '👋', aliases: ['hello', 'hi', 'bye'] },
  { code: 'clap',            emoji: '👏', aliases: ['applause', 'bravo'] },
  { code: 'muscle',          emoji: '💪', aliases: ['strong', 'flex', 'power'] },
  { code: 'sunglasses',      emoji: '😎', aliases: ['cool', 'awesome'] },
  { code: 'sweat_smile',     emoji: '😅', aliases: ['nervous', 'heh'] },
  { code: 'wink',            emoji: '😉' },
  { code: 'blush',           emoji: '😊', aliases: ['happy'] },
  { code: 'innocent',        emoji: '😇', aliases: ['angel'] },
  { code: 'heart_eyes',      emoji: '😍', aliases: ['love_eyes'] },
  { code: 'kissing',         emoji: '😘', aliases: ['kiss'] },
  { code: 'nerd',            emoji: '🤓', aliases: ['geek', 'glasses'] },
  { code: 'party_face',      emoji: '🥳', aliases: ['party', 'birthday'] },
  { code: 'sob',             emoji: '😭', aliases: ['bawling', 'weep'] },
  { code: 'flushed',         emoji: '😳', aliases: ['surprised', 'blush'] },
  { code: 'skull',           emoji: '💀', aliases: ['dead', 'rip', 'skull_crossbones'] },
  { code: 'ghost',           emoji: '👻', aliases: ['spooky'] },
  { code: 'robot',           emoji: '🤖', aliases: ['ai', 'bot'] },
  { code: 'alien',           emoji: '👽' },
  { code: 'poop',            emoji: '💩', aliases: ['shit'] },
  { code: 'bug',             emoji: '🐛', aliases: ['issue', 'error'] },
  { code: 'coffee',          emoji: '☕', aliases: ['cafe', 'morning'] },
  { code: 'beer',            emoji: '🍺', aliases: ['cheers'] },
  { code: 'pizza',           emoji: '🍕' },
  { code: 'bulb',            emoji: '💡', aliases: ['idea', 'tip'] },
  { code: 'warning',         emoji: '⚠️', aliases: ['alert', 'caution'] },
  { code: 'no_entry',        emoji: '🚫', aliases: ['forbidden', 'ban', 'no'] },
  { code: 'question',        emoji: '❓', aliases: ['ask', 'why'] },
  { code: 'exclamation',     emoji: '❗', aliases: ['important', 'attention'] },
  { code: 'zap',             emoji: '⚡', aliases: ['lightning', 'fast', 'power'] },
  { code: 'rainbow',         emoji: '🌈' },
  { code: 'snowflake',       emoji: '❄️', aliases: ['snow', 'cold', 'ice'] },
  { code: 'sun',             emoji: '☀️', aliases: ['sunny', 'hot'] },
  { code: 'moon',            emoji: '🌙', aliases: ['night', 'crescent'] },
  { code: 'earth',           emoji: '🌍', aliases: ['world', 'globe'] },
  { code: 'computer',        emoji: '💻', aliases: ['laptop', 'mac'] },
  { code: 'phone',           emoji: '📱', aliases: ['mobile', 'iphone'] },
  { code: 'calendar',        emoji: '📅', aliases: ['date', 'schedule'] },
  { code: 'clock',           emoji: '🕐', aliases: ['time', 'watch'] },
  { code: 'lock',            emoji: '🔒', aliases: ['locked', 'secure', 'private'] },
  { code: 'key',             emoji: '🔑', aliases: ['password', 'unlock'] },
  { code: 'money',           emoji: '💰', aliases: ['cash', 'rich', 'wealth'] },
  { code: 'chart',           emoji: '📈', aliases: ['growth', 'up', 'stats'] },
  { code: 'chart_down',      emoji: '📉', aliases: ['down', 'decline'] },
  { code: 'target',          emoji: '🎯', aliases: ['goal', 'aim', 'bullseye'] },
  { code: 'link',            emoji: '🔗', aliases: ['url', 'chain'] },
  { code: 'pin',             emoji: '📌', aliases: ['pinned', 'pushpin'] },
  { code: 'inbox',           emoji: '📥', aliases: ['received'] },
  { code: 'outbox',          emoji: '📤', aliases: ['sent'] },
  { code: 'email',           emoji: '📧', aliases: ['mail', 'letter'] },
  { code: 'book',            emoji: '📖', aliases: ['read', 'document'] },
  { code: 'memo',            emoji: '📝', aliases: ['note', 'write'] },
  { code: 'tools',           emoji: '🔧', aliases: ['fix', 'repair', 'wrench'] },
  { code: 'hammer',          emoji: '🔨', aliases: ['build'] },
  { code: 'package',         emoji: '📦', aliases: ['box', 'deploy', 'ship'] },
  { code: 'gift',            emoji: '🎁', aliases: ['present'] },
  { code: 'trophy',          emoji: '🏆', aliases: ['winner', 'first', 'champion'] },
  { code: 'medal',           emoji: '🥇', aliases: ['gold', 'first'] },
  { code: 'game',            emoji: '🎮', aliases: ['gaming', 'controller'] },
  { code: 'music',           emoji: '🎵', aliases: ['song', 'audio'] },
  { code: 'headphones',      emoji: '🎧', aliases: ['audio', 'listen'] },
]

/**
 * 搜索 emoji 短码
 * @param {string} query - 搜索词（不含冒号）
 * @param {number} limit - 最多返回数量
 * @returns {{ code, emoji }[]}
 */
export function searchEmojiShortcodes(query, limit = 8) {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase()
  const results = []
  for (const item of EMOJI_SHORTCODES) {
    if (results.length >= limit) break
    if (item.code.includes(q) || (item.aliases || []).some(a => a.includes(q))) {
      results.push(item)
    }
  }
  return results
}
