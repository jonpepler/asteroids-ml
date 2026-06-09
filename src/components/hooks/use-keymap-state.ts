import { useEffect } from 'react'
import { type KeyMap, getDefault } from '../../services/defaults'
import { useStateWithLocalStorage } from './use-state-with-storage'

/*
  Special case for keyMap as we need to update user stored settings with any new keys that get added
*/
export const useKeyMapState = () => {
  const keyMapKey = 'keyMap'
  const [keyMap, setKeyMap] = useStateWithLocalStorage<KeyMap>(keyMapKey)
  const defaultKeyMap = getDefault(keyMapKey)

  // if a new key has been added
  useEffect(() => {
    for (const defaultKey in defaultKeyMap) {
      const key = defaultKey as keyof KeyMap
      if (keyMap[key] === undefined) {
        setKeyMap({ ...keyMap, [key]: defaultKeyMap[key] })
      }
    }
  }, [keyMap, defaultKeyMap, setKeyMap])

  // if a key is removed from defaults
  useEffect(() => {
    for (const customKey in keyMap) {
      if (defaultKeyMap[customKey as keyof KeyMap] === undefined) {
        const newKeyMap: Record<string, number> = { ...keyMap }
        delete newKeyMap[customKey]
        setKeyMap(newKeyMap as unknown as KeyMap)
      }
    }
  }, [keyMap, defaultKeyMap, setKeyMap])

  // TODO if keys are conflicting

  return [keyMap, setKeyMap] as const
}
