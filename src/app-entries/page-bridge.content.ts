import { defineContentScript } from "wxt/sandbox"
import { extractPageContext } from "../app/page-context"
import { SCRIPT_EVENT_NAME } from "../app/constants"
import { stripHash } from "../app/url"

export default defineContentScript({
  matches: ["http://*/*", "https://*/*", "file://*/*"],
  runAt: "document_start",
  main() {
    let lastRouteUrl = stripHash(location.href)

    const sendReady = (url = lastRouteUrl) => {
      if (!chrome.runtime?.id) {
        return
      }

      void chrome.runtime.sendMessage({
        type: "ASH_CONTENT_READY",
        url
      })
    }

    const notifyRouteChange = () => {
      const nextUrl = stripHash(location.href)
      if (nextUrl === lastRouteUrl) {
        return
      }

      lastRouteUrl = nextUrl

      sendReady(nextUrl)
      void chrome.runtime.sendMessage({
        type: "ASH_ROUTE_CHANGED",
        url: nextUrl
      })
    }

    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function (...args) {
      originalPushState.apply(history, args)
      queueMicrotask(notifyRouteChange)
    }

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args)
      queueMicrotask(notifyRouteChange)
    }

    window.addEventListener("popstate", notifyRouteChange)
    window.addEventListener("hashchange", notifyRouteChange)
    window.addEventListener("pageshow", () => sendReady(stripHash(location.href)))

    sendReady()

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "ASH_PING_PAGE_BRIDGE") {
        sendResponse({
          ok: true,
          url: stripHash(location.href)
        })
        return true
      }

      if (message?.type === "ASH_GET_PAGE_CONTEXT") {
        try {
          sendResponse({
            ok: true,
            context: extractPageContext()
          })
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        return true
      }

      return false
    })

    window.addEventListener(SCRIPT_EVENT_NAME, (event) => {
      const customEvent = event as CustomEvent
      void chrome.runtime.sendMessage({
        type: "ASH_SCRIPT_EVENT",
        payload: customEvent.detail
      })
    })
  }
})
