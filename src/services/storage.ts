import { get as idbGet, set as idbSet } from 'idb-keyval'
import { getDefault } from './defaults'

export const get = async (key: string): Promise<unknown> =>
  (await idbGet(key)) || getDefault(key) || ''

export const set = (key: string, value: unknown) => idbSet(key, value)
