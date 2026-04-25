import type { PageScriptRule, ScriptScope } from "./types"

export const stripHash = (url: string) => {
  try {
    const parsed = new URL(url)
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return url
  }
}

export const safeUrl = (value: string) => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export const getHostname = (value: string) => {
  return safeUrl(value)?.hostname ?? ""
}

export const getUnsupportedPageReason = (value: string) => {
  const parsed = safeUrl(value)

  if (!parsed) {
    return "当前页面 URL 无效，暂时无法读取页面内容。"
  }

  if (parsed.protocol === "chrome:" || parsed.protocol === "edge:") {
    return "Chrome 内置页面不允许扩展注入内容脚本，请切换到普通网页后再使用。"
  }

  if (parsed.protocol === "chrome-extension:" || parsed.protocol === "moz-extension:") {
    return "扩展页面不支持读取当前页面上下文，请切换到普通网页后再使用。"
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:" &&
    parsed.protocol !== "file:"
  ) {
    return `当前页面协议 ${parsed.protocol} 暂不支持。`
  }

  return ""
}

const normalizePath = (pathname: string) => {
  if (!pathname) {
    return "/"
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`
}

export const buildPathKey = (pageUrl: string) => {
  const parsed = safeUrl(pageUrl)
  if (!parsed) {
    return ""
  }

  return `${parsed.protocol}//${parsed.host}${normalizePath(parsed.pathname)}`
}

export const buildScopeTarget = (pageUrl: string, scope: ScriptScope) => {
  const parsed = safeUrl(pageUrl)

  if (!parsed) {
    throw new Error("Invalid page URL")
  }

  const basePathPattern = buildPathKey(pageUrl)

  if (parsed.protocol === "file:") {
    const targetKey =
      scope === "domain" ? "file://*" : scope === "path" ? basePathPattern : stripHash(parsed.href)

    return {
      matches: ["file://*/*"],
      matchPattern: "file://*/*",
      targetKey,
      exactUrl: scope === "exact" ? stripHash(parsed.href) : undefined
    }
  }

  if (scope === "domain") {
    const matchPattern = `${parsed.protocol}//${parsed.host}/*`
    return {
      matches: [matchPattern],
      matchPattern,
      targetKey: `${parsed.protocol}//${parsed.host}`
    }
  }

  return {
    matches: [basePathPattern],
    matchPattern: basePathPattern,
    targetKey: scope === "path" ? basePathPattern : stripHash(parsed.href),
    exactUrl: scope === "exact" ? stripHash(parsed.href) : undefined
  }
}

export const matchesRuleForUrl = (rule: PageScriptRule, pageUrl: string) => {
  const parsed = safeUrl(pageUrl)
  if (!parsed) {
    return false
  }

  if (rule.scope === "exact") {
    return stripHash(pageUrl) === rule.exactUrl
  }

  if (rule.scope === "path") {
    return buildPathKey(pageUrl) === rule.targetKey
  }

  if (parsed.protocol === "file:") {
    return true
  }

  return `${parsed.protocol}//${parsed.host}` === rule.targetKey
}
