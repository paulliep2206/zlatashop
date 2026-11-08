'use client'

import React, { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

import type { Theme, ThemeContextType } from './types'

import { getImplicitPreference, themeLocalStorageKey } from './shared'
import { themeIsValid } from './types'

// The <html data-theme> attribute (set before hydration by InitTheme) is the source of truth.
const subscribeToThemeAttribute = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

const getThemeAttribute = (): Theme | undefined => {
  const theme = document.documentElement.getAttribute('data-theme')
  return themeIsValid(theme) ? theme : undefined
}

const getServerTheme = (): Theme | undefined => undefined

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
}

const ThemeContext = createContext(initialContext)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useSyncExternalStore(subscribeToThemeAttribute, getThemeAttribute, getServerTheme)

  const setTheme = useCallback((themeToSet: Theme | null) => {
    if (themeToSet === null) {
      window.localStorage.removeItem(themeLocalStorageKey)
      const implicitPreference = getImplicitPreference()
      document.documentElement.setAttribute('data-theme', implicitPreference || '')
    } else {
      window.localStorage.setItem(themeLocalStorageKey, themeToSet)
      document.documentElement.setAttribute('data-theme', themeToSet)
    }
  }, [])

  return <ThemeContext.Provider value={{ setTheme, theme }}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextType => useContext(ThemeContext)
