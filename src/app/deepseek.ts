import type { AIChatMessage, AISettings } from "./types"

const buildEndpoint = (baseUrl: string) => {
  const trimmed = baseUrl.replace(/\/$/, "")
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`
}

const callDeepSeek = async ({
  settings,
  messages,
  jsonMode
}: {
  settings: AISettings
  messages: AIChatMessage[]
  jsonMode: boolean
}) => {
  if (!settings.apiKey.trim()) {
    throw new Error("Model API key is required.")
  }

  const response = await fetch(buildEndpoint(settings.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  })

  const text = await response.text()
  let payload: any

  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`Model provider returned a non-JSON response: ${text.slice(0, 280)}`)
  }

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.message ||
      `Model request failed with status ${response.status}`
    throw new Error(errorMessage)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (!content || typeof content !== "string") {
    throw new Error("Model provider returned an empty completion.")
  }

  return content
}

export const testDeepSeekConnection = async (settings: AISettings) => {
  const content = await callDeepSeek({
    settings,
    jsonMode: false,
    messages: [
      {
        role: "system",
        content: "Reply with a short acknowledgement."
      },
      {
        role: "user",
        content: "Return exactly: connection-ok"
      }
    ]
  })

  return content.trim()
}

export const generateTextCompletion = async (
  settings: AISettings,
  messages: AIChatMessage[]
) => {
  return callDeepSeek({
    settings,
    messages,
    jsonMode: false
  })
}

export const generateJsonCompletion = async (
  settings: AISettings,
  messages: AIChatMessage[]
) => {
  const content = await callDeepSeek({
    settings,
    messages,
    jsonMode: true
  })

  return JSON.parse(content)
}
