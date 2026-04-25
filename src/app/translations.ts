export type Locale = "zh" | "en"

type TranslationValue = string | ((params: Record<string, string | number>) => string)

const INTERPOLATE = /\{(\w+)\}/g

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(INTERPOLATE, (_, key) => String(params[key] ?? `{${key}}`))
}

const translations: Record<string, { zh: string; en: string }> = {
  // -- sidepanel: header
  "sidepanel.refresh": { zh: "刷新当前页面上下文", en: "Refresh page context" },
  "sidepanel.settings": { zh: "打开设置", en: "Open settings" },
  "sidepanel.theme.light": { zh: "浅色主题", en: "Light theme" },
  "sidepanel.theme.dark": { zh: "深色主题", en: "Dark theme" },
  "sidepanel.theme.auto": { zh: "跟随系统", en: "System theme" },
  "sidepanel.locale": { zh: "切换至 English", en: "切换至 中文" },
  "sidepanel.currentTab": { zh: "Current tab", en: "Current tab" },

  // -- sidepanel: banners
  "sidepanel.banner.userScripts": {
    zh: "还没有开启 Allow User Scripts。脚本生成和自动执行依赖这个开关。",
    en: "Allow User Scripts is not enabled. Script generation and auto-execution require this."
  },
  "sidepanel.banner.apiKey": {
    zh: "还没有配置模型连接。先去设置页填写 API Key。",
    en: "No model connection configured. Go to settings to enter your API Key."
  },
  "sidepanel.banner.connecting": {
    zh: "正在连接当前页面上下文...",
    en: "Connecting to page context..."
  },

  // -- sidepanel: active rules
  "sidepanel.rules.title": { zh: "当前页脚本", en: "Page scripts" },
  "sidepanel.rules.active": { zh: "生效", en: "Active" },
  "sidepanel.rules.disabled": { zh: "已停用", en: "Disabled" },
  "sidepanel.rules.hitCount": { zh: "命中 {n} 次", en: "Hit {n} times" },
  "sidepanel.rules.enableAndRun": { zh: "启用并执行", en: "Enable & run" },
  "sidepanel.rules.runNow": { zh: "立即执行", en: "Run now" },
  "sidepanel.rules.disable": { zh: "禁用", en: "Disable" },
  "sidepanel.rules.enable": { zh: "启用", en: "Enable" },

  // -- sidepanel: quick actions
  "sidepanel.qa1.label": { zh: "总结当前页面", en: "Summarize this page" },
  "sidepanel.qa1.prompt": {
    zh: "请总结当前页面的核心内容，输出重点摘要。",
    en: "Summarize the core content of this page with key points."
  },
  "sidepanel.qa2.label": { zh: "提取关键信息", en: "Extract key info" },
  "sidepanel.qa2.prompt": {
    zh: "请提取当前页面最重要的事实、数据和结论，并按要点列出。",
    en: "Extract the most important facts, data, and conclusions from this page."
  },
  "sidepanel.qa3.label": { zh: "识别下一步动作", en: "Identify next steps" },
  "sidepanel.qa3.prompt": {
    zh: "请识别当前页面里最值得执行的下一步操作，并说明原因。",
    en: "Identify the most valuable next action on this page and explain why."
  },
  "sidepanel.qa4.label": { zh: "生成页面优化脚本", en: "Generate optimization script" },
  "sidepanel.qa4.prompt": {
    zh: "请为当前页面生成一个优化阅读体验的脚本，移除干扰区域并突出正文。",
    en: "Generate a script to optimize reading experience: remove distractions and highlight content."
  },

  // -- sidepanel: empty stage
  "sidepanel.empty.scriptMode": { zh: "脚本模式已开启", en: "Script mode is on" },
  "sidepanel.empty.assistant": { zh: "当前页智能助手", en: "Page assistant" },

  // -- sidepanel: messages
  "sidepanel.msg.you": { zh: "You", en: "You" },
  "sidepanel.msg.assistant": { zh: "Assistant", en: "Assistant" },
  "sidepanel.msg.thinking": { zh: "Assistant is thinking", en: "Assistant is thinking" },
  "sidepanel.msg.executed": {
    zh: "脚本已执行，并已缓存为页面规则。下次进入匹配页面会自动执行。",
    en: "Script executed and saved as a page rule. It will auto-run on matching pages."
  },
  "sidepanel.msg.execute": { zh: "执行", en: "Execute" },
  "sidepanel.msg.executing": { zh: "执行中...", en: "Executing..." },

  // -- sidepanel: composer
  "sidepanel.composer.placeholder.chat": {
    zh: "发消息给当前页助手",
    en: "Message the page assistant"
  },
  "sidepanel.composer.placeholder.script": {
    zh: "描述你希望页面如何被修改",
    en: "Describe how you want the page modified"
  },
  "sidepanel.composer.more": { zh: "更多操作", en: "More" },
  "sidepanel.composer.close": { zh: "关闭更多操作", en: "Close" },
  "sidepanel.composer.library": { zh: "Library", en: "Library" },
  "sidepanel.composer.noTemplates": { zh: "还没有模板", en: "No templates yet" },
  "sidepanel.composer.searchOn": { zh: "开启搜索", en: "Search on" },
  "sidepanel.composer.searchOff": { zh: "关闭搜索", en: "Search off" },
  "sidepanel.composer.scriptOn": { zh: "开启脚本模式", en: "Script mode on" },
  "sidepanel.composer.scriptOff": { zh: "关闭脚本模式", en: "Script mode off" },
  "sidepanel.composer.send": { zh: "发送", en: "Send" },
  "sidepanel.composer.sending": { zh: "发送中", en: "Sending..." },

  // -- options: header
  "options.loading": { zh: "加载中...", en: "Loading..." },
  "options.eyebrow": { zh: "Settings", en: "Settings" },
  "options.title": { zh: "PageHand 设置", en: "PageHand Settings" },
  "options.subtitle": {
    zh: "这里维护模型连接、默认持久化策略、模板库和站点级指令。首次使用前，也请在 Chrome 扩展详情页打开 \"Allow User Scripts\"。",
    en: "Manage model connection, default scope, prompt library, and site-level instructions. Before first use, enable \"Allow User Scripts\" in the extension details page."
  },
  "options.reload": { zh: "重新读取", en: "Reload" },
  "options.saved": { zh: "设置已保存。", en: "Settings saved." },
  "options.testSuccess": { zh: "连接测试成功：{reply}", en: "Connection test passed: {reply}" },

  // -- options: form
  "options.apiKey": { zh: "API Key", en: "API Key" },
  "options.baseUrl": { zh: "Base URL", en: "Base URL" },
  "options.model": { zh: "Model", en: "Model" },
  "options.theme": { zh: "主题", en: "Theme" },
  "options.scope": { zh: "默认持久化范围", en: "Default scope" },
  "options.temperature": { zh: "Temperature", en: "Temperature" },
  "options.maxTokens": { zh: "Max Tokens", en: "Max Tokens" },
  "options.searchToggle": { zh: "联网搜索", en: "Web search" },
  "options.searchDesc": {
    zh: "使用 DuckDuckGo Instant Answer 作为额外上下文源",
    en: "Use DuckDuckGo Instant Answer as additional context"
  },
  "options.save": { zh: "保存设置", en: "Save settings" },
  "options.saving": { zh: "保存中...", en: "Saving..." },
  "options.test": { zh: "测试模型连接", en: "Test connection" },
  "options.testing": { zh: "测试中...", en: "Testing..." },
  "options.tab.basic": { zh: "基本设置", en: "General" },
  "options.tab.templates": { zh: "模板", en: "Templates" },
  "options.tab.sites": { zh: "站点", en: "Sites" },
  "options.tab.rules": { zh: "规则", en: "Rules" },
  "options.section.model": { zh: "模型设置", en: "Model" },
  "options.section.behavior": { zh: "默认行为", en: "Behavior" },
  "options.locale": { zh: "界面语言", en: "Language" },

  // -- options: templates
  "options.templates.eyebrow": { zh: "Templates", en: "Templates" },
  "options.templates.title": { zh: "Prompt Library", en: "Prompt Library" },
  "options.templates.subtitle": {
    zh: "这些模板会出现在侧边栏下拉菜单里，用来快速填充常见改造指令。",
    en: "These templates appear in the side panel menu for quick access to common instructions."
  },
  "options.templates.add": { zh: "新增模板", en: "Add template" },
  "options.templates.name": { zh: "名称", en: "Name" },
  "options.templates.prompt": { zh: "提示词", en: "Prompt" },
  "options.templates.delete": { zh: "删除", en: "Delete" },

  // -- options: sites
  "options.sites.eyebrow": { zh: "Sites", en: "Sites" },
  "options.sites.title": { zh: "站点指令", en: "Site Instructions" },
  "options.sites.subtitle": {
    zh: "为特定域名追加长期指令，生成或分析时会自动带上。",
    en: "Add persistent instructions for specific hostnames. They are included automatically during generation and analysis."
  },
  "options.sites.add": { zh: "新增站点指令", en: "Add site instruction" },
  "options.sites.empty": { zh: "还没有站点级额外指令。", en: "No site-level instructions yet." },
  "options.sites.hostname": { zh: "Hostname", en: "Hostname" },
  "options.sites.instruction": { zh: "附加指令", en: "Instruction" },
  "options.sites.enable": { zh: "启用", en: "Enable" },
  "options.sites.delete": { zh: "删除", en: "Delete" },

  // -- options: rules
  "options.rules.eyebrow": { zh: "Rules", en: "Rules" },
  "options.rules.title": { zh: "全局规则概览", en: "All Rules" },
  "options.rules.empty": { zh: "还没有缓存脚本。", en: "No cached scripts yet." },
  "options.rules.hitCount": { zh: "命中 {n} 次", en: "Hit {n} times" },
  "options.rules.updated": { zh: "更新时间 {date}", en: "Updated {date}" },
  "options.rules.enable": { zh: "启用", en: "Enable" },
  "options.rules.delete": { zh: "删除", en: "Delete" },

  // -- common (used across components)
  "common.auto": { zh: "auto", en: "auto" },
  "common.light": { zh: "light", en: "light" },
  "common.dark": { zh: "dark", en: "dark" },
  "common.exact": { zh: "exact", en: "exact" },
  "common.path": { zh: "path", en: "path" },
  "common.domain": { zh: "domain", en: "domain" },
  "common.chat": { zh: "Chat", en: "Chat" },
  "common.script": { zh: "Script", en: "Script" },
}

let currentLocale: Locale = "zh"

export function getLocale(): Locale {
  return currentLocale
}

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function translate(
  key: string,
  params?: Record<string, string | number>,
  locale?: Locale
): string {
  const entry = (translations as Record<string, Record<string, string>>)[key]
  if (!entry) return key
  const resolvedLocale = locale ?? currentLocale
  const template = entry[resolvedLocale]
  if (template === undefined) return key
  return interpolate(template, params)
}

export { t as default }

const t = translate
