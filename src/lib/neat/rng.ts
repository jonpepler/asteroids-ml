// A tiny seedable pseudo-random number generator (mulberry32). Carrot used the
// global Math.random, so two runs could never be compared; seeding the whole
// algorithm through one of these makes a run fully reproducible, which is the
// difference between "the model got worse and I have no idea why" and being able
// to replay the exact run and bisect it.

export class Rng {
  private state: number

  constructor(seed: number) {
    // Force to a 32-bit unsigned int; 0 is a valid seed.
    this.state = seed >>> 0
  }

  // Uniform float in [0, 1).
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Uniform float in [min, max).
  between(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  // Uniform integer in [0, max).
  int(max: number): number {
    return Math.floor(this.next() * max)
  }

  // Approximately standard-normal sample (Box-Muller), for weight perturbation.
  gaussian(): number {
    let u = 0
    let v = 0
    while (u === 0) u = this.next()
    while (v === 0) v = this.next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  pick<T>(items: T[]): T {
    return items[this.int(items.length)]
  }

  bool(probability: number): boolean {
    return this.next() < probability
  }
}

// Derive a non-deterministic seed when the caller does not supply one. Kept out
// of `Rng` so the generator itself stays pure and testable.
export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff)
