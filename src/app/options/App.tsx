import { useEffect, useMemo, useState } from "react"
import { useThemeMode } from "../theme"
import { useTranslation } from "../useTranslation"
import type {
  AISettings,
  PageScriptRule,
  PromptTemplate,
  SitePromptProfile,
  ScriptScope,
  ThemeMode,
  Locale
} from "../types"

type Tab = "basic" | "templates" | "sites" | "rules"

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
  const [activeTab, setActiveTab] = useState<Tab>("basic")

  useThemeMode(settings?.themeMode ?? "auto")
  const { t, locale } = useTranslation(settings?.locale)

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
      setStatus(t("options.saved"))
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
      setStatus(t("options.testSuccess", { reply: response.reply }))
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

  const tabs: Array<{ key: Tab; label: string }> = useMemo(
    () => [
      { key: "basic", label: t("options.tab.basic") },
      { key: "templates", label: t("options.tab.templates") },
      { key: "sites", label: t("options.tab.sites") },
      { key: "rules", label: t("options.tab.rules") }
    ],
    [locale]
  )

  if (!settings) {
    return (
      <div className="shell shell-options">
        <div className="card">
          <div className="card-body">{t("options.loading")}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="shell shell-options">
      <div className="options-topbar">
        <div>
          <p className="eyebrow">{t("options.eyebrow")}</p>
          <h1 className="title">{t("options.title")}</h1>
        </div>
      </div>

      {status ? <div className="banner success">{status}</div> : null}
      {error ? <div className="banner">{error}</div> : null}

      <div className="options-layout">
        <nav className="options-sidebar">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              className={`options-sidebar-item${activeTab === key ? " active" : ""}`}
              onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
          <div className="options-sidebar-divider" />
          <div className="options-sidebar-field">
            <span className="options-sidebar-field-label">{t("options.locale")}</span>
            <select
              className="options-sidebar-select"
              value={locale}
              onChange={(event) => {
                const next = event.target.value as Locale
                updateSettings("locale", next)
                if (settings) {
                  void chrome.runtime.sendMessage({
                    type: "ASH_SAVE_SETTINGS",
                    settings: { ...settings, locale: next }
                  })
                }
              }}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="options-sidebar-field">
            <span className="options-sidebar-field-label">{t("options.theme")}</span>
            <select
              className="options-sidebar-select"
              value={settings.themeMode}
              onChange={(event) =>
                updateSettings("themeMode", event.target.value as ThemeMode)
              }>
              <option value="auto">{t("common.auto")}</option>
              <option value="light">{t("common.light")}</option>
              <option value="dark">{t("common.dark")}</option>
            </select>
          </div>
        </nav>

        <div className="options-content">
          {activeTab === "basic" ? (
            <section className="card">
              <div className="card-body stack">
                <div className="options-section">
                  <h3 className="options-section-title">{t("options.section.model")}</h3>
                  <div className="grid two">
                    <label className="field">
                      <span className="label">{t("options.apiKey")}</span>
                      <input
                        className="input"
                        aria-label="API Key"
                        type="password"
                        value={settings.apiKey}
                        onChange={(event) => updateSettings("apiKey", event.target.value)}
                        placeholder="sk-..."
                      />
                    </label>

                    <label className="field">
                      <span className="label">{t("options.baseUrl")}</span>
                      <input
                        className="input"
                        aria-label="Base URL"
                        value={settings.baseUrl}
                        onChange={(event) => updateSettings("baseUrl", event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <span className="label">{t("options.model")}</span>
                      <input
                        className="input"
                        aria-label="Model"
                        value={settings.model}
                        onChange={(event) => updateSettings("model", event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <span className="label">{t("options.temperature")}</span>
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
                      <span className="label">{t("options.maxTokens")}</span>
                      <input
                        className="input"
                        aria-label="Max Tokens"
                        type="number"
                        value={settings.maxTokens}
                        onChange={(event) => updateSettings("maxTokens", Number(event.target.value))}
                      />
                    </label>
                  </div>
                </div>

                <div className="options-section">
                  <h3 className="options-section-title">{t("options.section.behavior")}</h3>
                  <div className="grid two">
                    <label className="field">
                      <span className="label">{t("options.scope")}</span>
                      <select
                        className="select"
                        value={settings.defaultScope}
                        onChange={(event) =>
                          updateSettings("defaultScope", event.target.value as ScriptScope)
                        }>
                        <option value="exact">{t("common.exact")}</option>
                        <option value="path">{t("common.path")}</option>
                        <option value="domain">{t("common.domain")}</option>
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    <span className="label">{t("options.searchToggle")}</span>
                    <div className="switch">
                      <input
                        type="checkbox"
                        checked={settings.searchEnabled}
                        onChange={(event) => updateSettings("searchEnabled", event.target.checked)}
                      />
                      {t("options.searchDesc")}
                    </div>
                  </label>
                </div>

                <div className="button-row" style={{ marginTop: 8 }}>
                  <button className="primary-button" disabled={saving} onClick={() => void save()}>
                    {saving ? t("options.saving") : t("options.save")}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={testing}
                    onClick={() => void testConnection()}>
                    {testing ? t("options.testing") : t("options.test")}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "templates" ? (
            <section className="card">
              <div className="card-body stack">
                <div className="header">
                  <div>
                    <p className="eyebrow">{t("options.templates.eyebrow")}</p>
                    <h2 className="title" style={{ fontSize: 18 }}>{t("options.templates.title")}</h2>
                    <p className="subtitle">{t("options.templates.subtitle")}</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      updateSettings("promptTemplates", [...settings.promptTemplates, createTemplate()])
                    }>
                    {t("options.templates.add")}
                  </button>
                </div>

                <div className="list-editor">
                  {settings.promptTemplates.map((template) => (
                    <div className="editor-item" key={template.id}>
                      <div className="grid two">
                        <label className="field">
                          <span className="label">{t("options.templates.name")}</span>
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
                          <span className="label">{t("options.templates.prompt")}</span>
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
                          {t("options.templates.delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "sites" ? (
            <section className="card">
              <div className="card-body stack">
                <div className="header">
                  <div>
                    <p className="eyebrow">{t("options.sites.eyebrow")}</p>
                    <h2 className="title" style={{ fontSize: 18 }}>{t("options.sites.title")}</h2>
                    <p className="subtitle">{t("options.sites.subtitle")}</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      updateSettings("siteProfiles", [...settings.siteProfiles, createSiteProfile()])
                    }>
                    {t("options.sites.add")}
                  </button>
                </div>

                <div className="list-editor">
                  {settings.siteProfiles.length === 0 ? (
                    <div className="empty">{t("options.sites.empty")}</div>
                  ) : (
                    settings.siteProfiles.map((profile) => (
                      <div className="editor-item" key={profile.id}>
                        <div className="grid two">
                          <label className="field">
                            <span className="label">{t("options.sites.hostname")}</span>
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
                            <span className="label">{t("options.sites.instruction")}</span>
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
                            {t("options.sites.enable")}
                          </label>
                          <button
                            className="danger-button"
                            onClick={() =>
                              updateSettings(
                                "siteProfiles",
                                settings.siteProfiles.filter((item) => item.id !== profile.id)
                              )
                            }>
                            {t("options.sites.delete")}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "rules" ? (
            <section className="card">
              <div className="card-body stack">
                <div className="header">
                  <div>
                    <p className="eyebrow">{t("options.rules.eyebrow")}</p>
                    <h2 className="title" style={{ fontSize: 18 }}>{t("options.rules.title")}</h2>
                  </div>
                </div>

                <div className="rule-list">
                  {rules.length === 0 ? (
                    <div className="empty">{t("options.rules.empty")}</div>
                  ) : (
                    rules.map((rule) => (
                      <div className="rule-card" key={rule.id}>
                        <div className="rule-top">
                          <div>
                            <h3 className="rule-name">{rule.name}</h3>
                            <div className="rule-meta">
                              <span className="tag">{rule.scope}</span>
                              <span>{rule.hostname}</span>
                              <span>{t("options.rules.hitCount", { n: rule.hitCount })}</span>
                              <span>{t("options.rules.updated", { date: new Date(rule.updatedAt).toLocaleString() })}</span>
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
                            {t("options.rules.enable")}
                          </label>
                        </div>

                        <div className="editor-actions">
                          <button className="danger-button" onClick={() => void removeRule(rule.id)}>
                            {t("options.rules.delete")}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
