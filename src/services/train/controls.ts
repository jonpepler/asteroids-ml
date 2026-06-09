import type { KeyMap } from '../defaults'

// Convert a network's 4 raw outputs into the key codes the game understands.
// Order matches the output layer: [shoot, boost, rotateLeft, rotateRight].
export const mapOutputToKeys = (output: number[], keyMap: KeyMap): number[] => {
  const keys = [keyMap.shoot, keyMap.boost, keyMap.rotateLeft, keyMap.rotateRight]
  return output
    .map((o) => Math.round(o))
    .map((b) => Boolean(b))
    .map((pressed, i) => (pressed ? keys[i] : false))
    .filter((k): k is number => k !== false)
}
