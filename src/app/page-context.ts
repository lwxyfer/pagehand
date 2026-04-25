import type { PageContextPayload } from "./types"

const takeText = (value: string | null | undefined, max = 220) => {
  if (!value) {
    return ""
  }
  const text = value.replace(/\s+/g, " ").trim()
  return text.slice(0, max)
}

const toSelectorHint = (element: Element) => {
  const htmlElement = element as HTMLElement
  if (htmlElement.id) {
    return `#${CSS.escape(htmlElement.id)}`
  }
  const testId = htmlElement.getAttribute("data-testid")
  if (testId) {
    return `[data-testid="${testId}"]`
  }
  if (htmlElement.classList.length > 0) {
    const className = Array.from(htmlElement.classList).slice(0, 2).join(".")
    return `${htmlElement.tagName.toLowerCase()}.${className}`
  }
  return htmlElement.tagName.toLowerCase()
}

const extractMainText = () => {
  if (!document.body) {
    return ""
  }
  const clone = document.body.cloneNode(true) as HTMLElement
  clone.querySelectorAll("script, style, noscript, iframe, svg").forEach((node) => node.remove())
  return takeText(clone.innerText, 8000)
}

export const extractPageContext = (): PageContextPayload => {
  const selection = window.getSelection()?.toString().trim() ?? ""
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .slice(0, 18)
    .map((node) => ({
      level: Number(node.tagName.replace("H", "")),
      text: takeText(node.textContent)
    }))
    .filter((item) => item.text)

  const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"))
    .slice(0, 18)
    .map((node) => ({
      text: takeText((node as HTMLElement).innerText || (node as HTMLInputElement).value || node.getAttribute("aria-label")),
      selectorHint: toSelectorHint(node)
    }))
    .filter((item) => item.text)

  const links = Array.from(document.querySelectorAll("a[href]"))
    .slice(0, 18)
    .map((node) => ({
      text: takeText(node.textContent || node.getAttribute("aria-label")),
      href: (node as HTMLAnchorElement).href
    }))
    .filter((item) => item.href)

  const forms = Array.from(document.querySelectorAll("form"))
    .slice(0, 8)
    .map((form) => ({
      selectorHint: toSelectorHint(form),
      fields: Array.from(
        form.querySelectorAll("input, textarea, select")
      )
        .slice(0, 10)
        .map((field) =>
          takeText(
            field.getAttribute("name") ||
              field.getAttribute("placeholder") ||
              field.getAttribute("aria-label") ||
              field.id
          )
        )
        .filter(Boolean)
    }))

  const domSummary = [
    `${document.querySelectorAll("section, article, main").length} major sections`,
    `${document.querySelectorAll("form").length} forms`,
    `${document.querySelectorAll("table").length} tables`,
    `${document.querySelectorAll("img").length} images`,
    `${document.querySelectorAll("button, [role='button']").length} clickable controls`
  ].join(", ")

  return {
    title: document.title,
    url: location.href,
    selection: takeText(selection, 1500),
    mainText: extractMainText(),
    headings,
    buttons,
    links,
    forms,
    domSummary
  }
}
