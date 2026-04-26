import { defineBackground } from "wxt/sandbox"
import {
  buildAnalyzeMessages,
  buildScriptMessages,
  findSiteInstruction,
  validateGeneratedRule
} from "../app/prompts"
import { buildScopeTarget, getHostname, getUnsupportedPageReason, safeUrl, stripHash } from "../app/url"
import {
  executeRuleNow,
  executeRulesNow,
  isExecutionEvent,
  isSensitiveHost,
  syncRegisteredUserScripts,
  userScriptsAvailable
} from "../app/runtime"
import {
  addRule,
  deleteRule,
  getRule,
  getRules,
  getRulesForUrl,
  getSettings,
  recordRuleExecution,
  removeTabConversation,
  saveSettings,
  sortRulesForExecution,
  updateRule
} from "../app/storage"
import { generateJsonCompletion, generateTextCompletion, testDeepSeekConnection } from "../app/deepseek"
import { searchDuckDuckGo } from "../app/search"
import type {
  ActiveTabState,
  ConversationMessage,
  GenerateRequest,
  GenerateResponse,
  GeneratedScriptDraft,
  PageContextPayload,
  PageScriptRule
} from "../app/types"

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })
  return tabs[0] ?? null
}

const contentReadyByTab = new Map<number, string>()
const PAGE_CONTEXT_RETRY_DELAYS = [0, 150, 300, 500]
const PAGE_BRIDGE_SCRIPT = "content-scripts/page-bridge.js"

const wait = (delay: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delay)
  })

const ensurePageBridgeInjected = async (tabId: number) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [PAGE_BRIDGE_SCRIPT]
  })
}

const pingPageBridge = async (tabId: number) => {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: "ASH_PING_PAGE_BRIDGE"
  })

  const payload = response as
    | {
        ok?: boolean
        url?: string
      }
    | undefined

  return payload?.ok ? payload.url ?? "" : ""
}

const ensurePageBridgeReady = async (tabId: number, pageUrl: string) => {
  const normalizedUrl = stripHash(pageUrl)

  if (contentReadyByTab.get(tabId) === normalizedUrl) {
    return true
  }

  for (const [index, delay] of PAGE_CONTEXT_RETRY_DELAYS.entries()) {
    if (delay > 0) {
      await wait(delay)
    }

    try {
      const bridgeUrl = await pingPageBridge(tabId)
      if (bridgeUrl) {
        contentReadyByTab.set(tabId, stripHash(bridgeUrl))
        return true
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isReceivingEndMissing =
        message.includes("Receiving end does not exist") ||
        message.includes("message port closed")

      if (!isReceivingEndMissing) {
        throw error
      }

      if (index <= 1) {
        try {
          await ensurePageBridgeInjected(tabId)
        } catch {
          // Ignore and continue retrying.
        }
      }
    }
  }

  return false
}

const getPageContext = async (tabId: number): Promise<PageContextPayload> => {
  const tab = await chrome.tabs.get(tabId)
  const pageAccessError = getUnsupportedPageReason(tab.url || "")

  if (pageAccessError) {
    throw new Error(pageAccessError)
  }

  await ensurePageBridgeReady(tabId, tab.url || "")

  for (const [index, delay] of PAGE_CONTEXT_RETRY_DELAYS.entries()) {
    if (delay > 0) {
      await wait(delay)
    }

    let response: unknown

    try {
      response = await chrome.tabs.sendMessage(tabId, {
        type: "ASH_GET_PAGE_CONTEXT"
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isReceivingEndMissing =
        message.includes("Receiving end does not exist") ||
        message.includes("message port closed")

      if (!isReceivingEndMissing) {
        throw error
      }

      if (index === 1) {
        await ensurePageBridgeReady(tabId, tab.url || "")
      }

      continue
    }

    const payload = response as
      | {
          ok?: boolean
          context?: PageContextPayload
          error?: string
        }
      | undefined

    if (payload?.ok && payload.context) {
      return payload.context
    }

    if (payload?.error) {
      throw new Error(payload.error)
    }
  }

  throw new Error("当前页面上下文还没有准备好，请稍后再试。")
}

const buildActiveTabState = async (): Promise<ActiveTabState> => {
  const [tab, settings] = await Promise.all([getActiveTab(), getSettings()])

  if (!tab?.id || !tab.url) {
    return {
      tabId: null,
      title: "",
      url: "",
      hostname: "",
      pageAccessError: "当前没有可用标签页。",
      pageContextReady: false,
      settings,
      currentRules: [],
      userScriptsAvailable: userScriptsAvailable()
    }
  }

  const pageAccessError = getUnsupportedPageReason(tab.url)
  const normalizedUrl = stripHash(tab.url)
  let pageContextReady = false

  if (!pageAccessError) {
    try {
      pageContextReady = await ensurePageBridgeReady(tab.id, tab.url)
    } catch {
      pageContextReady = false
    }
  }

  return {
    tabId: tab.id,
    title: tab.title || "",
    url: tab.url,
    hostname: getHostname(tab.url),
    pageAccessError,
    pageContextReady: pageContextReady || contentReadyByTab.get(tab.id) === normalizedUrl,
    settings,
    currentRules: await getRulesForUrl(tab.url),
    userScriptsAvailable: userScriptsAvailable()
  }
}

const createPersistedRule = async (draft: GeneratedScriptDraft) => {
  const now = Date.now()
  const scopeTarget = buildScopeTarget(draft.pageUrl, draft.scope)
  const draftRule: PageScriptRule = {
    ...draft,
    id: crypto.randomUUID(),
    enabled: true,
    matchPattern: scopeTarget.matchPattern,
    targetKey: scopeTarget.targetKey,
    matches: scopeTarget.matches,
    exactUrl: scopeTarget.exactUrl,
    createdAt: now,
    updatedAt: now,
    hitCount: 0
  }

  await addRule(draftRule)
  return draftRule
}

const generateRuleDraft = async (
  request: GenerateRequest,
  pageContext: PageContextPayload,
  history: ConversationMessage[]
): Promise<GenerateResponse> => {
  const settings = await getSettings()

  if (isSensitiveHost(pageContext.url)) {
    throw new Error("This host is marked as sensitive. Script generation is disabled here.")
  }

  const searchContext =
    settings.searchEnabled && request.useSearch ? await searchDuckDuckGo(request.prompt) : null

  const siteInstruction = findSiteInstruction(getHostname(pageContext.url), settings.siteProfiles)
  const generated = validateGeneratedRule(
    await generateJsonCompletion(
      settings,
      buildScriptMessages({
        prompt: request.prompt,
        scope: request.scope,
        pageContext,
        history,
        searchContext,
        siteInstruction
      })
    )
  )

  const draft: GeneratedScriptDraft = {
    ...generated,
    scope: request.scope,
    origin: safeUrl(pageContext.url)?.origin || pageContext.url,
    hostname: getHostname(pageContext.url),
    pageUrl: pageContext.url,
    prompt: request.prompt
  }

  return {
    mode: "script",
    answer: draft.summary,
    draft
  }
}

const analyzePage = async (
  request: GenerateRequest,
  pageContext: PageContextPayload,
  history: ConversationMessage[]
): Promise<GenerateResponse> => {
  const settings = await getSettings()
  const searchContext =
    settings.searchEnabled && request.useSearch ? await searchDuckDuckGo(request.prompt) : null
  const siteInstruction = findSiteInstruction(getHostname(pageContext.url), settings.siteProfiles)

  const answer = await generateTextCompletion(
    settings,
    buildAnalyzeMessages({
      prompt: request.prompt,
      pageContext,
      history,
      searchContext,
      siteInstruction
    })
  )

  return {
    mode: "analyze",
    answer
  }
}

const regenerateRule = async (ruleId: string, tabId: number) => {
  const rule = await getRule(ruleId)
  if (!rule) {
    throw new Error("Rule not found.")
  }

  const pageContext = await getPageContext(tabId)
  const response = await generateRuleDraft(
    {
      tabId,
      mode: "script",
      prompt: rule.prompt,
      scope: rule.scope,
      useSearch: false,
      history: []
    },
    pageContext,
    []
  )

  return response
}

const syncRules = async () => {
  await syncRegisteredUserScripts(await getRules())
}

const executeDraft = async (
  tabId: number,
  draft: GeneratedScriptDraft
): Promise<GenerateResponse> => {
  const storedRule = await createPersistedRule(draft)
  await syncRegisteredUserScripts(await getRules())
  await executeRuleNow(tabId, storedRule)

  return {
    mode: "script",
    answer: storedRule.summary,
    rule: storedRule
  }
}

const runMatchingRulesForRoute = async (tabId: number, pageUrl: string) => {
  const pageAccessError = getUnsupportedPageReason(pageUrl)
  if (pageAccessError) {
    return { ok: false, error: pageAccessError }
  }

  const matchingRules = sortRulesForExecution(
    (await getRulesForUrl(pageUrl)).filter((rule) => rule.enabled)
  )

  if (matchingRules.length === 0) {
    return { ok: true, count: 0 }
  }

  await executeRulesNow(tabId, matchingRules)
  return {
    ok: true,
    count: matchingRules.length,
    rules: matchingRules
  }
}

export default defineBackground({
  main() {
    const initialize = async () => {
      await chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: true
      })
      await syncRules()
    }

    chrome.runtime.onInstalled.addListener(() => {
      void initialize()
    })

    chrome.runtime.onStartup.addListener(() => {
      void initialize()
    })

    chrome.runtime.onMessage.addListener((message, sender) => {
      if (message?.type === "ASH_GET_ACTIVE_TAB_STATE") {
        return buildActiveTabState()
      }

      if (message?.type === "ASH_SAVE_SETTINGS") {
        return saveSettings(message.settings).then(async () => {
          await syncRules()
          return {
            ok: true,
            settings: await getSettings()
          }
        })
      }

      if (message?.type === "ASH_TEST_CONNECTION") {
        return getSettings().then((settings) =>
          testDeepSeekConnection(settings).then((reply) => ({ ok: true, reply }))
        )
      }

      if (message?.type === "ASH_LIST_RULES") {
        return getRules()
      }

      if (message?.type === "ASH_RUN_PROMPT") {
        const request = message.payload as GenerateRequest
        return getPageContext(request.tabId).then((pageContext) =>
          request.mode === "script"
            ? generateRuleDraft(request, pageContext, request.history)
            : analyzePage(request, pageContext, request.history)
        )
      }

      if (message?.type === "ASH_EXECUTE_DRAFT") {
        return executeDraft(message.tabId, message.draft)
      }

      if (message?.type === "ASH_CONTENT_READY") {
        if (sender.tab?.id && typeof message.url === "string") {
          contentReadyByTab.set(sender.tab.id, stripHash(message.url))
        }
        return { ok: true }
      }

      if (message?.type === "ASH_ROUTE_CHANGED") {
        if (!sender.tab?.id || typeof message.url !== "string") {
          return { ok: false }
        }
        return runMatchingRulesForRoute(sender.tab.id, message.url)
      }

      if (message?.type === "ASH_TOGGLE_RULE") {
        return updateRule(message.ruleId, (rule) => ({
          ...rule,
          enabled: Boolean(message.enabled),
          updatedAt: Date.now()
        })).then(async (rule) => {
          await syncRules()
          return {
            ok: Boolean(rule),
            rule
          }
        })
      }

      if (message?.type === "ASH_DELETE_RULE") {
        return deleteRule(message.ruleId).then(async () => {
          await syncRules()
          return { ok: true }
        })
      }

      if (message?.type === "ASH_EXECUTE_RULE") {
        return getRule(message.ruleId).then(async (rule) => {
          if (!rule) {
            throw new Error("Rule not found.")
          }
          if (!message.tabId) {
            throw new Error("Missing tab id.")
          }
          await executeRuleNow(message.tabId, rule)
          return { ok: true }
        })
      }

      if (message?.type === "ASH_REGENERATE_RULE") {
        return regenerateRule(message.ruleId, message.tabId)
      }

      if (message?.type === "ASH_SYNC_RULES") {
        return syncRules().then(() => ({ ok: true }))
      }

      if (message?.type === "ASH_SCRIPT_EVENT" && isExecutionEvent(message.payload)) {
        return recordRuleExecution(
          message.payload.ruleId,
          message.payload.status,
          message.payload.executedAt,
          message.payload.error
        ).then(() => ({ ok: true }))
      }

      return false
    })

    chrome.action.onClicked.addListener(async (tab) => {
      if (tab.id) {
        await chrome.sidePanel.open({
          tabId: tab.id
        })
      }
    })

    chrome.tabs.onRemoved.addListener((tabId) => {
      contentReadyByTab.delete(tabId)
      removeTabConversation(tabId)
    })

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "loading" || changeInfo.url) {
        contentReadyByTab.delete(tabId)
      }
    })

    void initialize()
  }
})
