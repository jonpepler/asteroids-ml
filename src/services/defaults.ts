import type { GameSize } from '../components/asteroids/util/geometry'

export interface KeyMap {
  shoot: number
  rotateLeft: number
  boost: number
  rotateRight: number
}

export interface Defaults {
  circleColour: string
  targetSize: GameSize
  keyMap: KeyMap
}

const defaults: Defaults = {
  circleColour: '#000',
  targetSize: {
    w: 1680,
    h: 1050
  },
  keyMap: {
    shoot: 32,
    rotateLeft: 37,
    boost: 38,
    rotateRight: 39
  }
}

export function getDefault<K extends keyof Defaults>(key: K): Defaults[K]
export function getDefault(key: string): unknown
export function getDefault(key: string): unknown {
  return defaults[key as keyof Defaults]
}
