import type {
  AIChatMessage,
  ConversationMessage,
  GeneratedRulePayload,
  PageContextPayload,
  ScriptScope,
  SearchContext,
  SitePromptProfile
} from "./types"

const serializePageContext = (context: PageContextPayload) => {
  return JSON.stringify(
    {
      title: context.title,
      url: context.url,
      selection: context.selection,
      domSummary: context.domSummary,
      headings: context.headings,
      buttons: context.buttons,
      links: context.links,
      forms: context.forms,
      mainText: context.mainText
    },
    null,
    2
  )
}

const serializeSearch = (context: SearchContext | null) => {
  if (!context || context.results.length === 0) {
    return "No external search context."
  }

  return JSON.stringify(context, null, 2)
}

const serializeHistory = (history: ConversationMessage[]) => {
  return history
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n")
}

export const findSiteInstruction = (
  hostname: string,
  profiles: SitePromptProfile[]
) => {
  return (
    profiles.find(
      (profile) => profile.enabled && profile.hostname.toLowerCase() === hostname.toLowerCase()
    )?.instruction ?? ""
  )
}

export const buildAnalyzeMessages = ({
  prompt,
  pageContext,
  history,
  searchContext,
  siteInstruction
}: {
  prompt: string
  pageContext: PageContextPayload
  history: ConversationMessage[]
  searchContext: SearchContext | null
  siteInstruction: string
}) => {
  const messages: AIChatMessage[] = [
    {
      role: "system",
      content:
        "You are AI Sidebar Hand, a current-page assistant. Answer using the current page context. Be concrete, concise, and mention when you infer from partial DOM context."
    },
    {
      role: "user",
      content: [
        siteInstruction ? `Site instruction:\n${siteInstruction}` : "",
        `Conversation history:\n${serializeHistory(history) || "No previous turns."}`,
        `Current page context:\n${serializePageContext(pageContext)}`,
        `External search context:\n${serializeSearch(searchContext)}`,
        `User request:\n${prompt}`
      ]
        .filter(Boolean)
        .join("\n\n")
    }
  ]
  return messages
}

export const buildScriptMessages = ({
  prompt,
  scope,
  pageContext,
  history,
  searchContext,
  siteInstruction
}: {
  prompt: string
  scope: ScriptScope
  pageContext: PageContextPayload
  history: ConversationMessage[]
  searchContext: SearchContext | null
  siteInstruction: string
}) => {
  const messages: AIChatMessage[] = [
    {
      role: "system",
      content: [
        "You are AI Sidebar Hand, an expert page-modification assistant.",
        "Return strict JSON only.",
        "The JSON shape must be:",
        '{"name":"string","scope":"exact|path|domain","world":"MAIN","runAt":"document_idle|document_end|document_start","summary":"string","code":"string"}',
        "Rules for the code field:",
        "- Output JavaScript only, no markdown fences.",
        "- The code must be idempotent. Re-running it should not duplicate inserted UI.",
        "- Prefer querying robust selectors and fail silently when a node is absent.",
        "- Do not fetch remote code, do not use eval, and do not navigate away.",
        "- If you insert nodes, tag them with data-ai-sidebar-hand.",
        "- Make the script self-contained for the current page only."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        siteInstruction ? `Site instruction:\n${siteInstruction}` : "",
        `Previous conversation:\n${serializeHistory(history) || "No previous turns."}`,
        `Target persistence scope: ${scope}`,
        `Current page context:\n${serializePageContext(pageContext)}`,
        `External search context:\n${serializeSearch(searchContext)}`,
        `User request:\n${prompt}`
      ]
        .filter(Boolean)
        .join("\n\n")
    }
  ]
  return messages
}

export const validateGeneratedRule = (payload: any): GeneratedRulePayload => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Model did not return a JSON object.")
  }

  if (!payload.name || !payload.summary || !payload.code) {
    throw new Error("Model response is missing name, summary, or code.")
  }

  return {
    name: String(payload.name),
    summary: String(payload.summary),
    scope: payload.scope === "exact" || payload.scope === "path" || payload.scope === "domain" ? payload.scope : "path",
    world: payload.world === "USER_SCRIPT" ? "USER_SCRIPT" : "MAIN",
    runAt:
      payload.runAt === "document_start" ||
      payload.runAt === "document_end" ||
      payload.runAt === "document_idle"
        ? payload.runAt
        : "document_idle",
    code: String(payload.code)
  }
}
