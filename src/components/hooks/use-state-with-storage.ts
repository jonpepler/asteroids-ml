import { useEffect, useState } from 'react'
import { getDefault } from '../../services/defaults'
import { get, set } from '../../services/storage'

export const useStateWithLocalStorage = <T>(key: string, initialValue?: T) => {
  const [value, setValue] = useState<T>((initialValue || getDefault(key) || '') as T)

  // get stored data on first load
  useEffect(() => {
    const getData = async () => {
      setValue((await get(key)) as T)
    }
    getData()
  }, [key])

  // update the store when the value changes
  useEffect(() => {
    set(key, value)
  }, [key, value])

  return [value, setValue] as const
}
