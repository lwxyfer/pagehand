import { RULE_ID_PREFIX, SCRIPT_EVENT_NAME, SENSITIVE_HOST_PATTERNS } from "./constants"
import type { PageScriptRule, ScriptExecutionEvent } from "./types"
import { stripHash } from "./url"

const chromeWithUserScripts = chrome as typeof chrome & {
  userScripts?: any
}

export const userScriptsAvailable = () => {
  return typeof chromeWithUserScripts.userScripts?.register === "function"
}

const escapeForTemplate = (value: string) => JSON.stringify(value)

const wrapCode = (rule: PageScriptRule, source: "manual" | "auto") => {
  const exactCheck = rule.exactUrl
    ? `if (location.href.replace(location.hash, "") !== ${escapeForTemplate(rule.exactUrl)}) { return; }`
    : ""

  return `
(() => {
  const emit = (status, error) => {
    window.dispatchEvent(new CustomEvent(${escapeForTemplate(SCRIPT_EVENT_NAME)}, {
      detail: {
        ruleId: ${escapeForTemplate(rule.id)},
        status,
        source: ${escapeForTemplate(source)},
        url: location.href,
        executedAt: Date.now(),
        error: error ? String(error) : undefined
      }
    }))
  };

  try {
    ${exactCheck}
    ${rule.code}
    emit("success")
  } catch (error) {
    emit("error", error && (error.stack || error.message || error))
    throw error
  }
})();
`
}

const toRegisteredScript = (rule: PageScriptRule) => ({
  id: `${RULE_ID_PREFIX}${rule.id}`,
  matches: rule.matches,
  js: [{ code: wrapCode(rule, "auto") }],
  runAt: rule.runAt,
  world: rule.world
})

export const syncRegisteredUserScripts = async (rules: PageScriptRule[]) => {
  if (!userScriptsAvailable()) {
    return
  }

  const existing = await chromeWithUserScripts.userScripts!.getScripts()
  const ours = existing
    .map((script: { id?: string }) => script.id)
    .filter((id: string | undefined): id is string => Boolean(id?.startsWith(RULE_ID_PREFIX)))

  if (ours.length > 0) {
    await chromeWithUserScripts.userScripts!.unregister({ ids: ours })
  }

  const enabledRules = rules.filter((rule) => rule.enabled)
  if (enabledRules.length === 0) {
    return
  }

  await chromeWithUserScripts.userScripts!.register(enabledRules.map(toRegisteredScript))
}

export const executeRuleNow = async (tabId: number, rule: PageScriptRule) => {
  if (!userScriptsAvailable()) {
    throw new Error("Chrome userScripts is not available. Enable Allow User Scripts for this extension.")
  }

  await chromeWithUserScripts.userScripts!.execute({
    target: { tabId },
    js: [{ code: wrapCode(rule, "manual") }],
    injectImmediately: true,
    world: rule.world
  })
}

export const executeRulesNow = async (tabId: number, rules: PageScriptRule[]) => {
  for (const rule of rules) {
    await executeRuleNow(tabId, rule)
  }
}

export const isSensitiveHost = (url: string) => {
  const hostname = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return ""
    }
  })()
  return SENSITIVE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
}

export const normalizeEventUrl = (url: string) => stripHash(url)

export const isExecutionEvent = (payload: unknown): payload is ScriptExecutionEvent => {
  if (!payload || typeof payload !== "object") {
    return false
  }
  const maybe = payload as Record<string, unknown>
  return (
    typeof maybe.ruleId === "string" &&
    (maybe.status === "success" || maybe.status === "error") &&
    (maybe.source === "manual" || maybe.source === "auto") &&
    typeof maybe.url === "string" &&
    typeof maybe.executedAt === "number"
  )
}
