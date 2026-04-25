import { useCallback, useEffect, useState } from "react"
import type { Locale } from "./translations"
import { translate, setLocale as setGlobalLocale, getLocale } from "./translations"

export function useTranslation(settingsLocale?: Locale) {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    if (settingsLocale && settingsLocale !== getLocale()) {
      setGlobalLocale(settingsLocale)
      forceUpdate((n) => n + 1)
    }
  }, [settingsLocale])

  const locale = settingsLocale ?? getLocale()

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, params, locale),
    [locale]
  )

  return { t, locale }
}
