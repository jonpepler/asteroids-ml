import { useStateWithLocalStorage } from './use-state-with-storage'
import { useEffect } from 'react'
import { getDefault } from '../../services/defaults'

/*
  Special case for keyMap as we need to update user stored settings with any new keys that get added
*/
export const useKeyMapState = () => {
  const keyMapKey = 'keyMap'
  const [keyMap, setKeyMap] = useStateWithLocalStorage(keyMapKey)
  const defaultKeyMap = getDefault(keyMapKey)

  // if a new key has been added
  useEffect(() => {
    for (const defaultKey in defaultKeyMap) {
      if (keyMap[defaultKey] === undefined) {
        setKeyMap({ ...keyMap, [defaultKey]: defaultKeyMap[defaultKey] })
      }
    }
  }, [keyMap, defaultKeyMap])

  // if a key is removed from defaults
  useEffect(() => {
    for (const customKey in keyMap) {
      if (defaultKeyMap[customKey] === undefined) {
        const newKeyMap = { ...keyMap }
        delete newKeyMap[customKey]
        setKeyMap(newKeyMap)
      }
    }
  }, [keyMap, defaultKeyMap])

  // TODO if keys are conflicting

  return [keyMap, setKeyMap]
}
