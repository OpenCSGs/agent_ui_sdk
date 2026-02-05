const chatMessages = document.querySelector('[data-ah-ref="messages"]') || document.getElementById('chatMessages')
const chatInput = document.querySelector('[data-ah-ref="input"]') || document.getElementById('chatInput')
const sendButton = document.querySelector('[data-ah-ref="send"]') || document.getElementById('sendButton')

// 可选（如果你用了我上一条给的 HTML）：快捷按钮/清空/回到底部/状态
const clearButton = document.querySelector('[data-ah-ref="clear"]') || document.getElementById('clearButton')
const scrollToBottomBtn = document.querySelector('[data-ah-ref="scroll"]') || document.getElementById('scrollToBottom')
const connStatus = document.querySelector('[data-ah-ref="status"]') || document.getElementById('connStatus')
const quickChips = document.querySelector('[data-ah-ref="chips"]') || document.getElementById('quickChips')
const uploadButton = document.querySelector('[data-ah-ref="upload"]') || document.getElementById('uploadButton')
const fileInput = document.querySelector('[data-ah-ref="file"]') || document.getElementById('fileInput')

const renderer = new AgenticHub.DefaultRenderer({ root: chatMessages })
const chatClient = new AgenticHub.ChatClient()

let currentImageUrl = null // 当前上传的图片 URL

let conversationHistory = []
let abortController = null

/* ---------------------------
   小工具：时间/滚动/节流
---------------------------- */
function formatTime(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function scrollToBottom(force = false) {
  // 当用户正在往上翻时不要强制打断（force=true 例外）
  const threshold = 120
  const distanceToBottom =
    chatMessages.scrollHeight -
    chatMessages.scrollTop -
    chatMessages.clientHeight
  const shouldStick = distanceToBottom < threshold
  if (shouldStick || force) chatMessages.scrollTop = chatMessages.scrollHeight
}

function updateScrollButton() {
  if (!scrollToBottomBtn) return
  const distanceToBottom =
    chatMessages.scrollHeight -
    chatMessages.scrollTop -
    chatMessages.clientHeight
  const show = distanceToBottom > 140
  scrollToBottomBtn.style.opacity = show ? '1' : '0'
  scrollToBottomBtn.style.pointerEvents = show ? 'auto' : 'none'
}

/* ---------------------------
   输入框：自动高度 + Enter 发送
---------------------------- */
function autosizeTextarea(el) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px' // 配合新 UI 稍微放大
}

chatInput.addEventListener('input', function () {
  autosizeTextarea(this)
})

chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

sendButton.addEventListener('click', sendMessage)

/* ---------------------------
   可选 UI：chips / 清空 / 回到底部
---------------------------- */
if (quickChips) {
  quickChips.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-text]')
    if (!btn) return
    chatInput.value = btn.dataset.text || ''
    sendMessage()
  })
}

if (clearButton) {
  clearButton.addEventListener('click', () => {
    // 仅清空界面和本地历史（如你有后端会话，请按需同步）
    conversationHistory = []
    chatMessages.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-card">
          <div class="welcome-title">你好！</div>
          <div class="welcome-text">有什么可以帮助你的吗？你也可以试试发一段代码或需求。</div>
          <div class="welcome-chips" id="quickChips">
            <button class="chip" data-text="你好，我想开始一段对话">开始对话</button>
            <button class="chip" data-text="我需要一些帮助和建议">寻求帮助</button>
            <button class="chip" data-text="请介绍一下你能帮我做什么">探索功能</button>
          </div>
        </div>
      </div>
    `
    // 重新绑定 chips
    const newChips = document.getElementById('quickChips')
    if (newChips) {
      newChips.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-text]')
        if (!btn) return
        chatInput.value = btn.dataset.text || ''
        sendMessage()
      })
    }
  })
}

if (scrollToBottomBtn) {
  scrollToBottomBtn.addEventListener('click', () => scrollToBottom(true))
}
chatMessages.addEventListener('scroll', updateScrollButton)
setTimeout(updateScrollButton, 200)

/* ---------------------------
   消息渲染：由渲染器负责
---------------------------- */


/* ---------------------------
   发送消息：增加 Abort、状态、流式渲染更顺
---------------------------- */
function setStatus(text, color) {
  if (!connStatus) return
  connStatus.textContent = text
  if (color) connStatus.style.color = color
}

/* ---------------------------
   图片上传功能
---------------------------- */
// 点击上传按钮触发文件选择
if (uploadButton && fileInput) {
  uploadButton.addEventListener('click', () => {
    fileInput.click()
  })

  // 文件选择后上传
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // 检查是否是图片
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 上传图片
    await uploadImage(file)

    // 清空 input 以便可以选择同一个文件
    fileInput.value = ''
  })
}

async function uploadImage(file) {
  // 显示上传中状态
  const originalButtonText = uploadButton.innerHTML
  uploadButton.disabled = true
  uploadButton.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="32" stroke-dashoffset="32"/>
    </svg>
  `
  // 添加旋转动画样式
  if (!document.getElementById('upload-spinner-style')) {
    const style = document.createElement('style')
    style.id = 'upload-spinner-style'
    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
    document.head.appendChild(style)
  }

  setStatus('● 上传中…', 'rgba(245, 158, 11, 0.9)')

  try {
    const result = await chatClient.upload(file)
    currentImageUrl = result.url
    showImagePreview(result.url)

    setStatus('● 图片已上传', 'rgba(34, 197, 94, 0.85)')
    setTimeout(() => setStatus('● 在线', 'rgba(34, 197, 94, 0.85)'), 2000)

  } catch (error) {
    console.error('上传错误:', error)
    alert('图片上传失败: ' + error.message)
    setStatus('● 上传失败', 'rgba(239, 68, 68, 0.85)')
    setTimeout(() => setStatus('● 在线', 'rgba(34, 197, 94, 0.85)'), 2000)
  } finally {
    uploadButton.disabled = false
    uploadButton.innerHTML = originalButtonText
  }
}

function showImagePreview(url) {
  // 移除旧的预览
  const oldPreview = document.getElementById('imagePreview')
  if (oldPreview) oldPreview.remove()

  // 创建预览容器
  const preview = document.createElement('div')
  preview.id = 'imagePreview'
  preview.style.cssText = `
    position: relative;
    display: inline-block;
    margin-bottom: 8px;
  `

  // 创建图片
  const img = document.createElement('img')
  img.src = url
  img.style.cssText = `
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.1);
  `

  // 创建删除按钮
  const removeBtn = document.createElement('button')
  removeBtn.innerHTML = '×'
  removeBtn.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  `
  removeBtn.addEventListener('click', () => {
    currentImageUrl = null
    preview.remove()
  })

  preview.appendChild(img)
  preview.appendChild(removeBtn)

  // 将预览插入到输入框之前
  const inputWrap = chatInput.parentElement
  inputWrap.insertBefore(preview, chatInput)
}


async function sendMessage() {
  const message = chatInput.value.trim()
  const hasImage = currentImageUrl !== null

  if (!message && !hasImage) return

  // 如果上一次还在请求，先中止（防止并发把 UI 搞乱）
  if (abortController) abortController.abort()

  // 构建用户消息内容（可能包含图片）
  let userContent = message
  if (hasImage) {
    userContent = message ? `${message}\n\n![图片](${currentImageUrl})` : `![图片](${currentImageUrl})`
  }

  // 用户消息
  renderer.addMessage('user', userContent, { time: formatTime() })

  // 构建 files 参数
  let files = []
  if (hasImage && currentImageUrl) {
    files.push(currentImageUrl)
  }

  // 清空输入框和图片
  chatInput.value = ''
  autosizeTextarea(chatInput)
  currentImageUrl = null
  const imagePreview = document.getElementById('imagePreview')
  if (imagePreview) imagePreview.remove()

  // 禁用发送按钮
  sendButton.disabled = true
  setStatus('● 发送中…', 'rgba(245, 158, 11, 0.9)')

  // 写入历史
  conversationHistory.push({ role: 'user', content: message })

  // 打字指示
  const loadingId = renderer.showTypingIndicator()

  const assistantMessageDiv = renderer.addMessage('assistant', '', { time: formatTime(), isStreaming: true })
  const contentDiv = assistantMessageDiv.querySelector('[data-ah="content"]') || assistantMessageDiv.querySelector('.message-content')
  const meta = contentDiv.querySelector('[data-ah="meta"]') || contentDiv.querySelector('.message-meta')
  let fullResponse = ''
  let typingRemoved = false
  const stream = chatClient.streamChat(
    {
      query: message,
      history: conversationHistory.slice(0, -1),
      files: files.length > 0 ? files : undefined
    },
    {
      onDelta: (_, full) => {
        if (!typingRemoved) {
          renderer.removeTypingIndicator(loadingId)
          typingRemoved = true
        }
        if (meta) meta.remove()
        fullResponse = full
        contentDiv.textContent = fullResponse
        if (meta) contentDiv.appendChild(meta)
        scrollToBottom()
        updateScrollButton()
      },
      onComplete: (full) => {
        if (meta) meta.remove()
        contentDiv.innerHTML = renderer.renderRichText(full)
        if (meta) contentDiv.appendChild(meta)
        conversationHistory.push({ role: 'assistant', content: full })
        setStatus('● 在线', 'rgba(34, 197, 94, 0.85)')
        sendButton.disabled = false
        abortController = null
        scrollToBottom()
        updateScrollButton()
      },
      onError: (error) => {
        if (error && error.name === 'AbortError') {
          setStatus('● 已取消', 'rgba(148, 163, 184, 0.9)')
          sendButton.disabled = false
          abortController = null
          return
        }
        renderer.addMessage('assistant', '抱歉，发生了错误：' + error.message, { time: formatTime() })
        setStatus('● 异常', 'rgba(239, 68, 68, 0.85)')
        sendButton.disabled = false
        abortController = null
        scrollToBottom()
        updateScrollButton()
      }
    }
  )
  abortController = { abort: () => stream.abort() }
}
