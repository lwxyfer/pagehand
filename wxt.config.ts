import { defineConfig } from "wxt"
import react from "@vitejs/plugin-react"

export default defineConfig({
  manifestVersion: 3,
  imports: false,
  vite: () => ({
    plugins: [react()]
  }),
  srcDir: "src",
  entrypointsDir: "app-entries",
  outDir: "build",
  manifest: {
    minimum_chrome_version: "135",
    name: "PageHand",
    short_name: "PageHand",
    description:
      "Analyze the current page and persist AI-generated page scripts for automatic replay.",
    default_locale: "en",
    version: "0.1.0",
    action: {
      default_title: "Open PageHand"
    },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "64": "icon/64.png",
      "128": "icon/128.png"
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true
    },
    side_panel: {
      default_path: "sidepanel.html"
    },
    host_permissions: ["http://*/*", "https://*/*", "file://*/*"],
    permissions: [
      "storage",
      "sidePanel",
      "tabs",
      "activeTab",
      "scripting",
      "userScripts"
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';"
    }
  }
})
