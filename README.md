Agentichub 的 agent 支持提供定制化的 UI，用户可以基于原生的 js，css，html 和 agent 服务提供的两个 API 进行对接

### 后端依赖

- /api/chat：支持流式文本输出
- /upload：返回图片 URL

为了尽可能减轻用户对接的复杂度，我们把和后端 API 的交互，以及流式信息的处理做了抽象化处理，分别放到了
- ./sdk.js
- ./renderer.js

其中 sdk 封装了两个后端接口，renderer 则处理了流式数据的渲染

对于用户而言，只要你的 HTML 提供了必要的 data-ah-ref 对应的元素并正确引入脚本，核心交互就能工作，剩下的样式定制化就由用户自己完成

### 必要元素

- messages：data-ah-ref="messages"（聊天消息容器）
- input：data-ah-ref="input"（文本输入框）
- send：data-ah-ref="send"（发送按钮）

可选元素（有则启用相应功能）

- clear：data-ah-ref="clear"（清空对话按钮）
- scroll：data-ah-ref="scroll"（回到底部按钮）
- status：data-ah-ref="status"（状态文本）
- chips：data-ah-ref="chips"（快速发言区域）
- upload：data-ah-ref="upload"（上传按钮）
- file：data-ah-ref="file"（隐藏文件 input）
以上每个查询都带有 id 回退，所以你也可以保留原来的 id 命名，不影响使用。

### 脚本引入顺序

- 依次引入：
  - ./sdk.js
  - ./renderer.js
  - ./app.js
 
特别注意⚠️：在提交代码的时候，需要把文件的相对路径更新为绝对路径，比如

- 依次引入：
  - /ui/sdk.js
  - /ui/renderer.js
  - /ui/app.js
