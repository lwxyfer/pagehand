export type ScriptScope = "exact" | "path" | "domain"
export type ScriptWorld = "MAIN" | "USER_SCRIPT"
export type ScriptRunAt = "document_start" | "document_end" | "document_idle"
export type AssistantMode = "analyze" | "script"
export type AIChatRole = "system" | "user" | "assistant"
export type ThemeMode = "light" | "dark" | "auto"
export type Locale = "zh" | "en"

export interface PromptTemplate {
  id: string
  name: string
  prompt: string
}

export interface SitePromptProfile {
  id: string
  hostname: string
  instruction: string
  enabled: boolean
}

export interface AISettings {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  themeMode: ThemeMode
  locale: Locale
  defaultScope: ScriptScope
  searchEnabled: boolean
  searchProvider: "duckduckgo"
  promptTemplates: PromptTemplate[]
  siteProfiles: SitePromptProfile[]
}

export interface PageContextPayload {
  title: string
  url: string
  selection: string
  mainText: string
  headings: Array<{ level: number; text: string }>
  buttons: Array<{ text: string; selectorHint: string }>
  links: Array<{ text: string; href: string }>
  forms: Array<{ selectorHint: string; fields: string[] }>
  domSummary: string
}

export interface SearchContext {
  provider: string
  query: string
  results: Array<{
    title: string
    url: string
    snippet: string
  }>
}

export interface GeneratedRulePayload {
  name: string
  scope: ScriptScope
  world: ScriptWorld
  runAt: ScriptRunAt
  summary: string
  code: string
}

export interface GeneratedScriptDraft extends GeneratedRulePayload {
  pageUrl: string
  origin: string
  hostname: string
  prompt: string
}

export interface PageScriptRule extends GeneratedRulePayload {
  id: string
  enabled: boolean
  origin: string
  hostname: string
  pageUrl: string
  prompt: string
  matchPattern: string
  targetKey: string
  matches: string[]
  exactUrl?: string
  createdAt: number
  updatedAt: number
  hitCount: number
  lastRunAt?: number
  lastError?: string
}

export interface ConversationMessage {
  id: string
  role: "user" | "assistant"
  mode: AssistantMode
  content: string
  createdAt: number
  meta?: {
    ruleId?: string
    ruleName?: string
    scope?: ScriptScope
    error?: string
    draft?: GeneratedScriptDraft
    executed?: boolean
    loading?: boolean
  }
}

export interface ScriptExecutionEvent {
  ruleId: string
  status: "success" | "error"
  source: "manual" | "auto"
  url: string
  executedAt: number
  error?: string
}

export interface GenerateRequest {
  tabId: number
  mode: AssistantMode
  prompt: string
  scope: ScriptScope
  useSearch: boolean
  history: ConversationMessage[]
}

export interface GenerateResponse {
  mode: AssistantMode
  answer: string
  draft?: GeneratedScriptDraft
  rule?: PageScriptRule
  rules?: PageScriptRule[]
}

export interface AIChatMessage {
  role: AIChatRole
  content: string
}

export interface ActiveTabState {
  tabId: number | null
  title: string
  url: string
  hostname: string
  pageAccessError?: string
  pageContextReady: boolean
  settings: AISettings
  currentRules: PageScriptRule[]
  userScriptsAvailable: boolean
}
