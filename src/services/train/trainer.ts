import type { GameInstance } from '../../components/asteroids/game'
import type { GameSize } from '../../components/asteroids/util/geometry'
import { Genome, type GenomeJSON, randomSeed } from '../../lib/neat'
import type { KeyMap } from '../defaults'
import { mapOutputToKeys } from './controls'
import type { EvalRequest, EvalResponse } from './eval.worker'
import Runner, { type BrainGraph, type GenStat } from './runner'

export interface TrainerConfig {
  targetSize: GameSize
  keyMap: KeyMap
}

// Upper bound on evaluation workers. The actual count is a share of the
// machine's cores (see workerShare); this cap only guards against an
// implausibly large reported core count.
const maxWorkers = 16

// Fraction of the machine's cores to spend on evaluation workers. Kept well
// below 100% so the rest of the system (and the main thread replaying the
// champion at 60fps) stays responsive rather than being starved.
const workerShare = 0.6

// How many random layouts each genome is scored on per generation; its fitness
// is the average. More seeds means a cleaner, less luck-driven signal at a
// proportional cost in evaluation time.
const seedsPerGeneration = 5

// A fixed pool of evaluation workers. Each generation is split into one batch
// per worker, evaluated in parallel, and reassembled in population order.
class WorkerPool {
  private workers: Worker[]

  constructor(size: number) {
    this.workers = Array.from(
      { length: size },
      () => new Worker(new URL('./eval.worker.ts', import.meta.url), { type: 'module' })
    )
  }

  get size() {
    return this.workers.length
  }

  private runOne(worker: Worker, request: EvalRequest): Promise<number[]> {
    return new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<EvalResponse>) => {
        if (event.data.error) reject(new Error(event.data.error))
        else resolve(event.data.scores)
      }
      // A worker that fails to load or throws at the top level never sends a
      // message; surface that as a rejection rather than hanging the generation.
      worker.onerror = (event: ErrorEvent) => reject(new Error(event.message || 'worker error'))
      worker.postMessage(request)
    })
  }

  async evaluate(
    genomes: GenomeJSON[],
    targetSize: GameSize,
    keyMap: KeyMap,
    seeds: number[]
  ): Promise<number[]> {
    const batches = splitIntoBatches(genomes, this.workers.length)
    const results = await Promise.all(
      batches.map((genomesBatch, i) =>
        genomesBatch.length
          ? this.runOne(this.workers[i], { genomes: genomesBatch, targetSize, keyMap, seeds })
          : Promise.resolve([])
      )
    )
    return results.flat()
  }

  terminate() {
    for (const worker of this.workers) worker.terminate()
  }
}

const splitIntoBatches = <T>(items: T[], batches: number): T[][] => {
  const out: T[][] = Array.from({ length: batches }, () => [])
  items.forEach((item, i) => out[i % batches].push(item))
  return out
}

// Owns the NEAT population (via Runner) and drives training in the background:
// each generation is evaluated in parallel across worker threads, then evolved
// on the main thread. The best genome seen so far is exposed so the UI can
// replay it at normal speed while the next generation evaluates.
export class Trainer {
  runner: Runner
  private targetSize: GameSize
  private keyMap: KeyMap
  private pool: WorkerPool | null = null
  private running = false
  private onGeneration?: (history: GenStat[]) => void

  championNetwork: Genome | null = null
  championScore = Number.NEGATIVE_INFINITY

  constructor(config: TrainerConfig) {
    this.runner = new Runner()
    this.targetSize = config.targetSize
    this.keyMap = config.keyMap
  }

  async init() {
    await this.runner.init()
    if (this.runner.best) {
      this.championNetwork = Genome.fromJSON(this.runner.best.json)
      this.championScore = this.runner.best.score
    }
    const cores = navigator.hardwareConcurrency || 4
    const size = Math.max(1, Math.min(maxWorkers, Math.round(cores * workerShare)))
    this.pool = new WorkerPool(size)
  }

  get generation() {
    return this.runner.neat.generation
  }

  get workerCount() {
    return this.pool?.size ?? 0
  }

  get history(): GenStat[] {
    return this.runner.history
  }

  start(onGeneration: (history: GenStat[]) => void) {
    this.onGeneration = onGeneration
    this.running = true
    this.loop()
  }

  stop() {
    this.running = false
    this.pool?.terminate()
  }

  private async loop() {
    while (this.running && this.pool) {
      try {
        const population = this.runner.neat.population
        // Fresh random layouts each generation, shared across the whole
        // population and averaged per genome: comparable within the generation,
        // and re-rolled each time so the population can't overfit fixed layouts.
        const seeds = Array.from({ length: seedsPerGeneration }, () => randomSeed())
        const scores = await this.pool.evaluate(
          population.map((g) => g.toJSON()),
          this.targetSize,
          this.keyMap,
          seeds
        )
        if (!this.running) break
        this.unscramble(scores).forEach((score, i) => {
          population[i].score = score
        })

        // Records this generation's stats and the all-time best, then evolves.
        this.runner.nextGeneration()
        this.runner.saveCurrentGeneration(true)
        this.adoptChampion()
        this.onGeneration?.(this.runner.history)
      } catch (error) {
        console.error('Training stopped after an error', error)
        this.running = false
      }
    }
  }

  // Reverse the round-robin batch ordering used by the pool.
  private unscramble(batchedScores: number[]): number[] {
    const n = this.runner.neat.population.length
    const batches = this.pool?.size ?? 1
    const ordered = new Array<number>(n)
    let k = 0
    for (let b = 0; b < batches; b++) {
      for (let i = b; i < n; i += batches) {
        ordered[i] = batchedScores[k++]
      }
    }
    return ordered
  }

  private adoptChampion() {
    const best = this.runner.best
    if (best && best.score > this.championScore) {
      this.championScore = best.score
      this.championNetwork = Genome.fromJSON(best.json)
    }
  }

  // Keys for the champion to play one tick of the spectator game.
  championKeys(game: GameInstance): number[] {
    if (!this.championNetwork) return []
    return mapOutputToKeys(this.championNetwork.activate(game.generateBrainInput()), this.keyMap)
  }

  getChampionGraph(): Promise<BrainGraph | []> {
    if (!this.championNetwork) return Promise.resolve([])
    return this.runner.buildGraph(this.championNetwork)
  }

  // The champion's node activations from its most recent tick, keyed by node id,
  // for the live brain-activity display. Matches the ids in getChampionGraph().
  getChampionActivations(): Map<number, number> {
    return this.championNetwork?.activations ?? new Map()
  }
}
