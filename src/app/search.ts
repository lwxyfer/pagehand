import type { SearchContext } from "./types"

interface DuckDuckGoTopic {
  Text?: string
  FirstURL?: string
  Topics?: DuckDuckGoTopic[]
}

interface DuckDuckGoResponse {
  AbstractText?: string
  AbstractURL?: string
  RelatedTopics?: DuckDuckGoTopic[]
}

const flattenTopics = (topics: DuckDuckGoTopic[] = []): DuckDuckGoTopic[] => {
  return topics.flatMap((topic) => (topic.Topics ? flattenTopics(topic.Topics) : [topic]))
}

export const searchDuckDuckGo = async (query: string): Promise<SearchContext> => {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as DuckDuckGoResponse
  const related = flattenTopics(payload.RelatedTopics)
  const results = []

  if (payload.AbstractText) {
    results.push({
      title: "DuckDuckGo Instant Answer",
      url: payload.AbstractURL || "https://duckduckgo.com",
      snippet: payload.AbstractText
    })
  }

  for (const topic of related.slice(0, 4)) {
    if (!topic.Text || !topic.FirstURL) {
      continue
    }
    results.push({
      title: topic.Text.slice(0, 80),
      url: topic.FirstURL,
      snippet: topic.Text
    })
  }

  return {
    provider: "duckduckgo",
    query,
    results
  }
}

