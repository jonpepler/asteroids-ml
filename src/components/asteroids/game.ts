import type { KeyMap } from '../../services/defaults'
import type AstroObject from './astro-object'
import Asteroid from './objects/asteroid'
import type Bullet from './objects/bullet'
import Ship from './objects/ship'
import StarMap from './star-map'
import { bonusAsteroidsForScore, makeAsteroids } from './util/asteroid-generator'
import {
  type GameSize,
  type Line,
  type RandomFn,
  distanceBetweenPoints,
  getDirectionVector
} from './util/geometry'

export type GameStatus = 'init' | 'running' | 'lost'

export interface SensePoint {
  line: number
  point: number[]
}

export interface Sense {
  lines: Line[]
  input: SensePoint | undefined
  value: number
}

/*
 * Version of the game balance and training rules below (spawn rates, rewards,
 * penalties, anti-camp, ...). Bump it whenever a change makes fitness scores
 * incomparable with earlier runs. The runner keeps the evolved population
 * across a bump (genomes stay valid) but resets the all-time best and the
 * chart history, so a record set under easier rules can't freeze the
 * "best (all)" stat forever. Input/output layout changes are different: those
 * invalidate the genomes themselves and need a BRAIN_STORE_KEY bump instead.
 */
export const trainingRulesVersion = 1

const asteroidKillScore = 10

/*
 * Ticks-to-seconds: the live game runs at 60fps and headless training steps at
 * the same rate, so one second is 60 ticks everywhere. The survival curve and
 * episode length below are written in seconds and converted through this.
 */
const ticksPerSecond = 60

/*
 * Fitness shaping: an uncapped per-tick survival reward whose rate decays over
 * the episode, so staying alive is always worth fitness (which rewards active
 * field management) while the opening pays the most and a stalled run can't
 * farm a flat rate forever. The rate runs from survivalStartRate down to
 * survivalEndRate across the full episode, interpolated geometrically.
 */
const survivalStartRate = 10 // points per second at the start of an episode
const survivalEndRate = 0.05 // points per second by the episode time limit
const episodeTimeLimitSeconds = 600 // 10 minutes; also the safety timeout
const episodeTickLimit = episodeTimeLimitSeconds * ticksPerSecond

/*
 * Surviving all the way to the time limit is near-impossible against the
 * escalating asteroid field, so it earns a large one-off bonus: a clear target
 * for genuine mastery rather than the dull "camp and spray" local optimum.
 */
const survivalCompletionBonus = 500

const fireLimiter = 3

/*
 * The arcade's on-screen bullet cap; also forces shot economy so the trainer
 * cannot just spin and spray (a swept shot into empty space wastes a scarce
 * round).
 */
const maxBullets = 4

/*
 * A small training-only fitness cost per shot fired. Discourages the dull
 * "hold fire forever" strategy without punishing aimed shots: a kill is worth
 * asteroidKillScore (10), so destroying an asteroid stays hugely net positive
 * while spraying that hits nothing slowly bleeds fitness.
 */
const firePenalty = 0.15

/*
 * A larger training-only cost charged when a bullet ages out without ever
 * hitting anything, on top of firePenalty. This rewards accuracy: an aimed shot
 * pays only the small fire cost and (on a kill) earns asteroidKillScore, while a
 * blind miss also forfeits missPenalty. The breakeven hit rate for firing at a
 * target stays around 10%, so even modestly aimed fire is net positive and the
 * degenerate "never fire" optimum is avoided.
 */
const missPenalty = 1

/*
 * Training-only anti-camp rule: the ship must move at least minMoveDistance
 * (toroidal) away from a rolling anchor within every moveWindowTicks, or it
 * loses. Gating on displacement (not thrust input) means feathering the thrust
 * in place does not satisfy it: a camper has to actively fight the lack of
 * friction to stay put, and now that gets it killed.
 */
const minMoveDistance = 250
const moveWindowTicks = 10 * ticksPerSecond // 10 seconds

/*
 * Normaliser for the per-whisker closing-rate sensor. Asteroid velocity
 * components run to about +/-2.8 px/tick and the ship can add some drift, so
 * dividing the projected approach speed by this and clamping to [-1, 1] keeps
 * the signal in range while leaving headroom for fast head-on approaches.
 */
const maxClosingSpeed = 6

/*
 * The game is endless (no win): a fresh full-size asteroid is spawned whenever
 * the field is down to one or zero "big" ones, so there is always something
 * substantial to engage. Children from splitting fall below this size.
 */
const bigAsteroidSize = 150

/*
 * Steady, skill-independent pressure: a fresh asteroid arrives on a fixed tick
 * cadence (roughly every 7 seconds at 60fps) on top of the score-based spawns,
 * so even a flawless dodger is eventually overwhelmed. Measured in ticks, not
 * wall-clock, so it behaves identically in headless training.
 */
const timedSpawnIntervalTicks = 420

export interface GameConfig {
  targetSize: GameSize
  keyMap: KeyMap
  /*
   * When true, apply training-only mechanics (survival reward, firing cost,
   * episode timeout) and emit fitness events.
   */
  training: boolean
  /*
   * Receives fitness events (kills, survival, firing cost) for the trainer to
   * attribute to the genome under evaluation. Unused in play mode.
   */
  onScore?: (amount: number) => void
  /*
   * Source of randomness for asteroid spawns. Defaults to Math.random; headless
   * training passes a seeded generator so a generation's genomes share a layout.
   */
  random?: RandomFn
}

// The pure Asteroids simulation: no p5, no React, no trainer. `step(keys)`
// advances one tick given the currently-pressed key codes, so it can be driven
// by a neural net (training) or a keyboard (play), and run faster than the
// frame rate or off the main thread.
export class GameInstance {
  targetSize: GameSize
  keyMap: KeyMap
  training: boolean
  onScore?: (amount: number) => void
  random: RandomFn

  ship!: Ship
  asteroids!: Asteroid[]
  bullets!: Bullet[]
  starMap!: StarMap
  senses: Sense[] = []
  score = 0
  status: GameStatus = 'init'
  runTicks = 0
  private fireCount = 0
  private bonusAsteroidsSpawned = 0
  private moveAnchorX = 0
  private moveAnchorY = 0
  private ticksSinceMoved = 0

  constructor(config: GameConfig) {
    this.targetSize = config.targetSize
    this.keyMap = config.keyMap
    this.training = config.training
    this.onScore = config.onScore
    this.random = config.random ?? Math.random
    this.reset()
  }

  reset() {
    this.ship = new Ship(this.targetSize.w / 2, this.targetSize.h / 2)
    this.asteroids = makeAsteroids(this.targetSize, this.ship, this.random)
    this.bullets = []
    this.starMap = StarMap.generate(this.targetSize.w, this.targetSize.h)
    this.senses = []
    this.score = 0
    this.runTicks = 0
    this.fireCount = 0
    this.bonusAsteroidsSpawned = 0
    this.moveAnchorX = this.ship.x
    this.moveAnchorY = this.ship.y
    this.ticksSinceMoved = 0
    this.status = 'running'
  }

  step(keys: number[]) {
    if (this.status !== 'running') return
    // Count every tick in every mode (the timed asteroid spawn and the training
    // timeout both key off this).
    this.runTicks++
    this.reportKeysToShip(keys)
    this.updateObjects([this.ship], this.asteroids, this.bullets)
    this.checkCollisions(this.asteroids, this.bullets)
    /*
     * Refund the fire cost for shots that actually struck an asteroid (any hit,
     * not only a kill), so accurate aiming is rewarded incrementally even though
     * destroying an asteroid takes several hits. Counted here, before the ship
     * collision check, so friendly fire is never refunded. A struck bullet is
     * marked hitTarget and filtered out below, so each is counted exactly once.
     */
    if (this.training) {
      const contacts = this.bullets.filter((obj) => obj.hitTarget).length
      if (contacts > 0) this.onScore?.(firePenalty * contacts)
    }
    this.checkCollisions([this.ship], this.bullets)
    this.checkCollisions([this.ship], this.asteroids)
    /*
     * Charge the miss penalty for any bullet that aged out this tick without
     * hitting anything. Old bullets are filtered out every tick just below, so
     * each is only ever counted once.
     */
    if (this.training) {
      const missed = this.bullets.filter((obj) => obj.old && !obj.hitTarget).length
      if (missed > 0) this.onScore?.(-missPenalty * missed)
    }
    this.bullets = this.bullets.filter((obj) => !obj.old)
    this.updateAsteroids()
    if (this.training) this.applyTrainingRewards()
    if (this.training) this.enforceMovement()
    this.testLose()
  }

  private applyTrainingRewards() {
    const elapsedSeconds = this.runTicks / ticksPerSecond
    /*
     * Geometric decay from survivalStartRate to survivalEndRate across the
     * episode: rate = start * (end / start) ** (elapsed / limit).
     */
    const decay =
      (survivalEndRate / survivalStartRate) ** (elapsedSeconds / episodeTimeLimitSeconds)
    this.onScore?.((survivalStartRate * decay) / ticksPerSecond)
    /*
     * Safety timeout doubling as the mastery goal: a genome that lasts the whole
     * episode is sent off through the normal loss path with a big bonus, so a
     * hypothetical un-killable genome still can't stall the generation.
     */
    if (this.runTicks >= episodeTickLimit && !this.ship.old) {
      this.onScore?.(survivalCompletionBonus)
      this.ship.cleanup()
    }
  }

  /*
   * Kill the ship if it has not relocated minMoveDistance from its anchor within
   * moveWindowTicks. Each time it does move that far, the anchor follows it and
   * the timer resets, so a genuinely roaming ship is never at risk. Toroidal so
   * wrapping across a screen edge cannot be used to fake movement.
   */
  private enforceMovement(): void {
    if (this.ship.old) return
    const dx = Math.abs(this.ship.x - this.moveAnchorX)
    const dy = Math.abs(this.ship.y - this.moveAnchorY)
    /*
     * The ship wraps with a margin of ship.getOffset() on each side, so the
     * true toroidal period is targetSize + 2 * offset, not targetSize. Using
     * targetSize alone makes the toroidal distance negative near the wrap
     * boundary and defeats the check for a ship drifting across an edge.
     */
    const wrapW = this.targetSize.w + this.ship.getOffset() * 2
    const wrapH = this.targetSize.h + this.ship.getOffset() * 2
    const wrappedDx = Math.min(dx, wrapW - dx)
    const wrappedDy = Math.min(dy, wrapH - dy)
    if (wrappedDx * wrappedDx + wrappedDy * wrappedDy >= minMoveDistance * minMoveDistance) {
      this.moveAnchorX = this.ship.x
      this.moveAnchorY = this.ship.y
      this.ticksSinceMoved = 0
    } else {
      this.ticksSinceMoved++
      if (this.ticksSinceMoved > moveWindowTicks) this.ship.cleanup()
    }
  }

  private testLose() {
    if (this.status === 'running' && this.ship.old) {
      this.status = 'lost'
    }
  }

  private updateObjects(...objectLists: AstroObject[][]) {
    for (const objects of objectLists) {
      for (const element of objects) {
        element.applyDelta(this.targetSize.w, this.targetSize.h)
      }
    }
  }

  private checkCollisions(objects: AstroObject[], hittables: AstroObject[]) {
    for (const obj of objects) {
      for (const hittable of hittables) obj.isHit(hittable)
    }
  }

  private updateAsteroids() {
    const newAsteroids: Asteroid[] = []
    this.asteroids.forEach((obj) => {
      if (obj.old) {
        newAsteroids.push(...obj.spawnChildren(this.random))
        this.onScore?.(asteroidKillScore)
        this.score += asteroidKillScore
      }
    })
    // Drop the destroyed ones in a single pass. Splicing collected indices one
    // at a time shifted the array under itself and removed the wrong asteroids
    // whenever more than one died on the same tick.
    this.asteroids = this.asteroids.filter((obj) => !obj.old)
    this.asteroids.push(...newAsteroids)

    /* Keep roughly three big asteroids in play: top up whenever two or fewer
     * remain, since each big one splits into smaller fragments on destruction. */
    const bigCount = this.asteroids.filter((a) => a.size >= bigAsteroidSize).length
    if (bigCount <= 2) this.spawnCornerAsteroid()

    // Steady time pressure on top of the score spawns.
    if (this.runTicks % timedSpawnIntervalTicks === 0) this.spawnCornerAsteroid()

    // Escalate endlessly: one extra asteroid per 100 points, each spawned once.
    const bonusDue = bonusAsteroidsForScore(this.score)
    while (this.bonusAsteroidsSpawned < bonusDue) {
      this.spawnCornerAsteroid()
      this.bonusAsteroidsSpawned++
    }
  }

  private spawnCornerAsteroid() {
    this.asteroids.push(
      new Asteroid(0, 0)
        .withRandomShape(this.random)
        .withRandomCorner(this.targetSize.w, this.targetSize.h, this.random)
        .withRandomDelta(this.random)
    )
  }

  private reportKeysToShip(keys: number[]) {
    const { keyMap } = this
    for (const key of keys) {
      switch (key) {
        case keyMap.shoot:
          if (this.fireCount > fireLimiter && this.bullets.length < maxBullets) {
            this.bullets.push(this.ship.shoot())
            this.fireCount = 0
            // Training-only cost; leaves the player's HUD score untouched.
            if (this.training) this.onScore?.(-firePenalty)
          } else {
            this.fireCount++
          }
          break
        case keyMap.rotateLeft:
          this.ship.rotateLeft()
          break
        case keyMap.boost:
          this.starMap.applyTravelFeel(this.ship.moveUp())
          break
        case keyMap.rotateRight:
          this.ship.rotateRight()
          break
      }
    }
  }

  /*
   * Cast eight long and eight short "whisker" rays from the ship. Each whisker
   * yields two readings for the network: how close the nearest asteroid is
   * (1 = nothing seen) and how fast it is closing in (+1 = rushing the ship,
   * -1 = fleeing). All distances come first, then all closing rates, matching
   * the input-node ids. A trailing ammo-available reading is appended last.
   * Ray geometry is recorded in `this.senses` for the overlay.
   */
  generateBrainInput(): number[] {
    const whiskers = 8
    const longLength = 500
    const shortLength = 200
    const { targetSize, ship, asteroids } = this
    const whiskerPoints: Line[][] = []
    const whiskerDirs: number[][] = []
    const makeWhiskers = (num: number, length: number, offset: number) => {
      for (let i = 0; i < num; i++) {
        const line: Line[] = []
        const angle = ship.r + offset + (360 / num) * i
        let startPoint: number[] = ship.getPointOnEdgeOfShip(angle)
        const angleVector = getDirectionVector(angle)
        const boundOffset = ship.getOffset()

        let endPoint: number[] = []
        const recalcEndPoint = () => {
          endPoint = [
            startPoint[0] + angleVector[0] * length,
            startPoint[1] + angleVector[1] * length
          ]
        }
        recalcEndPoint()
        let isNormalLine = true
        if (startPoint[0] > targetSize.w + boundOffset) {
          startPoint = [startPoint[0] - targetSize.w - boundOffset * 2, startPoint[1]]
          recalcEndPoint()
        } else {
          if (endPoint[0] > targetSize.w + boundOffset) {
            isNormalLine = false
            const boundXOver = endPoint[0] - targetSize.w - boundOffset
            const lengthOver = boundXOver / angleVector[0]
            const yOver = angleVector[1] * lengthOver
            const yUnder = angleVector[1] * (length - lengthOver)
            line.push([startPoint, [targetSize.w + boundOffset, startPoint[1] + yUnder]])
            line.push([
              [-boundOffset, startPoint[1] + yUnder],
              [boundXOver - boundOffset, startPoint[1] + yUnder + yOver]
            ])
          }
        }
        if (startPoint[0] < -boundOffset) {
          startPoint = [startPoint[0] + targetSize.w + boundOffset * 2, startPoint[1]]
          recalcEndPoint()
        } else {
          if (endPoint[0] < -boundOffset) {
            isNormalLine = false
            const boundXUnder = endPoint[0] + boundOffset
            const lengthOver = boundXUnder / angleVector[0]
            const yOver = angleVector[1] * lengthOver
            const yUnder = angleVector[1] * (length - lengthOver)
            line.push([startPoint, [-boundOffset, startPoint[1] + yUnder]])
            line.push([
              [targetSize.w + boundOffset, startPoint[1] + yUnder],
              [targetSize.w + boundXUnder + boundOffset, startPoint[1] + yUnder + yOver]
            ])
          }
        }
        if (startPoint[1] > targetSize.h + boundOffset) {
          startPoint = [startPoint[0], startPoint[1] - targetSize.h - boundOffset * 2]
          recalcEndPoint()
        } else {
          if (endPoint[1] > targetSize.h + boundOffset) {
            isNormalLine = false
            const boundYOver = endPoint[1] - targetSize.h - boundOffset
            const lengthOver = boundYOver / angleVector[1]
            const xOver = angleVector[0] * lengthOver
            const xUnder = angleVector[0] * (length - lengthOver)
            line.push([startPoint, [startPoint[0] + xUnder, targetSize.h + boundOffset]])
            line.push([
              [startPoint[0] + xUnder, -boundOffset],
              [startPoint[0] + xUnder + xOver, boundYOver - boundOffset]
            ])
          }
        }
        if (startPoint[1] < -boundOffset) {
          startPoint = [startPoint[0], startPoint[1] + targetSize.h + boundOffset * 2]
          recalcEndPoint()
        } else {
          if (endPoint[1] < -boundOffset) {
            isNormalLine = false
            const boundYUnder = endPoint[1] + boundOffset
            const lengthOver = boundYUnder / angleVector[1]
            const xOver = angleVector[0] * lengthOver
            const xUnder = angleVector[0] * (length - lengthOver)
            line.push([startPoint, [startPoint[0] + xUnder, -boundOffset]])
            line.push([
              [startPoint[0] + xUnder, targetSize.h + boundOffset],
              [startPoint[0] + xUnder + xOver, targetSize.h + boundYUnder + boundOffset]
            ])
          }
        }
        if (isNormalLine) {
          line.push([startPoint, endPoint])
        }
        whiskerPoints.push(line)
        whiskerDirs.push(angleVector)
      }
    }
    makeWhiskers(whiskers, longLength, 0)
    makeWhiskers(whiskers, shortLength, 360 / whiskers / 2)

    // Walk the (possibly screen-wrapped) ray segment by segment and return the
    // first asteroid it crosses, nearest to the segment start. Unlike a bare
    // point, this keeps the asteroid so its velocity can feed the closing-rate.
    const senseHit = (
      sense: Line[]
    ): { line: number; point: number[]; asteroid: Asteroid } | undefined => {
      for (let i = 0; i < sense.length; i++) {
        let bestPoint: number[] | undefined
        let bestAsteroid: Asteroid | undefined
        let bestDistSq = Number.POSITIVE_INFINITY
        for (const asteroid of asteroids) {
          for (const point of asteroid.crossedByLine(sense[i])) {
            if (point.length === 0) continue
            const dx = point[0] - sense[i][0][0]
            const dy = point[1] - sense[i][0][1]
            const distSq = dx * dx + dy * dy
            if (distSq < bestDistSq) {
              bestDistSq = distSq
              bestPoint = point
              bestAsteroid = asteroid
            }
          }
        }
        if (bestPoint && bestAsteroid) return { line: i, point: bestPoint, asteroid: bestAsteroid }
      }
      return undefined
    }

    const distances: number[] = []
    const closingRates: number[] = []
    this.senses = whiskerPoints.map((sense, wi) => {
      const hit = senseHit(sense)
      let value = 1
      let closing = 0
      if (hit) {
        let length = 0
        // measure length up to the line with the sense point
        for (let i = 0; i < hit.line; i++) {
          length += distanceBetweenPoints(sense[i][0], sense[i][1])
        }
        let fullLength = length
        // add the length of the next line up to the sense point
        length += distanceBetweenPoints(sense[hit.line][0], hit.point)
        // measure the rest of the full length of the line
        for (let i = hit.line; i < sense.length; i++) {
          fullLength += distanceBetweenPoints(sense[i][0], sense[i][1])
        }
        value = length / fullLength

        // Closing speed: the sensed asteroid's velocity relative to the ship,
        // projected onto this whisker's outward direction and negated, so a
        // positive reading means it is heading toward the ship.
        const dir = whiskerDirs[wi]
        const relX = (hit.asteroid.d.x ?? 0) - (ship.d.x ?? 0)
        const relY = (hit.asteroid.d.y ?? 0) - (ship.d.y ?? 0)
        const approach = -(relX * dir[0] + relY * dir[1])
        closing = Math.max(-1, Math.min(1, approach / maxClosingSpeed))
      }
      distances.push(value)
      closingRates.push(closing)
      return {
        lines: sense,
        // record which line part hit an asteroid, for logging and display reasons
        input: hit ? { line: hit.line, point: hit.point } : undefined,
        value
      }
    })
    /*
     * Fraction of the bullet cap still available to fire (1 = full magazine,
     * 0 = none left), so the network can sense the cap and time its shots.
     */
    const ammoAvailable = (maxBullets - this.bullets.length) / maxBullets
    return [...distances, ...closingRates, Math.max(0, Math.min(1, ammoAvailable))]
  }
}
