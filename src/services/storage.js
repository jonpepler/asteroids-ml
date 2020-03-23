import { set as idbSet, get as idbGet } from 'idb-keyval'
import { getDefault } from './defaults'

export const get = async key => await idbGet(key) || getDefault(key) || ''
export const set = async (key, value) => idbSet(key, value)
