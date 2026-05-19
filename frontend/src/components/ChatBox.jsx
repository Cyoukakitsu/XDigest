import { useEffect, useRef, useState } from 'react'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ChatBox() {
  const {
    tweets,
    chatHistory,
    isChatLoading,
    setIsChatLoading,
    addUserMessage,
    appendAssistantChunk,
  } = useStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isChatLoading || tweets.length === 0) return

    setInput('')
    addUserMessage(text)
    setIsChatLoading(true)

    const messages = [
      ...chatHistory.filter((m) => m.content),
      { role: 'user', content: text },
    ]

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, tweets }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) appendAssistantChunk(parsed.content)
          } catch {}
        }
      }
    } catch {
      appendAssistantChunk('（回复出错，请重试）')
    } finally {
      setIsChatLoading(false)
    }
  }

  if (tweets.length === 0) return null

  return (
    <div className="border-t border-gray-700 flex flex-col" style={{ height: '42vh' }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-lg px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              {msg.content || <span className="animate-pulse">▋</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-gray-700">
        <input
          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
          placeholder="针对今日发言提问..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={isChatLoading || !input.trim()}
          className="bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  )
}
