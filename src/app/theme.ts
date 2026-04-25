import { useEffect } from "react"
import type { ThemeMode } from "./types"

const getResolvedTheme = (mode: ThemeMode) => {
  if (mode !== "auto") {
    return mode
  }

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

const applyTheme = (mode: ThemeMode) => {
  const resolved = getResolvedTheme(mode)
  document.documentElement.dataset.themeMode = mode
  document.documentElement.dataset.theme = resolved
}

export const useThemeMode = (mode: ThemeMode) => {
  useEffect(() => {
    applyTheme(mode)

    if (mode !== "auto" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      applyTheme("auto")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [mode])
}
