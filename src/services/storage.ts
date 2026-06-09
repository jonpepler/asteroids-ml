import { get as idbGet, set as idbSet } from 'idb-keyval'
import { getDefault } from './defaults'

export const get = async (key: string): Promise<unknown> =>
  (await idbGet(key)) || getDefault(key) || ''

export const set = async (key: string, value: unknown): Promise<void> => {
  try {
    await idbSet(key, value)
  } catch (error) {
    // A failed write (e.g. quota exceeded) must not crash the training loop,
    // but it should be visible rather than silently swallowed.
    console.error(`Failed to persist "${key}" to IndexedDB`, error)
  }
}
