import type { AISettings, PromptTemplate } from "./types"

export const STORAGE_KEYS = {
  settings: "pagehand:settings",
  rules: "pagehand:rules"
} as const

export const LEGACY_STORAGE_KEYS = {
  settings: "ai-sidebar-hand:settings",
  rules: "ai-sidebar-hand:rules"
} as const

export const SCRIPT_EVENT_NAME = "pagehand:script-status"
export const RULE_ID_PREFIX = "pagehand:"

export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "clean-layout",
    name: "清理页面",
    prompt: "移除页面里的广告、推广区和干扰模块，让正文更易读。"
  },
  {
    id: "insert-summary",
    name: "摘要卡片",
    prompt: "在页面主标题下插入一张摘要卡片，总结当前页面的核心信息。"
  },
  {
    id: "highlight-actions",
    name: "强调重点",
    prompt: "找出页面中最重要的操作区或结论区，并用醒目的样式高亮。"
  },
  {
    id: "translate-page",
    name: "翻译页面",
    prompt: "把页面里的主要正文翻译成简体中文，并保留原有结构。"
  }
]

export const DEFAULT_SETTINGS: AISettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  temperature: 0.2,
  maxTokens: 1800,
  themeMode: "auto",
  locale: "zh",
  defaultScope: "path",
  searchEnabled: false,
  searchProvider: "duckduckgo",
  promptTemplates: DEFAULT_TEMPLATES,
  siteProfiles: []
}

export const SENSITIVE_HOST_PATTERNS = [
  /bank/i,
  /pay/i,
  /wallet/i,
  /admin/i,
  /console/i,
  /stripe\.com$/i,
  /paypal\.com$/i
]
