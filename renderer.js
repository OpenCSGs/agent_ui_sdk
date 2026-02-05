;(function () {
  function escapeHtml(str) {
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }
  function defaultRenderRichText(text) {
    const escaped = escapeHtml(text)
    const parts = escaped.split(/```/g)
    let html = ''
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        let withInline = parts[i].replace(/`([^`]+)`/g, '<code>$1</code>')
        withInline = withInline.replace(
          /!\[([^\]]*)\]\(([^)]+)\)/g,
          '<img src="$2" alt="$1" style="max-width: 100%; max-height: 400px; border-radius: 8px; margin: 8px 0;" />'
        )
        html += withInline.replace(/\n/g, '<br/>')
      } else {
        html += `<pre><code>${parts[i].replace(/^\n/, '')}</code></pre>`
      }
    }
    return html
  }
  class DefaultRenderer {
    constructor({ root, renderRichText, classes, texts } = {}) {
      this.root = root
      this.renderRichText = renderRichText || defaultRenderRichText
      this.classes = Object.assign(
        {
          message: 'message',
          user: 'user',
          assistant: 'assistant',
          avatar: 'message-avatar',
          content: 'message-content',
          meta: 'message-meta',
          typing: 'typing-indicator'
        },
        classes || {}
      )
      this.texts = Object.assign(
        {
          userAvatar: '你',
          assistantAvatar: 'AI'
        },
        texts || {}
      )
    }
    addMessage(role, content, { time, isStreaming } = {}) {
      const messageDiv = document.createElement('div')
      messageDiv.className = `${this.classes.message} ${role}`
      messageDiv.setAttribute('data-ah', 'message')
      messageDiv.setAttribute('data-ah-role', role)
      const avatar = document.createElement('div')
      avatar.className = this.classes.avatar
      avatar.setAttribute('data-ah', 'avatar')
      avatar.textContent = role === 'user' ? this.texts.userAvatar : this.texts.assistantAvatar
      const contentDiv = document.createElement('div')
      contentDiv.className = this.classes.content
      contentDiv.setAttribute('data-ah', 'content')
      if (isStreaming) {
        contentDiv.textContent = content
      } else {
        contentDiv.innerHTML = this.renderRichText(content)
      }
      const meta = document.createElement('div')
      meta.className = this.classes.meta
      meta.setAttribute('data-ah', 'meta')
      meta.style.cssText = 'margin-top:6px;font-size:12px;opacity:.65;user-select:none;'
      meta.textContent = time || ''
      contentDiv.appendChild(meta)
      messageDiv.appendChild(avatar)
      messageDiv.appendChild(contentDiv)
      this.root.appendChild(messageDiv)
      const welcomeMessage = this.root.querySelector('.welcome-message')
      if (welcomeMessage) welcomeMessage.remove()
      return messageDiv
    }
    showTypingIndicator() {
      const id = 'loading-' + Date.now()
      const messageDiv = document.createElement('div')
      messageDiv.className = `${this.classes.message} ${this.classes.assistant || 'assistant'}`
      messageDiv.id = id
      messageDiv.setAttribute('data-ah', 'message')
      messageDiv.setAttribute('data-ah-role', 'assistant')
      const avatar = document.createElement('div')
      avatar.className = this.classes.avatar
      avatar.setAttribute('data-ah', 'avatar')
      avatar.textContent = this.texts.assistantAvatar
      const contentDiv = document.createElement('div')
      contentDiv.className = this.classes.typing
      contentDiv.setAttribute('data-ah', 'typing')
      contentDiv.innerHTML = '<span></span><span></span><span></span>'
      messageDiv.appendChild(avatar)
      messageDiv.appendChild(contentDiv)
      this.root.appendChild(messageDiv)
      return id
    }
    removeTypingIndicator(id) {
      const el = document.getElementById(id)
      if (el) el.remove()
    }
  }
  var AgenticHub = window.AgenticHub || {}
  AgenticHub.DefaultRenderer = DefaultRenderer
  AgenticHub.renderRichText = defaultRenderRichText
  window.AgenticHub = AgenticHub
})()
