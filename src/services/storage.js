import { getDefault } from './defaults'

export const get = key => localStorage.getItem(key) || getDefault(key) || ''
export const set = (key, value) => localStorage.setItem(key, value)