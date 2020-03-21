import localStorageMemory from 'localstorage-memory'
import { getDefault } from './defaults'

// Used to handle lack of window object in Gatsby build
const windowGlobal = typeof window !== 'undefined' && window
const storage = windowGlobal ? windowGlobal.localStorage : localStorageMemory

export const get = key => storage.getItem(key) || getDefault(key) || ''
export const set = (key, value) => storage.setItem(key, value)
