/**
 * utils/linkPreview.js - 链接预览工具（OG标签解析）
 * 使用 Node.js 内置 https/http 模块，无需额外依赖
 */

const https = require('https');
const http = require('http');

// 简单内存缓存（URL -> preview data, 10分钟过期）
const previewCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

/**
 * 解析 HTML 中的 OG / meta 标签
 */
function parseOgTags(html) {
  const result = {};

  // og:title / title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  result.title = ogTitle?.[1]?.trim() || titleTag?.[1]?.trim() || '';

  // og:description / meta description
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  result.description = ogDesc?.[1]?.trim() || metaDesc?.[1]?.trim() || '';

  // og:image
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

  result.image = ogImage?.[1]?.trim() || '';

  // og:site_name
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);

  result.siteName = ogSite?.[1]?.trim() || '';

  // favicon（作为 site_icon 备选）
  const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  result.favicon = faviconMatch?.[1]?.trim() || '';

  // HTML decode common entities
  for (const key of ['title', 'description', 'siteName']) {
    if (result[key]) {
      result[key] = result[key]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
    }
  }

  return result;
}

/**
 * 获取 URL 的 Link Preview 数据
 * @param {string} url
 * @returns {Promise<{title, description, image, siteName, favicon, url}>}
 */
async function fetchLinkPreview(url) {
  // 检查缓存
  const cached = previewCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const protocol = parsed.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JarvisIM-LinkPreview/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        timeout: 5000,
      };

      const req = protocol.request(options, (res) => {
        // 处理重定向（最多 2 次）
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          // 避免重定向循环，简单处理
          return fetchLinkPreview(redirectUrl).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const contentType = res.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          return reject(new Error('Not an HTML page'));
        }

        let html = '';
        let bytesRead = 0;
        const MAX_BYTES = 100 * 1024; // 最多读取 100KB（够解析 meta 标签了）

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          html += chunk;
          bytesRead += Buffer.byteLength(chunk, 'utf8');
          if (bytesRead >= MAX_BYTES) {
            res.destroy();
          }
        });

        res.on('end', () => {
          const tags = parseOgTags(html);

          // 处理相对路径 image
          if (tags.image && !tags.image.startsWith('http')) {
            try {
              tags.image = new URL(tags.image, url).href;
            } catch {
              tags.image = '';
            }
          }

          // 处理相对路径 favicon
          if (tags.favicon && !tags.favicon.startsWith('http')) {
            try {
              tags.favicon = new URL(tags.favicon, url).href;
            } catch {
              tags.favicon = `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
            }
          } else if (!tags.favicon) {
            tags.favicon = `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
          }

          if (!tags.siteName) {
            tags.siteName = parsed.hostname.replace('www.', '');
          }

          const data = { ...tags, url };

          // 写入缓存
          previewCache.set(url, { data, timestamp: Date.now() });

          // 定期清理过期缓存
          if (previewCache.size > 200) {
            const now = Date.now();
            for (const [k, v] of previewCache.entries()) {
              if (now - v.timestamp > CACHE_TTL) previewCache.delete(k);
            }
          }

          resolve(data);
        });

        res.on('error', reject);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { fetchLinkPreview };
