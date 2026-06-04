import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PERIODS = [
  { days: 1, label: '今日' },
  { days: 7, label: '本周' },
  { days: 30, label: '本月' },
]

const DIRECTION_MAP = {
  '看多': {
    icon: '▲',
    style: {
      background: 'var(--stock-bullish-bg)',
      color: 'var(--stock-bullish)',
      border: '1px solid var(--stock-bullish-border)',
    },
  },
  '看空': {
    icon: '▼',
    style: {
      background: 'var(--stock-bearish-bg)',
      color: 'var(--stock-bearish)',
      border: '1px solid var(--stock-bearish-border)',
    },
  },
  '中性': {
    icon: '◆',
    style: {
      background: 'var(--stock-neutral-bg)',
      color: 'var(--stock-neutral)',
      border: '1px solid var(--stock-neutral-border)',
    },
  },
}

function DirectionBadge({ text }) {
  const config = DIRECTION_MAP[text]
  if (!config) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.7rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        ...config.style,
      }}
    >
      {config.icon} {text}
    </span>
  )
}

function resolveText(children) {
  if (typeof children === 'string') return children.trim()
  if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string')
    return children[0].trim()
  return null
}

export default function Summary() {
  const { selectedUser, tweets, summary, days, isLoading, setIsLoading, setFetchResult, setDays } =
    useStore()

  const fetchTweets = async () => {
    if (!selectedUser || isLoading) return
    setIsLoading(true)
    setFetchResult([], '')
    try {
      const res = await fetch(`${API}/api/fetch/${selectedUser.username}?days=${days}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setFetchResult([], `错误：${data.detail}`)
        return
      }
      setFetchResult(data.tweets, data.summary)
    } catch {
      setFetchResult([], '网络错误，请检查后端是否启动')
    } finally {
      setIsLoading(false)
    }
  }

  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `近${days}天`

  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <span className="text-4xl opacity-20 font-mono select-none">◎</span>
        <p className="text-sm">从左侧选择一个追踪用户</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-foreground text-base font-semibold font-mono tracking-tight">
            @{selectedUser.username}
          </h2>
          {tweets.length > 0 && (
            <p className="text-muted-foreground text-xs mt-0.5 font-mono">
              {periodLabel} · {tweets.length} 条
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-border">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                disabled={isLoading}
                className={`text-xs px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer font-mono ${
                  days === p.days
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchTweets}
            disabled={isLoading}
            className="bg-primary text-primary-foreground text-xs px-4 py-1.5 rounded hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer font-mono"
          >
            {isLoading ? '抓取中…' : `抓取${periodLabel}`}
          </button>
        </div>
      </div>

      {summary && (
        <div
          className="bg-card border border-border rounded p-5 text-foreground text-sm leading-7 max-w-none border-t-2 border-t-primary/40"
          style={{ boxShadow: 'var(--shadow)' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: (props) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full border-collapse text-xs" {...props} />
                </div>
              ),
              thead: (props) => <thead className="bg-muted/60" {...props} />,
              th: (props) => (
                <th
                  className="border border-border px-3 py-2 text-left font-semibold font-mono text-muted-foreground text-[11px] tracking-wide uppercase"
                  {...props}
                />
              ),
              td: ({ children, ...props }) => {
                const text = resolveText(children)
                if (text && DIRECTION_MAP[text]) {
                  return (
                    <td className="border border-border px-3 py-2 align-middle" {...props}>
                      <DirectionBadge text={text} />
                    </td>
                  )
                }
                return (
                  <td className="border border-border px-3 py-2 text-foreground align-top" {...props}>
                    {children}
                  </td>
                )
              },
              tr: (props) => (
                <tr className="even:bg-muted/20 hover:bg-muted/40 transition-colors" {...props} />
              ),
              h1: (props) => (
                <h1
                  className="text-foreground text-base font-bold mt-5 mb-2 pb-1.5 border-b border-border"
                  {...props}
                />
              ),
              h2: (props) => (
                <h2
                  className="text-foreground text-sm font-bold mt-4 mb-2 pl-2.5 border-l-2 border-primary"
                  {...props}
                />
              ),
              h3: (props) => (
                <h3
                  className="text-muted-foreground text-xs font-semibold mt-3 mb-1 uppercase tracking-wider font-mono"
                  {...props}
                />
              ),
              strong: (props) => <strong className="text-foreground font-semibold" {...props} />,
              ul: (props) => (
                <ul className="list-disc list-inside space-y-1 my-2 marker:text-primary/60" {...props} />
              ),
              ol: (props) => (
                <ol className="list-decimal list-inside space-y-1 my-2 marker:text-primary/60" {...props} />
              ),
              li: (props) => <li className="text-foreground" {...props} />,
              p: (props) => <p className="my-1.5 text-foreground" {...props} />,
              code: ({ inline, ...props }) =>
                inline ? (
                  <code className="bg-muted text-primary px-1 rounded text-xs font-mono" {...props} />
                ) : (
                  <code className="block bg-muted text-foreground p-3 rounded text-xs font-mono overflow-x-auto my-2" {...props} />
                ),
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      )}

      {!summary && !isLoading && (
        <div className="flex flex-col items-center justify-center pt-16 gap-3 text-muted-foreground">
          <span className="text-xl opacity-20 font-mono select-none">[ ]</span>
          <p className="text-sm">点击「抓取{periodLabel}」开始</p>
        </div>
      )}
    </div>
  )
}
