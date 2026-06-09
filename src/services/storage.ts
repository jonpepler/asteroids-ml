import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import { getDefault } from './defaults'

export const get = async (key: string): Promise<unknown> =>
  (await idbGet(key)) || getDefault(key) || ''

// Raw read with no default fallback, so callers can tell "absent" (undefined)
// apart from a stored empty value. Used by the data management screen.
export const getRaw = async (key: string): Promise<unknown> => idbGet(key)

export const del = async (key: string): Promise<void> => {
  try {
    await idbDel(key)
  } catch (error) {
    // Mirror set(): a failed delete should be visible, not silently swallowed.
    console.error(`Failed to delete "${key}" from IndexedDB`, error)
  }
}

export const set = async (key: string, value: unknown): Promise<void> => {
  try {
    await idbSet(key, value)
  } catch (error) {
    // A failed write (e.g. quota exceeded) must not crash the training loop,
    // but it should be visible rather than silently swallowed.
    console.error(`Failed to persist "${key}" to IndexedDB`, error)
  }
}
