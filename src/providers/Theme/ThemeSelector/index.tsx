'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import React, { useState, useSyncExternalStore } from 'react'

import type { Theme } from '../types'

import { useTheme } from '..'
import { themeLocalStorageKey } from '../shared'

const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}
const getStoredPreference = () => window.localStorage.getItem(themeLocalStorageKey) ?? 'auto'
const getServerPreference = () => ''

export const ThemeSelector: React.FC = () => {
  const { setTheme } = useTheme()
  const storedPreference = useSyncExternalStore(
    subscribeToStorage,
    getStoredPreference,
    getServerPreference,
  )
  // The user's pick in this tab wins until reload; otherwise show what is stored.
  const [selected, setValue] = useState<string | null>(null)
  const value = selected ?? storedPreference

  const onThemeChange = (themeToSet: Theme & 'auto') => {
    if (themeToSet === 'auto') {
      setTheme(null)
      setValue('auto')
    } else {
      setTheme(themeToSet)
      setValue(themeToSet)
    }
  }

  return (
    <Select onValueChange={onThemeChange} value={value}>
      <SelectTrigger className="w-auto bg-transparent gap-2 md:pl-3 border-none">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto</SelectItem>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  )
}
