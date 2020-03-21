import { useState, useEffect } from 'react'
import { get, set } from '../../services/storage'
import { getDefault } from '../../services/defaults'

export const useStateWithLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(initialValue || getDefault(key) || '')

  // get stored data on first load
  useEffect(() => {
    const getData = async () => {
      const newValue = await get(key)
      setValue(newValue)
    }
    getData()
  }, [key])

  // update the store when the value changes
  useEffect(() => {
    const setData = async () => await set(key, value)
    setData()
  }, [key, value])

  return [value, setValue]
}
