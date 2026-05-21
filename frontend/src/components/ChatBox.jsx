import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ChatBox() {
  const {
    tweets,
    days,
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
        body: JSON.stringify({ messages, tweets, days }),
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
              {msg.role === 'user' ? (
                msg.content || <span className="animate-pulse">▋</span>
              ) : msg.content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: (props) => (
                      <div className="overflow-x-auto my-2">
                        <table className="w-full border-collapse text-xs" {...props} />
                      </div>
                    ),
                    thead: (props) => <thead className="bg-gray-600" {...props} />,
                    th: (props) => (
                      <th className="border border-gray-500 px-2 py-1 text-left text-gray-200 font-semibold" {...props} />
                    ),
                    td: (props) => (
                      <td className="border border-gray-500 px-2 py-1 text-gray-300 align-top" {...props} />
                    ),
                    strong: (props) => <strong className="text-white font-semibold" {...props} />,
                    ul: (props) => <ul className="list-disc list-inside space-y-0.5 my-1" {...props} />,
                    ol: (props) => <ol className="list-decimal list-inside space-y-0.5 my-1" {...props} />,
                    li: (props) => <li className="text-gray-300" {...props} />,
                    p: (props) => <p className="my-1 text-gray-200" {...props} />,
                    code: ({ inline, ...props }) =>
                      inline ? (
                        <code className="bg-gray-600 text-blue-300 px-1 rounded text-xs" {...props} />
                      ) : (
                        <code className="block bg-gray-900 text-green-300 p-2 rounded text-xs overflow-x-auto my-1" {...props} />
                      ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span className="animate-pulse">▋</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-gray-700">
        <input
          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
          placeholder="针对发言提问..."
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
