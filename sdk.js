;(function () {
  class ChatClient {
    constructor({ baseUrl = '', chatPath = '/api/chat', uploadPath = '/upload', headers = {} } = {}) {
      this.baseUrl = baseUrl
      this.chatPath = chatPath
      this.uploadPath = uploadPath
      this.headers = headers
    }
    setHeaders(headers) {
      this.headers = headers || {}
    }
    async upload(file) {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(this.baseUrl + this.uploadPath, { method: 'POST', body: formData, headers: this.headers })
      if (!res.ok) throw new Error('上传失败: ' + res.status)
      const json = await res.json()
      const url = (json && json.data && json.data.url) || json.url || (json && json.data && json.data.url)
      if (!url) throw new Error('未能获取图片 URL')
      return { url, raw: json }
    }
    streamChat({ query, history = [], files }, { onDelta, onComplete, onError, signal } = {}) {
      const controller = new AbortController()
      const usedSignal = signal || controller.signal
      const headers = Object.assign({ 'Content-Type': 'application/json' }, this.headers)
      let full = ''
      const done = (async () => {
        try {
          const res = await fetch(this.baseUrl + this.chatPath, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, history, files }),
            signal: usedSignal
          })
          if (!res.ok) throw new Error('HTTP error: ' + res.status)
          if (!res.body) throw new Error('No response body')
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            full += chunk
            if (onDelta) onDelta(chunk, full)
          }
          if (onComplete) onComplete(full)
        } catch (e) {
          if (onError) onError(e)
        }
      })()
      return { abort: () => controller.abort(), done }
    }
    async sendChat(params) {
      let text = ''
      await this.streamChat(params, { onDelta: (_, f) => (text = f) }).done
      return text
    }
  }
  var AgenticHub = window.AgenticHub || {}
  AgenticHub.ChatClient = ChatClient
  window.AgenticHub = AgenticHub
})()
