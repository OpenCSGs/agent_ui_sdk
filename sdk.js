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
      let buffer = ''
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
            buffer += chunk
            
            // 按行分割并解析 JSON
            const lines = buffer.split('\n')
            buffer = lines.pop() // 保留最后一行，可能不完整
            
            for (const line of lines) {
              if (line.trim() === '') continue
              try {
                const data = JSON.parse(line)
                let displayText = ''
                
                // 根据 type 处理不同类型的消息
                switch (data.type) {
                  case 'content':
                    displayText = data.content
                    break
                  case 'tool_call':
                    displayText = `[工具调用] ${data.content}`
                    break
                  case 'tool_progress':
                    displayText = `[工具进度] ${data.content}`
                    break
                  case 'tool_output':
                    displayText = `[工具输出] ${data.content}`
                    break
                  case 'error':
                    displayText = `[错误] ${data.content}`
                    break
                  default:
                    displayText = `[未知类型] ${data.content}`
                }
                
                full += displayText
                if (onDelta) onDelta(displayText, full)
              } catch (e) {
                console.error('解析 JSON 失败:', e, line)
              }
            }
          }
          
          // 处理最后一行
          if (buffer.trim() !== '') {
            try {
              const data = JSON.parse(buffer)
              let displayText = ''
              
              switch (data.type) {
                case 'content':
                  displayText = data.content
                  break
                case 'tool_call':
                  displayText = `[工具调用] ${data.content}`
                  break
                case 'tool_progress':
                  displayText = `[工具进度] ${data.content}`
                  break
                case 'tool_output':
                  displayText = `[工具输出] ${data.content}`
                  break
                case 'error':
                  displayText = `[错误] ${data.content}`
                  break
                default:
                  displayText = `[未知类型] ${data.content}`
              }
              
              full += displayText
              if (onDelta) onDelta(displayText, full)
            } catch (e) {
              console.error('解析最后一行 JSON 失败:', e, buffer)
            }
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
