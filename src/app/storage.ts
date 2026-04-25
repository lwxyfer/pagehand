import { DEFAULT_SETTINGS } from "./constants"
import { STORAGE_KEYS } from "./constants"
import type { AISettings, PageScriptRule } from "./types"
import { getHostname, matchesRuleForUrl } from "./url"

const readLocal = async <T>(key: string, fallback: T): Promise<T> => {
  const result = await chrome.storage.local.get(key)
  return (result[key] as T | undefined) ?? fallback
}

const writeLocal = async <T>(key: string, value: T) => {
  await chrome.storage.local.set({ [key]: value })
}

export const getSettings = async (): Promise<AISettings> => {
  const stored = await readLocal<Partial<AISettings>>(STORAGE_KEYS.settings, {})
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    promptTemplates:
      stored.promptTemplates?.length ? stored.promptTemplates : DEFAULT_SETTINGS.promptTemplates,
    siteProfiles: stored.siteProfiles ?? DEFAULT_SETTINGS.siteProfiles
  }
}

export const saveSettings = async (settings: AISettings) => {
  await writeLocal(STORAGE_KEYS.settings, settings)
}

export const getRules = async (): Promise<PageScriptRule[]> => {
  return readLocal<PageScriptRule[]>(STORAGE_KEYS.rules, [])
}

export const saveRules = async (rules: PageScriptRule[]) => {
  await writeLocal(STORAGE_KEYS.rules, rules)
}

export const upsertRule = async (rule: PageScriptRule) => {
  const rules = await getRules()
  const index = rules.findIndex((item) => item.id === rule.id)

  if (index >= 0) {
    rules[index] = rule
  } else {
    rules.unshift(rule)
  }

  await saveRules(rules)
}

export const addRule = async (rule: PageScriptRule) => {
  const rules = await getRules()
  rules.unshift(rule)
  await saveRules(rules)
}

const scopePriority: Record<PageScriptRule["scope"], number> = {
  domain: 0,
  path: 1,
  exact: 2
}

export const sortRulesForExecution = (rules: PageScriptRule[]) =>
  [...rules].sort((left, right) => {
    const scopeDiff = scopePriority[left.scope] - scopePriority[right.scope]
    if (scopeDiff !== 0) {
      return scopeDiff
    }

    return left.createdAt - right.createdAt
  })

export const updateRule = async (
  ruleId: string,
  updater: (rule: PageScriptRule) => PageScriptRule
) => {
  const rules = await getRules()
  const nextRules = rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule))
  await saveRules(nextRules)
  return nextRules.find((rule) => rule.id === ruleId) ?? null
}

export const deleteRule = async (ruleId: string) => {
  const rules = await getRules()
  const nextRules = rules.filter((rule) => rule.id !== ruleId)
  await saveRules(nextRules)
}

export const getRule = async (ruleId: string) => {
  const rules = await getRules()
  return rules.find((rule) => rule.id === ruleId) ?? null
}

export const getRulesForUrl = async (pageUrl: string) => {
  const rules = await getRules()
  const hostname = getHostname(pageUrl)
  return sortRulesForExecution(
    rules.filter((rule) => rule.hostname === hostname && matchesRuleForUrl(rule, pageUrl))
  )
}

export const recordRuleExecution = async (
  ruleId: string,
  status: "success" | "error",
  executedAt: number,
  error?: string
) => {
  await updateRule(ruleId, (rule) => ({
    ...rule,
    hitCount: status === "success" ? rule.hitCount + 1 : rule.hitCount,
    lastRunAt: executedAt,
    lastError: status === "error" ? error || "Unknown error" : undefined
  }))
}
