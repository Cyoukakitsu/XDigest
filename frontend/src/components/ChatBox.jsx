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
    <div className="border-t border-border flex flex-col" style={{ height: '42vh' }}>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-lg bg-primary text-primary-foreground px-3 py-2 rounded rounded-br-sm text-sm leading-relaxed font-sans">
                {msg.content || <span className="opacity-60 animate-pulse font-mono">▋</span>}
              </div>
            ) : (
              <div className="max-w-lg border-l-2 border-secondary/50 pl-3 py-1 min-h-[1.75rem] text-foreground text-sm leading-relaxed">
                {msg.content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: (props) => (
                        <div className="overflow-x-auto my-2">
                          <table className="w-full border-collapse text-xs" {...props} />
                        </div>
                      ),
                      thead: (props) => <thead className="bg-muted/60" {...props} />,
                      th: (props) => (
                        <th className="border border-border px-2 py-1 text-left font-semibold font-mono text-muted-foreground text-[11px] uppercase tracking-wide" {...props} />
                      ),
                      td: (props) => (
                        <td className="border border-border px-2 py-1 text-foreground align-top" {...props} />
                      ),
                      strong: (props) => <strong className="text-foreground font-semibold" {...props} />,
                      ul: (props) => <ul className="list-disc list-inside space-y-0.5 my-1 marker:text-primary/60" {...props} />,
                      ol: (props) => <ol className="list-decimal list-inside space-y-0.5 my-1 marker:text-primary/60" {...props} />,
                      li: (props) => <li className="text-foreground" {...props} />,
                      p: (props) => <p className="my-1 text-foreground" {...props} />,
                      code: ({ inline, ...props }) =>
                        inline ? (
                          <code className="bg-muted text-primary px-1 rounded text-xs font-mono" {...props} />
                        ) : (
                          <code className="block bg-muted text-foreground p-2 rounded text-xs font-mono overflow-x-auto my-1" {...props} />
                        ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <span className="opacity-40 animate-pulse font-mono text-xs">▋</span>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-border">
        <input
          className="flex-1 bg-card border border-border text-foreground text-sm rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="针对发言提问..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={isChatLoading || !input.trim()}
          className="bg-primary text-primary-foreground text-xs px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer font-mono"
        >
          发送
        </button>
      </div>
    </div>
  )
}
