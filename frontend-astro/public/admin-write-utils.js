;(() => {
  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char))
  }

  function cssString(value = '') {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')
  }

  function cssUrl(value = '') {
    return String(value).replace(/["\\\r\n]/g, '')
  }

  function parseSetting(row) {
    if (!row) return null
    if (row.type === 'json') {
      try {
        return JSON.parse(row.value || 'null')
      } catch {
        return null
      }
    }
    return row.value
  }

  function fontKey(font) {
    const family = font?.family || font?.name || ''
    const url = font?.url || ''
    return family && url ? `${family}|||${url}` : ''
  }

  function parseFontSelection(value) {
    const [family = '', url = ''] = String(value || '').split('|||')
    return { family, url }
  }

  function fontStyleBlock(fontLibrary = []) {
    return fontLibrary.map((font) => {
      const family = font.family || font.name || ''
      const url = font.url || ''
      if (!family || !url) return ''
      const safeFamily = cssString(family)
      return `@font-face{font-family:"${safeFamily}";src:url("${cssUrl(url)}");font-display:swap;}[data-font="${safeFamily}"]{font-family:"${safeFamily}",sans-serif;}`
    }).filter(Boolean).join('\n')
  }

  function fontFamilyCss(font) {
    return font?.family ? `"${cssString(font.family)}", "Microsoft YaHei", "PingFang SC", sans-serif` : ''
  }

  function unwrapInlineFont(value) {
    return String(value || '').replace(/<span\s+data-font="[^"]+"(?:\s+data-font-url="[^"]+")?>([\s\S]*?)<\/span>/g, '$1')
  }

  function inlineFontRangeAt(value, start, end) {
    const regex = /<span\s+data-font="[^"]+"(?:\s+data-font-url="[^"]+")?>([\s\S]*?)<\/span>/g
    let match
    while ((match = regex.exec(value))) {
      const openEnd = match.index + match[0].indexOf('>') + 1
      const closeStart = match.index + match[0].lastIndexOf('</span>')
      const rangeEnd = match.index + match[0].length
      const touchesSelection = start < rangeEnd && end > match.index
      const cursorInside = start === end && start >= openEnd && start <= closeStart
      if (touchesSelection || cursorInside) {
        return { start: match.index, end: rangeEnd, text: match[1] }
      }
    }
    return null
  }

  function renderInlineMarkdown(value) {
    const tokens = []
    const withTokens = String(value ?? '').replace(/<span\s+data-font=["']([^"']+)["'](?:\s+data-font-url=["']([^"']*)["'])?>([\s\S]*?)<\/span>/g, (_match, family, url, inner) => {
      const token = `@@FONT_SPAN_${tokens.length}@@`
      tokens.push({ token, family, url: url || '', inner })
      return token
    })
    return html(withTokens)
      .replace(/@@FONT_SPAN_(\d+)@@/g, (_match, index) => {
        const item = tokens[Number(index)]
        const urlAttr = item?.url ? ` data-font-url="${html(item.url)}"` : ''
        return item ? `<span data-font="${html(item.family)}"${urlAttr}>${renderInlineMarkdown(item.inner)}</span>` : ''
      })
      .replace(/&lt;span\s+data-font=(?:&quot;|&#39;)([^&]+?)(?:&quot;|&#39;)(?:\s+data-font-url=(?:&quot;|&#39;)([^&]*?)(?:&quot;|&#39;))?&gt;([\s\S]*?)&lt;\/span&gt;/g, (_match, family, url, inner) => {
        const urlAttr = url ? ` data-font-url="${html(url)}"` : ''
        return `<span data-font="${html(family)}"${urlAttr}>${inner}</span>`
      })
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || '').split('\n')
    const out = []
    let inCode = false
    let code = []
    let inList = false
    let inTable = false

    const closeList = () => {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
    }
    const closeTable = () => {
      if (inTable) {
        out.push('</tbody></table>')
        inTable = false
      }
    }

    for (const raw of lines) {
      const line = raw.trimEnd()
      if (line.startsWith('```')) {
        if (inCode) {
          out.push(`<pre><code>${html(code.join('\n'))}</code></pre>`)
          code = []
          inCode = false
        } else {
          closeList()
          closeTable()
          inCode = true
        }
        continue
      }
      if (inCode) {
        code.push(raw)
        continue
      }
      if (!line.trim()) {
        closeList()
        closeTable()
        continue
      }
      const heading = line.match(/^(#{1,6})\s+(.+)$/)
      if (heading) {
        closeList()
        closeTable()
        out.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`)
        continue
      }
      if (/^\|.+\|$/.test(line)) {
        closeList()
        if (/^\|\s*-+/.test(line)) continue
        const cells = line.split('|').slice(1, -1).map((cell) => `<td>${renderInlineMarkdown(cell.trim())}</td>`).join('')
        if (!inTable) {
          out.push('<table><tbody>')
          inTable = true
        }
        out.push(`<tr>${cells}</tr>`)
        continue
      }
      const task = line.match(/^-\s+\[( |x)\]\s+(.+)$/i)
      const bullet = line.match(/^[-*]\s+(.+)$/)
      if (task || bullet) {
        closeTable()
        if (!inList) {
          out.push('<ul>')
          inList = true
        }
        out.push(`<li>${task ? `<input type="checkbox" disabled ${task[1].toLowerCase() === 'x' ? 'checked' : ''} /> ${renderInlineMarkdown(task[2])}` : renderInlineMarkdown(bullet[1])}</li>`)
        continue
      }
      if (/^-{3,}$/.test(line.trim())) {
        closeList()
        closeTable()
        out.push('<hr />')
        continue
      }
      if (line.startsWith('> ')) {
        closeList()
        closeTable()
        out.push(`<blockquote>${renderInlineMarkdown(line.slice(2))}</blockquote>`)
        continue
      }
      closeList()
      closeTable()
      out.push(`<p>${renderInlineMarkdown(line)}</p>`)
    }
    closeList()
    closeTable()
    if (inCode) out.push(`<pre><code>${html(code.join('\n'))}</code></pre>`)
    return out.join('')
  }

  function restoreInlineFontSpans(value = '') {
    return String(value).replace(
      /&lt;span\s+data-font=(?:&quot;|&#39;)([^&]+?)(?:&quot;|&#39;)(?:\s+data-font-url=(?:&quot;|&#39;)([^&]*?)(?:&quot;|&#39;))?&gt;([\s\S]*?)&lt;\/span&gt;/g,
      (_match, family, url, inner) => {
        const urlAttr = url ? ` data-font-url="${html(url)}"` : ''
        return `<span data-font="${html(family)}"${urlAttr}>${inner}</span>`
      },
    )
  }

  function buildPreviewHtml({ title = '', contentHtml = '', fontCss = '', titleFont, bodyFont } = {}) {
    const titleFamily = fontFamilyCss(titleFont)
    const bodyFamily = fontFamilyCss(bodyFont)
    const titleStyle = titleFamily ? ` style='font-family:${html(titleFamily)}'` : ''
    const bodyStyle = bodyFamily ? ` style='font-family:${html(bodyFamily)}'` : ''
    return `${fontCss ? `<style>${fontCss}</style>` : ''}${title ? `<h1${titleStyle}>${html(title)}</h1>` : ''}<div class="writer-preview-body"${bodyStyle}>${restoreInlineFontSpans(contentHtml)}</div>`
  }

  window.WriterUtils = {
    html,
    cssString,
    cssUrl,
    parseSetting,
    fontKey,
    parseFontSelection,
    fontStyleBlock,
    fontFamilyCss,
    unwrapInlineFont,
    inlineFontRangeAt,
    renderInlineMarkdown,
    markdownToHtml,
    restoreInlineFontSpans,
    buildPreviewHtml,
  }
})()
