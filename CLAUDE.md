# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start WXT dev server (hot-reload for Chrome extension)
npm run build    # Production build via WXT
npm run zip      # Build + create distributable zip
npm run compile  # Type-check only: tsc --noEmit
npm run validate # (manual) tsx scripts/validate-deepseek.ts — end-to-end test with real API key via DEEPSEEK_API_KEY
```

- Requires Node 20+, Chrome 135+ (MV3 `minimum_chrome_version`)
- Single test: `npx tsx path/to/test.ts`
- Chrome extension must be loaded from `build/` dir as unpacked extension with "Allow User Scripts" enabled

## Architecture

**Chrome MV3 extension** built with [WXT](https://wxt.dev) + React 18 + TypeScript (with `any` use allowed for API response shapes). Tailwind JIT for styles (dark mode via `.dark` class).

### Entry points (`src/app-entries/`)

- **`background.ts`** — Service worker: receives all messages from content scripts and UI, orchestrates logic (page context, AI calls, rule CRUD, script execution). Single `chrome.runtime.onMessage` dispatcher.
- **`page-bridge.content.ts`** — Content script injected into every page at `document_start`. Patches `history.pushState`/`replaceState` for SPA route detection, listens for `popstate`/`hashchange`, responds to `ASH_PING_PAGE_BRIDGE` and `ASH_GET_PAGE_CONTEXT` messages, forwards `ASH_SCRIPT_EVENT` from userScript execution back to background.
- **`sidepanel/main.tsx`** — React mount point for side panel UI.
- **`options/main.tsx`** — React mount point for options/settings page.

### Core modules (`src/app/`)

- **`deepseek.ts`** — OpenAI-compatible `/chat/completions` client. Three exports: `testDeepSeekConnection`, `generateTextCompletion`, `generateJsonCompletion`. All take `AISettings` + messages array.
- **`prompts.ts`** — Prompt builders: `buildAnalyzeMessages` (page Q&A), `buildScriptMessages` (script generation with JSON output constraint), `validateGeneratedRule` (parses model JSON response into `GeneratedRulePayload`).
- **`page-context.ts`** — Runs in content script context via `extractPageContext()`. Extracts title, URL, selection, headings, buttons, links, forms, domSummary, mainText from DOM.
- **`runtime.ts`** — `chrome.userScripts` wrapper: `syncRegisteredUserScripts` (bulk register/unregister), `executeRuleNow` (one-shot injection), script wrap code with event emission. Also provides `isSensitiveHost` and `isExecutionEvent`.
- **`storage.ts`** — `chrome.storage.local` CRUD for settings and rules. Functions: `getSettings`, `saveSettings`, `getRules`, `saveRules`, `upsertRule`, `addRule`, `updateRule`, `deleteRule`, `getRule`, `getRulesForUrl`, `recordRuleExecution`.
- **`url.ts`** — URL utilities: `stripHash`, `safeUrl`, `getHostname`, `getUnsupportedPageReason`, `buildScopeTarget`, `matchesRuleForUrl`.
- **`search.ts`** — DuckDuckGo Instant Answer API client.
- **`theme.ts`** — `useThemeMode` React hook for light/dark/auto theming via CSS custom properties on `[data-theme]`.
- **`types.ts`** — All TypeScript types/interfaces.
- **`constants.ts`** — Storage keys, default settings, default prompt templates, sensitive host patterns.

### Data flow

```
User types prompt → sidepanel App.tsx → chrome.runtime.sendMessage("ASH_RUN_PROMPT")
  → background.ts handler → getPageContext(tabId) → pings page-bridge content script
  → calls generateJsonCompletion / generateTextCompletion with built prompts
  → returns GenerateResponse to sidepanel

Script execution: user clicks "执行" → ASH_EXECUTE_DRAFT → background creates PageScriptRule
  → saves to storage → syncs chrome.userScripts → executeRuleNow injects wrapped script
```

### Rule system

- `PageScriptRule` stored in `chrome.storage.local` under `pagehand:rules`
- Scope types: `exact` (single URL), `path` (URL path), `domain` (entire host)
- Scripts registered via `chrome.userScripts.register()` for auto-replay
- SPA route changes: page-bridge detects `pushState`/`popstate` → sends `ASH_ROUTE_CHANGED` → background re-runs matching rules via `runMatchingRulesForRoute`
- CSS selector priority for DOM hints: `#id` > `[data-testid]` > `.class` > tagName

### Message protocol (ASH_* prefix)

Background listens for ~15 message types. Key ones:
- `ASH_GET_ACTIVE_TAB_STATE` — panel refresh
- `ASH_RUN_PROMPT` — main AI invocation
- `ASH_EXECUTE_DRAFT` — persist + inject generated script
- `ASH_TOGGLE_RULE` / `ASH_DELETE_RULE` / `ASH_EXECUTE_RULE` — rule management
- `ASH_CONTENT_READY` / `ASH_ROUTE_CHANGED` — SPA lifecycle
- `ASH_SCRIPT_EVENT` — execution result forwarded from userScript
