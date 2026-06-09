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
  closestPoint,
  distanceBetweenPoints,
  getDirectionVector
} from './util/geometry'

export type GameStatus = 'init' | 'running' | 'won' | 'lost'

export interface SensePoint {
  line: number
  point: number[]
}

export interface Sense {
  lines: Line[]
  input: SensePoint | undefined
  value: number
}

const asteroidKillScore = 10
const winBonus = 1000
// Fitness shaping: a small per-tick reward (capped) so "stay alive and don't
// crash" is learnable before kills become reachable, plus an episode tick limit
// so a passive genome can't stall a generation. Kept well below kill value.
const survivalRewardPerTick = 0.1
const survivalRewardCap = 30
const episodeTickLimit = 3000

const fireLimiter = 3

// A small training-only fitness cost per shot fired. Discourages the dull
// "hold fire forever" strategy without punishing aimed shots: a kill is worth
// asteroidKillScore (10), so destroying an asteroid stays hugely net positive
// while spraying that hits nothing slowly bleeds fitness.
const firePenalty = 0.15

export interface GameConfig {
  targetSize: GameSize
  keyMap: KeyMap
  // When true, apply training-only mechanics (survival reward, episode timeout)
  // and emit fitness events.
  training: boolean
  // Receives fitness events (kills, survival, win bonus) for the trainer to
  // attribute to the genome under evaluation. Unused in play mode.
  onScore?: (amount: number) => void
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

  ship!: Ship
  asteroids!: Asteroid[]
  bullets!: Bullet[]
  starMap!: StarMap
  senses: Sense[] = []
  score = 0
  status: GameStatus = 'init'
  runTicks = 0
  private survivalAccrued = 0
  private fireCount = 0
  private bonusAsteroidsSpawned = 0

  constructor(config: GameConfig) {
    this.targetSize = config.targetSize
    this.keyMap = config.keyMap
    this.training = config.training
    this.onScore = config.onScore
    this.reset()
  }

  reset() {
    this.ship = new Ship(this.targetSize.w / 2, this.targetSize.h / 2)
    this.asteroids = makeAsteroids(this.targetSize, this.ship)
    this.bullets = []
    this.starMap = StarMap.generate(this.targetSize.w, this.targetSize.h)
    this.senses = []
    this.score = 0
    this.runTicks = 0
    this.survivalAccrued = 0
    this.fireCount = 0
    this.bonusAsteroidsSpawned = 0
    this.status = 'running'
  }

  step(keys: number[]) {
    if (this.status !== 'running') return
    this.reportKeysToShip(keys)
    this.updateObjects([this.ship], this.asteroids, this.bullets)
    this.checkCollisions(this.asteroids, this.bullets)
    this.checkCollisions([this.ship], this.bullets)
    this.checkCollisions([this.ship], this.asteroids)
    this.bullets = this.bullets.filter((obj) => !obj.old)
    this.updateAsteroids()
    if (this.training) this.applyTrainingRewards()
    this.testWin()
    this.testLose()
  }

  private applyTrainingRewards() {
    this.runTicks++
    if (this.survivalAccrued < survivalRewardCap) {
      this.onScore?.(survivalRewardPerTick)
      this.survivalAccrued += survivalRewardPerTick
    }
    // Time out a run that drags on so a purely evasive genome can't stall the
    // generation. Killing the ship routes through the normal loss path.
    if (this.runTicks >= episodeTickLimit && !this.ship.old) this.ship.cleanup()
  }

  private testWin() {
    if (this.status === 'running' && this.asteroids.length === 0) {
      this.status = 'won'
      this.onScore?.(winBonus)
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
    const asteroidsToSplice: number[] = []
    this.asteroids.forEach((obj, i) => {
      if (obj.old) {
        newAsteroids.push(...obj.spawnChildren())
        asteroidsToSplice.push(i)
        this.onScore?.(asteroidKillScore)
        this.score += asteroidKillScore
      }
    })
    asteroidsToSplice.forEach((index) => this.asteroids.splice(index, 1))
    this.asteroids.push(...newAsteroids)
    const totalSize = this.asteroids.reduce((ts, a) => ts + a.size, 0)
    if (totalSize < 1200) this.spawnCornerAsteroid()

    // Once the score climbs past the threshold, keep adding fresh targets so a
    // strong player is not capped by the fixed field. Each boundary spawns once.
    const bonusDue = bonusAsteroidsForScore(this.score)
    while (this.bonusAsteroidsSpawned < bonusDue) {
      this.spawnCornerAsteroid()
      this.bonusAsteroidsSpawned++
    }
  }

  private spawnCornerAsteroid() {
    this.asteroids.push(
      new Asteroid(0, 0)
        .withRandomShape()
        .withRandomCorner(this.targetSize.w, this.targetSize.h)
        .withRandomDelta()
    )
  }

  private reportKeysToShip(keys: number[]) {
    const { keyMap } = this
    for (const key of keys) {
      switch (key) {
        case keyMap.shoot:
          if (this.fireCount > fireLimiter) {
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

  // Cast eight long and eight short "whisker" rays from the ship and return,
  // per whisker, how close the nearest asteroid is (1 = nothing seen). Also
  // records the ray geometry in `this.senses` for the overlay.
  generateBrainInput(): number[] {
    const whiskers = 8
    const longLength = 500
    const shortLength = 200
    const { targetSize, ship, asteroids } = this
    const whiskerPoints: Line[][] = []
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
      }
    }
    makeWhiskers(whiskers, longLength, 0)
    makeWhiskers(whiskers, shortLength, 360 / whiskers / 2)

    const arraysWithElementsOnly = (arr: number[]) => arr.length !== 0
    const sensePoint = (sense: Line[]): SensePoint | undefined => {
      // use old school loop so we can break early
      for (let i = 0; i < sense.length; i++) {
        const point = closestPoint(
          sense[i][0],
          asteroids.flatMap((a) => a.crossedByLine(sense[i])).filter(arraysWithElementsOnly)
        )
        if (point.length !== 0) return { line: i, point }
      }
      return undefined
    }
    this.senses = whiskerPoints.map((sense) => {
      // get coords and line index of intersection point
      const input = sensePoint(sense)
      let value = 1
      if (input) {
        let length = 0

        // measure length up to the line with the sense point
        for (let i = 0; i < input.line; i++) {
          length += distanceBetweenPoints(sense[i][0], sense[i][1])
        }

        let fullLength = length
        // add the length of the next line up to the sense point
        length += distanceBetweenPoints(sense[input.line][0], input.point)

        // measure the rest of the full length of the line (could use whiskerLength)
        for (let i = input.line; i < sense.length; i++) {
          fullLength += distanceBetweenPoints(sense[i][0], sense[i][1])
        }
        value = length / fullLength
      }
      return {
        lines: sense,
        // record which line part hit an astroid, for logging and display reasons
        input,
        value
      }
    })
    return this.senses.map((sense) => sense.value)
  }
}
