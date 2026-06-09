import { GameInstance } from '../../components/asteroids/game'
import type { GameSize } from '../../components/asteroids/util/geometry'
import { Genome, type GenomeJSON, Rng } from '../../lib/neat'
import type { KeyMap } from '../defaults'
import { mapOutputToKeys } from './controls'

export interface EvalRequest {
  genomes: GenomeJSON[]
  targetSize: GameSize
  keyMap: KeyMap
  // Per-generation seeds: every genome this generation is scored on the same
  // set of asteroid layouts and its fitness averaged, so a score reflects
  // robust skill rather than one lucky or unlucky layout.
  seeds: number[]
}

export interface EvalResponse {
  scores: number[]
  error?: string
}

// Evaluate a batch of genomes headlessly and return their fitness. Runs off the
// main thread so several batches evaluate in parallel while the UI stays smooth.
const evaluate = ({ genomes, targetSize, keyMap, seeds }: EvalRequest): number[] =>
  genomes.map((json) => {
    const network = Genome.fromJSON(json)
    let total = 0
    for (const seed of seeds) {
      // Fresh generator per seed, so every genome faces the identical layout for
      // a given seed and the scores stay comparable across the population.
      const rng = new Rng(seed)
      const game = new GameInstance({
        targetSize,
        keyMap,
        training: true,
        random: () => rng.next(),
        onScore: (amount) => {
          total += amount
        }
      })
      while (game.status === 'running') {
        const input = game.generateBrainInput()
        game.step(mapOutputToKeys(network.activate(input), keyMap))
      }
    }
    // Average across the seeds so one easy or brutal layout can't dominate.
    return total / seeds.length
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
