import { GameInstance } from '../../components/asteroids/game'
import type { GameSize } from '../../components/asteroids/util/geometry'
import { Genome, type GenomeJSON, Rng } from '../../lib/neat'
import type { KeyMap } from '../defaults'
import { mapOutputToKeys } from './controls'

export interface EvalRequest {
  genomes: GenomeJSON[]
  targetSize: GameSize
  keyMap: KeyMap
  // Per-generation seed: every genome this generation is scored on the same
  // asteroid layout, so fitness is comparable rather than partly luck.
  seed: number
}

export interface EvalResponse {
  scores: number[]
  error?: string
}

// Evaluate a batch of genomes headlessly and return their fitness. Runs off the
// main thread so several batches evaluate in parallel while the UI stays smooth.
const evaluate = ({ genomes, targetSize, keyMap, seed }: EvalRequest): number[] =>
  genomes.map((json) => {
    const network = Genome.fromJSON(json)
    // Fresh generator per genome from the shared seed, so each one starts from
    // the identical asteroid layout.
    const rng = new Rng(seed)
    let fitness = 0
    const game = new GameInstance({
      targetSize,
      keyMap,
      training: true,
      random: () => rng.next(),
      onScore: (amount) => {
        fitness += amount
      }
    })
    while (game.status === 'running') {
      const input = game.generateBrainInput()
      game.step(mapOutputToKeys(network.activate(input), keyMap))
    }
    return fitness
  })

const ctx = self as unknown as Worker
ctx.onmessage = (event: MessageEvent<EvalRequest>) => {
  // Report failures back to the pool instead of throwing into the void, which
  // would leave the awaiting generation hanging forever with no clue why.
  try {
    ctx.postMessage({ scores: evaluate(event.data) } satisfies EvalResponse)
  } catch (error) {
    ctx.postMessage({ scores: [], error: String(error) } satisfies EvalResponse)
  }
}
