import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useThemeMode } from "../theme"
import type {
  ActiveTabState,
  AssistantMode,
  ConversationMessage,
  GeneratedScriptDraft,
  PageScriptRule,
  ScriptScope
} from "../types"

type QuickAction = {
  label: string
  prompt: string
  mode?: AssistantMode
}

const createMessage = (
  role: "user" | "assistant",
  mode: AssistantMode,
  content: string,
  meta?: ConversationMessage["meta"]
): ConversationMessage => ({
  id: crypto.randomUUID(),
  role,
  mode,
  content,
  createdAt: Date.now(),
  meta
})

const IconButton = ({
  title,
  active = false,
  disabled = false,
  primary = false,
  onClick,
  children
}: {
  title: string
  active?: boolean
  disabled?: boolean
  primary?: boolean
  onClick?: () => void
  children: ReactNode
}) => (
  <button
    className={`icon-button ${active ? "active" : ""} ${primary ? "primary" : ""}`}
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={onClick}>
    {children}
  </button>
)

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2.5 14.2 9l6.3 2.2-6.3 2.1L12 20l-2.2-6.7-6.3-2.1L9.8 9 12 2.5Z"
      fill="currentColor"
    />
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.44 4.44 1.06-1.06-4.44-4.44A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
      fill="currentColor"
    />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M11.25 5.25h1.5v5.25h5.25v1.5h-5.25v5.25h-1.5V12H6v-1.5h5.25V5.25Z"
      fill="currentColor"
    />
  </svg>
)

const ScriptIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M8.1 7.2 4 12l4.1 4.8 1.1-.9L5.9 12l3.3-3.9-1.1-.9Zm7.8 0-1.1.9 3.3 3.9-3.3 3.9 1.1.9L20 12l-4.1-4.8ZM13.7 5l-4 14h1.6l4-14h-1.6Z"
      fill="currentColor"
    />
  </svg>
)

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 5a7 7 0 0 1 6.41 4.2H16v1.5h5V5.7h-1.5v2.38A8.5 8.5 0 1 0 20.5 12H19a7 7 0 1 1-7-7Z"
      fill="currentColor"
    />
  </svg>
)

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8">
      <path d="M4.5 7.5h8" />
      <path d="M4.5 16.5h15" />
      <path d="M15.5 7.5h4" />
      <path d="M4.5 12h4" />
      <path d="M11.5 12h8" />
      <circle cx="14" cy="7.5" r="1.8" />
      <circle cx="10" cy="12" r="1.8" />
      <circle cx="14" cy="16.5" r="1.8" />
    </g>
  </svg>
)

const SendIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4.2 19.8 21 12 4.2 4.2l.02 5.28 8.82 2.52-8.82 2.52-.02 5.28Z"
      fill="currentColor"
    />
  </svg>
)

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
  </svg>
)

const PowerIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3.75a.75.75 0 0 1 .75.75v6.25a.75.75 0 0 1-1.5 0V4.5a.75.75 0 0 1 .75-.75Zm4.98 2.5a.75.75 0 0 1 1.05.12 8 8 0 1 1-12.06 0 .75.75 0 1 1 1.17.93 6.5 6.5 0 1 0 9.84 0 .75.75 0 0 1 .12-1.05Z"
      fill="currentColor"
    />
  </svg>
)

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={open ? "m7 14 5-5 5 5" : "m7 10 5 5 5-5"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
)

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })

const SCOPE_OPTIONS: ScriptScope[] = ["path", "exact", "domain"]
const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "总结当前页面",
    prompt: "请总结当前页面的核心内容，输出重点摘要。"
  },
  {
    label: "提取关键信息",
    prompt: "请提取当前页面最重要的事实、数据和结论，并按要点列出。"
  },
  {
    label: "识别下一步动作",
    prompt: "请识别当前页面里最值得执行的下一步操作，并说明原因。"
  },
  {
    label: "生成页面优化脚本",
    prompt: "请为当前页面生成一个优化阅读体验的脚本，移除干扰区域并突出正文。",
    mode: "script"
  }
]

const openSettingsPage = async () => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("options.html")
  })
}

const MarkdownMessage = ({ content }: { content: string }) => (
  <div className="message-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noreferrer"
          />
        )
      }}>
      {content}
    </ReactMarkdown>
  </div>
)

export default function SidepanelApp() {
  const [activeState, setActiveState] = useState<ActiveTabState | null>(null)
  const [prompt, setPrompt] = useState("")
  const [running, setRunning] = useState(false)
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [scriptMode, setScriptMode] = useState(false)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [error, setError] = useState("")
  const [executingDraftId, setExecutingDraftId] = useState<string | null>(null)
  const [ruleActionId, setRuleActionId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rulesExpanded, setRulesExpanded] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useThemeMode(activeState?.settings.themeMode ?? "auto")

  const activeMode: AssistantMode = scriptMode ? "script" : "analyze"

  const loadActiveState = async () => {
    const state = (await chrome.runtime.sendMessage({
      type: "ASH_GET_ACTIVE_TAB_STATE"
    })) as ActiveTabState
    setActiveState(state)
    setSearchEnabled(false)
  }

  useEffect(() => {
    void loadActiveState()

    const handleActivated = () => {
      void loadActiveState()
    }

    const handleUpdated = () => {
      void loadActiveState()
    }

    chrome.tabs.onActivated.addListener(handleActivated)
    chrome.tabs.onUpdated.addListener(handleUpdated)

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated)
      chrome.tabs.onUpdated.removeListener(handleUpdated)
    }
  }, [])

  useEffect(() => {
    if (!activeState?.tabId || activeState.pageAccessError || activeState.pageContextReady) {
      return
    }

    const timer = window.setInterval(() => {
      void loadActiveState()
    }, 600)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeState?.pageAccessError, activeState?.pageContextReady, activeState?.tabId])

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [menuOpen])

  const runPrompt = async (submittedPrompt: string, mode: AssistantMode = activeMode) => {
    if (!activeState?.tabId || !submittedPrompt.trim() || running) {
      return
    }

    const normalizedPrompt = submittedPrompt.trim()
    const userMessage = createMessage("user", mode, normalizedPrompt)
    const pendingAssistantId = crypto.randomUUID()
    const pendingAssistantMessage: ConversationMessage = {
      id: pendingAssistantId,
      role: "assistant",
      mode,
      content: "",
      createdAt: Date.now(),
      meta: {
        loading: true
      }
    }

    setRunning(true)
    setError("")
    setPrompt("")

    const history = [...messages, userMessage]
    setMessages([...history, pendingAssistantMessage])

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASH_RUN_PROMPT",
        payload: {
          tabId: activeState.tabId,
          mode,
          prompt: normalizedPrompt,
          scope: activeState.settings.defaultScope,
          useSearch: searchEnabled,
          history
        }
      })

      setMessages((current) => [
        ...current.map((message) =>
          message.id === pendingAssistantId
            ? createMessage("assistant", mode, response.answer, {
                draft: response.draft,
                scope: "path"
              })
            : message
        )
      ])
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : String(caught)
      setError(nextError)
      setPrompt(normalizedPrompt)
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingAssistantId
            ? createMessage("assistant", mode, nextError, {
                error: nextError
              })
            : message
        )
      )
    } finally {
      setRunning(false)
    }
  }

  const sendPrompt = async () => {
    if (!prompt.trim()) {
      return
    }

    await runPrompt(prompt, activeMode)
  }

  const executeDraft = async (messageId: string, draft: GeneratedScriptDraft) => {
    if (!activeState?.tabId || executingDraftId) {
      return
    }

    setExecutingDraftId(messageId)
    setError("")

    const selectedScope = messages.find((message) => message.id === messageId)?.meta?.scope ?? "path"

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASH_EXECUTE_DRAFT",
        tabId: activeState.tabId,
        draft: {
          ...draft,
          scope: selectedScope
        }
      })

      setMessages((current) => [
        ...current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                meta: {
                  ...message.meta,
                  executed: true,
                  ruleId: response.rule?.id,
                  ruleName: response.rule?.name
                }
              }
            : message
        ),
        createMessage(
          "assistant",
          "script",
          "脚本已执行，并已缓存为页面规则。下次进入匹配页面会自动执行。",
          {
            ruleId: response.rule?.id,
            ruleName: response.rule?.name,
            scope: response.rule?.scope,
            executed: true
          }
        )
      ])

      await loadActiveState()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setExecutingDraftId(null)
    }
  }

  const updateDraftScope = (messageId: string, scope: ScriptScope) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              meta: {
                ...message.meta,
                scope
              }
            }
          : message
      )
    )
  }

  const runRule = async (rule: PageScriptRule, enableBeforeRun = false) => {
    if (!activeState?.tabId || ruleActionId) {
      return
    }

    setRuleActionId(rule.id)
    setError("")

    try {
      if (enableBeforeRun && !rule.enabled) {
        await chrome.runtime.sendMessage({
          type: "ASH_TOGGLE_RULE",
          ruleId: rule.id,
          enabled: true
        })
      }

      await chrome.runtime.sendMessage({
        type: "ASH_EXECUTE_RULE",
        ruleId: rule.id,
        tabId: activeState.tabId
      })

      await loadActiveState()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setRuleActionId(null)
    }
  }

  const toggleRule = async (rule: PageScriptRule, enabled: boolean) => {
    if (ruleActionId) {
      return
    }

    setRuleActionId(rule.id)
    setError("")

    try {
      await chrome.runtime.sendMessage({
        type: "ASH_TOGGLE_RULE",
        ruleId: rule.id,
        enabled
      })

      if (!enabled && activeState?.tabId) {
        await chrome.tabs.reload(activeState.tabId)
        return
      }

      await loadActiveState()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setRuleActionId(null)
    }
  }

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void sendPrompt()
    }
  }

  const currentTabLabel = useMemo(() => {
    if (!activeState?.title) {
      return "Current tab"
    }
    return activeState.title
  }, [activeState?.title])

  const promptTemplates = activeState?.settings.promptTemplates ?? []
  const enabledRulesCount = activeState?.currentRules.filter((rule) => rule.enabled).length ?? 0

  const applyTemplate = (templateId: string) => {
    const template = promptTemplates.find((item) => item.id === templateId)
    if (!template) {
      return
    }

    setPrompt(template.prompt)
    setMenuOpen(false)
  }

  const executeQuickAction = async (action: QuickAction) => {
    if (running) {
      return
    }

    if (action.mode === "script") {
      setScriptMode(true)
    }

    await runPrompt(action.prompt, action.mode ?? "analyze")
  }

  return (
    <div className="shell shell-chat">
      <div className="chat-layout">
        <header className="chat-topbar">
          <div className="brand-lockup">
            <div className="brand-mark">
              <SparkIcon />
            </div>
            <div className="brand-copy">
              <span className="brand-name">PageHand</span>
              <span className="brand-context" title={currentTabLabel}>
                {currentTabLabel}
              </span>
            </div>
          </div>

          <div className="icon-row">
            <IconButton title="刷新当前页面上下文" onClick={() => void loadActiveState()}>
              <RefreshIcon />
            </IconButton>
            <IconButton title="打开设置" onClick={() => void openSettingsPage()}>
              <SettingsIcon />
            </IconButton>
          </div>
        </header>

        {!activeState?.userScriptsAvailable ? (
          <div className="banner banner-inline">
            还没有开启 `Allow User Scripts`。脚本生成和自动执行依赖这个开关。
          </div>
        ) : null}

        {!activeState?.settings.apiKey ? (
          <div className="banner banner-inline">
            还没有配置 DeepSeek。先去设置页填写 API Key。
          </div>
        ) : null}

        {activeState?.pageAccessError ? (
          <div className="banner banner-inline">{activeState.pageAccessError}</div>
        ) : null}

        {!activeState?.pageAccessError && activeState && !activeState.pageContextReady ? (
          <div className="banner banner-inline">正在连接当前页面上下文...</div>
        ) : null}

        {error ? <div className="banner banner-inline">{error}</div> : null}

        {activeState?.currentRules.length ? (
          <section className="active-rules-panel">
            <button
              className="active-rules-toggle"
              type="button"
              onClick={() => setRulesExpanded((current) => !current)}>
              <div className="active-rules-summary">
                <span className="active-rules-title">当前页脚本</span>
                <span className="active-rules-stats">
                  生效 {enabledRulesCount} / 共 {activeState.currentRules.length}
                </span>
              </div>
              <span className="active-rules-chevron">
                <ChevronIcon open={rulesExpanded} />
              </span>
            </button>

            {rulesExpanded ? (
              <div className="active-rules-list">
                {activeState.currentRules.map((rule) => (
                  <article
                    key={rule.id}
                    className={`active-rule-card ${rule.enabled ? "enabled" : "disabled"}`}>
                    <div className="active-rule-main">
                      <div className="active-rule-title-row">
                        <span className="active-rule-title">{rule.name}</span>
                        <span className="tag">{rule.scope}</span>
                      </div>
                      <div className="active-rule-meta">
                        <span>{rule.enabled ? "生效中" : "已停用"}</span>
                        <span>命中 {rule.hitCount}</span>
                      </div>
                    </div>

                    <div className="active-rule-actions">
                      <button
                        className="rule-icon-button primary"
                        type="button"
                        title={!rule.enabled ? "启用并执行" : "立即执行"}
                        aria-label={!rule.enabled ? "启用并执行" : "立即执行"}
                        disabled={ruleActionId === rule.id}
                        onClick={() => void runRule(rule, !rule.enabled)}>
                        <PlayIcon />
                      </button>
                      <button
                        className="rule-icon-button"
                        type="button"
                        title={rule.enabled ? "禁用" : "启用"}
                        aria-label={rule.enabled ? "禁用" : "启用"}
                        disabled={ruleActionId === rule.id}
                        onClick={() => void toggleRule(rule, !rule.enabled)}>
                        <PowerIcon />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <main className="chat-stage">
          {messages.length === 0 ? (
            <div className="empty-stage">
              <div className="empty-orb">
                <SparkIcon />
              </div>
              <div className="empty-caption">
                {scriptMode ? "脚本模式已开启" : "当前页智能助手"}
              </div>
              <div className="quick-actions">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    className="quick-action-button"
                    type="button"
                    disabled={running || Boolean(activeState?.pageAccessError)}
                    onClick={() => void executeQuickAction(action)}>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages messages-scroll">
              {messages.map((message) => {
                const hasDraft = Boolean(message.meta?.draft)
                const showExecute = hasDraft && !message.meta?.executed
                const isLoading = Boolean(message.meta?.loading)

                return (
                  <article key={message.id} className={`message ${message.role}`}>
                    <div className="message-meta">
                      <span>{message.role === "user" ? "You" : "Assistant"}</span>
                      <span>{message.mode === "script" ? "Script" : "Chat"}</span>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>

                    {isLoading ? (
                      <div className="loading-message" aria-label="Assistant is thinking">
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                      </div>
                    ) : (
                      <MarkdownMessage content={message.content} />
                    )}

                    {hasDraft && !isLoading ? (
                      <div className="draft-box">
                        <div className="draft-meta">
                          <span className="tag">{message.meta?.draft?.scope}</span>
                          <span className="mono">{message.meta?.draft?.name}</span>
                        </div>
                        <pre className="code-preview">
                          {message.meta?.draft?.code}
                        </pre>
                      </div>
                    ) : null}

                    {showExecute ? (
                      <div className="message-actions">
                        <select
                          className="scope-select"
                          value={message.meta?.scope ?? "path"}
                          onChange={(event) =>
                            updateDraftScope(message.id, event.target.value as ScriptScope)
                          }>
                          {SCOPE_OPTIONS.map((scope) => (
                            <option key={scope} value={scope}>
                              {scope}
                            </option>
                          ))}
                        </select>
                        <button
                          className="execute-button"
                          type="button"
                          disabled={executingDraftId === message.id}
                          onClick={() => void executeDraft(message.id, message.meta!.draft!)}>
                          {executingDraftId === message.id ? "执行中..." : "执行"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </main>

        <footer className="composer-dock">
          <div className="composer-shell">
            <textarea
              className="composer-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder={
                scriptMode
                  ? "描述你希望页面如何被修改"
                  : "发消息给当前页助手"
              }
            />

            <div className="composer-bar">
              <div className="icon-row">
                <div className="composer-menu-wrap" ref={menuRef}>
                  <IconButton
                    title={menuOpen ? "关闭更多操作" : "更多操作"}
                    active={menuOpen}
                    onClick={() => setMenuOpen((current) => !current)}>
                    <PlusIcon />
                  </IconButton>

                  {menuOpen ? (
                    <div className="composer-menu" role="menu">
                      <div className="composer-menu-item composer-menu-item-branch">
                        <button
                          className="composer-menu-button"
                          type="button"
                          disabled={promptTemplates.length === 0}>
                          <span>Library</span>
                          <span className="composer-menu-arrow">›</span>
                        </button>

                        <div className="composer-submenu">
                          {promptTemplates.length === 0 ? (
                            <div className="composer-submenu-empty">还没有模板</div>
                          ) : (
                            promptTemplates.map((template) => (
                              <button
                                key={template.id}
                                className="composer-menu-button"
                                type="button"
                                onClick={() => applyTemplate(template.id)}>
                                {template.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <IconButton
                  title={searchEnabled ? "关闭搜索" : "开启搜索"}
                  active={searchEnabled}
                  onClick={() => setSearchEnabled((current) => !current)}>
                  <SearchIcon />
                </IconButton>
                <IconButton
                  title={scriptMode ? "关闭脚本模式" : "开启脚本模式"}
                  active={scriptMode}
                  onClick={() => setScriptMode((current) => !current)}>
                  <ScriptIcon />
                </IconButton>
              </div>

              <IconButton
                title={running ? "发送中" : "发送"}
                primary
                disabled={
                  !activeState?.tabId ||
                  Boolean(activeState?.pageAccessError) ||
                  !activeState?.settings.apiKey ||
                  running ||
                  !prompt.trim()
                }
                onClick={() => void sendPrompt()}>
                <SendIcon />
              </IconButton>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
