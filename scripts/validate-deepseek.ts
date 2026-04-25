import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import vm from "node:vm"
import { parseHTML } from "linkedom"
import { buildAnalyzeMessages, buildScriptMessages, validateGeneratedRule } from "../src/app/prompts"
import { generateJsonCompletion, generateTextCompletion, testDeepSeekConnection } from "../src/app/deepseek"
import type { AISettings, PageContextPayload } from "../src/app/types"

const apiKey = process.env.DEEPSEEK_API_KEY

if (!apiKey) {
  throw new Error("Missing DEEPSEEK_API_KEY")
}

const main = async () => {
  const html = await fs.readFile(path.resolve("validation-page.html"), "utf8")
  const { window, document } = parseHTML(html)
  const location = {
    href: "http://127.0.0.1:4173/validation-page.html",
    hash: ""
  }

  Object.assign(globalThis, {
    window,
    document,
    location,
    HTMLElement: window.HTMLElement,
    CustomEvent: window.CustomEvent,
    getComputedStyle: window.getComputedStyle,
    CSS: {
      escape(value: string) {
        return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&")
      }
    }
  })

  Object.defineProperty(window, "location", {
    value: location,
    configurable: true
  })
  document.title = "AI Sidebar Hand Validation Page"

  const pageContext: PageContextPayload = {
    title: document.title,
    url: location.href,
    selection: "",
    domSummary: "2 major sections, 0 forms, 0 tables, 0 images, 1 clickable controls",
    headings: Array.from(document.querySelectorAll("h1, h2")).map((node) => ({
      level: Number(node.tagName.replace("H", "")),
      text: node.textContent?.trim() || ""
    })),
    buttons: [],
    links: Array.from(document.querySelectorAll("a[href]")).map((node) => ({
      text: node.textContent?.trim() || "",
      href: (node as HTMLAnchorElement).href
    })),
    forms: [],
    mainText: document.body.textContent?.replace(/\s+/g, " ").trim() || ""
  }

  const settings: AISettings = {
    apiKey,
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    temperature: 0.2,
    maxTokens: 1800,
    defaultScope: "path",
    searchEnabled: false,
    searchProvider: "duckduckgo",
    promptTemplates: [],
    siteProfiles: []
  }

  const connection = await testDeepSeekConnection(settings)
  assert.ok(connection.toLowerCase().includes("connection-ok"))

  const analysis = await generateTextCompletion(
    settings,
    buildAnalyzeMessages({
      prompt: "总结这个页面的用途，并指出明显的干扰区域。",
      pageContext,
      history: [],
      searchContext: null,
      siteInstruction: ""
    })
  )

  assert.ok(analysis.length > 20)

  const generated = validateGeneratedRule(
    await generateJsonCompletion(
      settings,
      buildScriptMessages({
        prompt:
          "隐藏右侧推广卡片 #promo-card，并在主标题 h1 后面插入一个 data-ai-sidebar-hand 摘要卡片，卡片正文必须包含“已验证自动执行”。",
        scope: "path",
        pageContext,
        history: [],
        searchContext: null,
        siteInstruction: ""
      })
    )
  )

  assert.ok(generated.code.includes("promo-card") || generated.code.includes("data-ai-sidebar-hand"))

  const context = vm.createContext({
    window,
    document,
    location,
    console,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    CustomEvent: window.CustomEvent,
    getComputedStyle: window.getComputedStyle,
    setTimeout,
    clearTimeout
  })

  vm.runInContext(generated.code, context)

  const promo = document.querySelector("#promo-card") as HTMLElement | null
  const summary = document.querySelector("[data-ai-sidebar-hand]") as HTMLElement | null

  const promoHidden =
    promo === null ||
    promo.hidden ||
    promo.style.display === "none" ||
    window.getComputedStyle(promo).display === "none"

  assert.ok(promoHidden, "Expected promo card to be hidden or removed")
  assert.ok(summary?.textContent?.includes("已验证自动执行"), "Expected generated summary card")

  console.log(
    JSON.stringify(
      {
        connection,
        analysisPreview: analysis.slice(0, 120),
        generatedRuleName: generated.name,
        runAt: generated.runAt,
        world: generated.world,
        summaryPreview: generated.summary
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
