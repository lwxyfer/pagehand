import { useEffect, useState } from "react"
import { useThemeMode } from "../theme"
import type {
  AISettings,
  PageScriptRule,
  PromptTemplate,
  SitePromptProfile,
  ScriptScope,
  ThemeMode
} from "../types"

const createTemplate = (): PromptTemplate => ({
  id: crypto.randomUUID(),
  name: "",
  prompt: ""
})

const createSiteProfile = (): SitePromptProfile => ({
  id: crypto.randomUUID(),
  hostname: "",
  instruction: "",
  enabled: true
})

const sortRules = (rules: PageScriptRule[]) => [...rules].sort((a, b) => b.updatedAt - a.updatedAt)

export default function OptionsApp() {
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [rules, setRules] = useState<PageScriptRule[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")

  useThemeMode(settings?.themeMode ?? "auto")

  const load = async () => {
    const activeState = await chrome.runtime.sendMessage({
      type: "ASH_GET_ACTIVE_TAB_STATE"
    })
    const allRules = (await chrome.runtime.sendMessage({
      type: "ASH_LIST_RULES"
    })) as PageScriptRule[]
    setSettings(activeState.settings)
    setRules(sortRules(allRules))
  }

  useEffect(() => {
    void load()
  }, [])

  const updateSettings = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current))
  }

  const save = async () => {
    if (!settings) {
      return
    }
    setSaving(true)
    setStatus("")
    setError("")
    try {
      await chrome.runtime.sendMessage({
        type: "ASH_SAVE_SETTINGS",
        settings
      })
      setStatus("设置已保存。")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setStatus("")
    setError("")
    try {
      if (settings) {
        await chrome.runtime.sendMessage({
          type: "ASH_SAVE_SETTINGS",
          settings
        })
      }
      const response = await chrome.runtime.sendMessage({
        type: "ASH_TEST_CONNECTION"
      })
      setStatus(`连接测试成功：${response.reply}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setTesting(false)
    }
  }

  const updateTemplate = (id: string, updater: (template: PromptTemplate) => PromptTemplate) => {
    setSettings((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        promptTemplates: current.promptTemplates.map((template) =>
          template.id === id ? updater(template) : template
        )
      }
    })
  }

  const removeTemplate = (id: string) => {
    setSettings((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        promptTemplates: current.promptTemplates.filter((template) => template.id !== id)
      }
    })
  }

  const updateSiteProfile = (
    id: string,
    updater: (profile: SitePromptProfile) => SitePromptProfile
  ) => {
    setSettings((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        siteProfiles: current.siteProfiles.map((profile) =>
          profile.id === id ? updater(profile) : profile
        )
      }
    })
  }

  const removeRule = async (ruleId: string) => {
    await chrome.runtime.sendMessage({
      type: "ASH_DELETE_RULE",
      ruleId
    })
    await load()
  }

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    await chrome.runtime.sendMessage({
      type: "ASH_TOGGLE_RULE",
      ruleId,
      enabled
    })
    await load()
  }

  if (!settings) {
    return (
      <div className="shell">
        <div className="card">
          <div className="card-body">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <div className="stack">
        <section className="card">
          <div className="card-body stack">
            <div className="header">
              <div>
                <p className="eyebrow">Settings</p>
                <h1 className="title">AI Sidebar Hand 设置</h1>
                <p className="subtitle">
                  这里维护 DeepSeek 连接、默认持久化策略、模板库和站点级指令。首次使用前，也请在 Chrome 扩展详情页打开 “Allow User Scripts”。
                </p>
              </div>
              <div className="button-row">
                <button className="ghost-button" onClick={() => void load()}>
                  重新读取
                </button>
              </div>
            </div>

            {status ? <div className="banner success">{status}</div> : null}
            {error ? <div className="banner">{error}</div> : null}

            <div className="grid two">
              <label className="field">
                <span className="label">DeepSeek API Key</span>
                <input
                  className="input"
                  aria-label="DeepSeek API Key"
                  type="password"
                  value={settings.apiKey}
                  onChange={(event) => updateSettings("apiKey", event.target.value)}
                  placeholder="sk-..."
                />
              </label>

              <label className="field">
                <span className="label">Base URL</span>
                <input
                  className="input"
                  aria-label="Base URL"
                  value={settings.baseUrl}
                  onChange={(event) => updateSettings("baseUrl", event.target.value)}
                />
              </label>

              <label className="field">
                <span className="label">Model</span>
                <input
                  className="input"
                  aria-label="Model"
                  value={settings.model}
                  onChange={(event) => updateSettings("model", event.target.value)}
                />
              </label>

              <label className="field">
                <span className="label">主题</span>
                <select
                  className="select"
                  value={settings.themeMode}
                  onChange={(event) =>
                    updateSettings("themeMode", event.target.value as ThemeMode)
                  }>
                  <option value="auto">auto</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
              </label>

              <label className="field">
                <span className="label">默认持久化范围</span>
                <select
                  className="select"
                  value={settings.defaultScope}
                  onChange={(event) =>
                    updateSettings("defaultScope", event.target.value as ScriptScope)
                  }>
                  <option value="exact">exact</option>
                  <option value="path">path</option>
                  <option value="domain">domain</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Temperature</span>
                <input
                  className="input"
                  aria-label="Temperature"
                  type="number"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(event) => updateSettings("temperature", Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span className="label">Max Tokens</span>
                <input
                  className="input"
                  aria-label="Max Tokens"
                  type="number"
                  value={settings.maxTokens}
                  onChange={(event) => updateSettings("maxTokens", Number(event.target.value))}
                />
              </label>
            </div>

            <label className="field">
              <span className="label">联网搜索</span>
              <div className="switch">
                <input
                  type="checkbox"
                  checked={settings.searchEnabled}
                  onChange={(event) => updateSettings("searchEnabled", event.target.checked)}
                />
                使用 DuckDuckGo Instant Answer 作为额外上下文源
              </div>
            </label>

            <div className="button-row">
              <button className="primary-button" disabled={saving} onClick={() => void save()}>
                {saving ? "保存中..." : "保存设置"}
              </button>
              <button
                className="ghost-button"
                disabled={testing}
                onClick={() => void testConnection()}>
                {testing ? "测试中..." : "测试 DeepSeek 连接"}
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-body stack">
            <div className="header">
              <div>
                <p className="eyebrow">Templates</p>
                <h2 className="title" style={{ fontSize: 18 }}>Prompt Library</h2>
                <p className="subtitle">这些模板会出现在侧边栏下拉菜单里，用来快速填充常见改造指令。</p>
              </div>
              <button
                className="ghost-button"
                onClick={() =>
                  updateSettings("promptTemplates", [...settings.promptTemplates, createTemplate()])
                }>
                新增模板
              </button>
            </div>

            <div className="list-editor">
              {settings.promptTemplates.map((template) => (
                <div className="editor-item" key={template.id}>
                  <div className="grid two">
                    <label className="field">
                      <span className="label">名称</span>
                      <input
                        className="input"
                        value={template.name}
                        onChange={(event) =>
                          updateTemplate(template.id, (current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="label">提示词</span>
                      <textarea
                        className="textarea"
                        value={template.prompt}
                        onChange={(event) =>
                          updateTemplate(template.id, (current) => ({
                            ...current,
                            prompt: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="editor-actions">
                    <button className="danger-button" onClick={() => removeTemplate(template.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-body stack">
            <div className="header">
              <div>
                <p className="eyebrow">Sites</p>
                <h2 className="title" style={{ fontSize: 18 }}>站点指令</h2>
                <p className="subtitle">为特定域名追加长期指令，生成或分析时会自动带上。</p>
              </div>
              <button
                className="ghost-button"
                onClick={() =>
                  updateSettings("siteProfiles", [...settings.siteProfiles, createSiteProfile()])
                }>
                新增站点指令
              </button>
            </div>

            <div className="list-editor">
              {settings.siteProfiles.length === 0 ? (
                <div className="empty">还没有站点级额外指令。</div>
              ) : (
                settings.siteProfiles.map((profile) => (
                  <div className="editor-item" key={profile.id}>
                    <div className="grid two">
                      <label className="field">
                        <span className="label">Hostname</span>
                        <input
                          className="input"
                          value={profile.hostname}
                          placeholder="example.com"
                          onChange={(event) =>
                            updateSiteProfile(profile.id, (current) => ({
                              ...current,
                              hostname: event.target.value.trim()
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="label">附加指令</span>
                        <textarea
                          className="textarea"
                          value={profile.instruction}
                          onChange={(event) =>
                            updateSiteProfile(profile.id, (current) => ({
                              ...current,
                              instruction: event.target.value
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="editor-actions">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={profile.enabled}
                          onChange={(event) =>
                            updateSiteProfile(profile.id, (current) => ({
                              ...current,
                              enabled: event.target.checked
                            }))
                          }
                        />
                        启用
                      </label>
                      <button
                        className="danger-button"
                        onClick={() =>
                          updateSettings(
                            "siteProfiles",
                            settings.siteProfiles.filter((item) => item.id !== profile.id)
                          )
                        }>
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-body stack">
            <div className="header">
              <div>
                <p className="eyebrow">Rules</p>
                <h2 className="title" style={{ fontSize: 18 }}>全局规则概览</h2>
              </div>
            </div>

            <div className="rule-list">
              {rules.length === 0 ? (
                <div className="empty">还没有缓存脚本。</div>
              ) : (
                rules.map((rule) => (
                  <div className="rule-card" key={rule.id}>
                    <div className="rule-top">
                      <div>
                        <h3 className="rule-name">{rule.name}</h3>
                        <div className="rule-meta">
                          <span className="tag">{rule.scope}</span>
                          <span>{rule.hostname}</span>
                          <span>命中 {rule.hitCount} 次</span>
                          <span>更新时间 {new Date(rule.updatedAt).toLocaleString()}</span>
                        </div>
                        <p className="rule-summary">{rule.summary}</p>
                        {rule.lastError ? (
                          <div className="banner" style={{ marginTop: 10 }}>{rule.lastError}</div>
                        ) : null}
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(event) => void toggleRule(rule.id, event.target.checked)}
                        />
                        启用
                      </label>
                    </div>

                    <div className="editor-actions">
                      <button className="danger-button" onClick={() => void removeRule(rule.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
