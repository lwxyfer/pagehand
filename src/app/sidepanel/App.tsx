import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useThemeMode } from "../theme"
import { useTranslation } from "../useTranslation"
import type {
  ActiveTabState,
  AssistantMode,
  ConversationMessage,
  GeneratedScriptDraft,
  PageScriptRule,
  ScriptScope,
  ThemeMode
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
  const { t, locale } = useTranslation(activeState?.settings.locale)

  const activeMode: AssistantMode = scriptMode ? "script" : "analyze"

  const quickActions: QuickAction[] = useMemo(() => [
    { label: t("sidepanel.qa1.label"), prompt: t("sidepanel.qa1.prompt") },
    { label: t("sidepanel.qa2.label"), prompt: t("sidepanel.qa2.prompt") },
    { label: t("sidepanel.qa3.label"), prompt: t("sidepanel.qa3.prompt") },
    { label: t("sidepanel.qa4.label"), prompt: t("sidepanel.qa4.prompt"), mode: "script" }
  ], [locale]) // eslint-disable-line react-hooks/exhaustive-deps

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
          t("sidepanel.msg.executed"),
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
      return t("sidepanel.currentTab")
    }
    return activeState.title
  }, [activeState?.title, locale])

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
            <IconButton title={t("sidepanel.settings")} onClick={() => void openSettingsPage()}>
              <SettingsIcon />
            </IconButton>
          </div>
        </header>

        {!activeState?.userScriptsAvailable ? (
          <div className="banner banner-inline">
            {t("sidepanel.banner.userScripts")}
          </div>
        ) : null}

        {!activeState?.settings.apiKey ? (
          <div className="banner banner-inline">
            {t("sidepanel.banner.apiKey")}
          </div>
        ) : null}

        {activeState?.pageAccessError ? (
          <div className="banner banner-inline">{activeState.pageAccessError}</div>
        ) : null}

        {!activeState?.pageAccessError && activeState && !activeState.pageContextReady ? (
          <div className="banner banner-inline">{t("sidepanel.banner.connecting")}</div>
        ) : null}

        {error ? <div className="banner banner-inline">{error}</div> : null}

        {activeState?.currentRules.length ? (
          <section className="active-rules-panel">
            <button
              className="active-rules-toggle"
              type="button"
              onClick={() => setRulesExpanded((current) => !current)}>
              <div className="active-rules-summary">
                <span className="active-rules-title">{t("sidepanel.rules.title")}</span>
                <span className="active-rules-stats">
                  {t("sidepanel.rules.active")} {enabledRulesCount} / {activeState.currentRules.length}
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
                        <span>{rule.enabled ? t("sidepanel.rules.active") : t("sidepanel.rules.disabled")}</span>
                        <span>{t("sidepanel.rules.hitCount", { n: rule.hitCount })}</span>
                      </div>
                    </div>

                    <div className="active-rule-actions">
                      <button
                        className="rule-icon-button primary"
                        type="button"
                        title={!rule.enabled ? t("sidepanel.rules.enableAndRun") : t("sidepanel.rules.runNow")}
                        aria-label={!rule.enabled ? t("sidepanel.rules.enableAndRun") : t("sidepanel.rules.runNow")}
                        disabled={ruleActionId === rule.id}
                        onClick={() => void runRule(rule, !rule.enabled)}>
                        <PlayIcon />
                      </button>
                      <button
                        className="rule-icon-button"
                        type="button"
                        title={rule.enabled ? t("sidepanel.rules.disable") : t("sidepanel.rules.enable")}
                        aria-label={rule.enabled ? t("sidepanel.rules.disable") : t("sidepanel.rules.enable")}
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
                {scriptMode ? t("sidepanel.empty.scriptMode") : t("sidepanel.empty.assistant")}
              </div>
              <div className="quick-actions">
                {quickActions.map((action) => (
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
                      <span>{message.role === "user" ? t("sidepanel.msg.you") : t("sidepanel.msg.assistant")}</span>
                      <span>{message.mode === "script" ? t("common.script") : t("common.chat")}</span>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>

                    {isLoading ? (
                      <div className="loading-message" aria-label={t("sidepanel.msg.thinking")}>
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
                        <button
                          className="execute-button"
                          type="button"
                          disabled={executingDraftId === message.id}
                          onClick={() => void executeDraft(message.id, message.meta!.draft!)}>
                          {executingDraftId === message.id ? t("sidepanel.msg.executing") : t("sidepanel.msg.execute")}
                        </button>
                        <select
                          className="scope-text-select"
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
                  ? t("sidepanel.composer.placeholder.script")
                  : t("sidepanel.composer.placeholder.chat")
              }
            />

            <div className="composer-bar">
              <div className="icon-row">
                <div className="composer-menu-wrap" ref={menuRef}>
                  <IconButton
                    title={menuOpen ? t("sidepanel.composer.close") : t("sidepanel.composer.more")}
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
                          <span>{t("sidepanel.composer.library")}</span>
                          <span className="composer-menu-arrow">›</span>
                        </button>

                        <div className="composer-submenu">
                          {promptTemplates.length === 0 ? (
                            <div className="composer-submenu-empty">{t("sidepanel.composer.noTemplates")}</div>
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
                  title={searchEnabled ? t("sidepanel.composer.searchOff") : t("sidepanel.composer.searchOn")}
                  active={searchEnabled}
                  onClick={() => setSearchEnabled((current) => !current)}>
                  <SearchIcon />
                </IconButton>
                <IconButton
                  title={scriptMode ? t("sidepanel.composer.scriptOff") : t("sidepanel.composer.scriptOn")}
                  active={scriptMode}
                  onClick={() => setScriptMode((current) => !current)}>
                  <ScriptIcon />
                </IconButton>
              </div>

              <IconButton
                title={running ? t("sidepanel.composer.sending") : t("sidepanel.composer.send")}
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
