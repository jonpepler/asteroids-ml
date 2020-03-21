import { useState, useEffect } from 'react'
import { get, set } from '../../services/storage'

export const useStateWithLocalStorage = key => {
  const [value, setValue] = useState(get(key))

  useEffect(() => set(key, value), [key, value])
  return [value, setValue]
}
