class StarMap {
  constructor (starPoints) {
    this.stars = starPoints
  }

  static generate (maxX, maxY) {
    const starNum = Math.floor(Math.random() * maxX * maxY / 1400)
    return new StarMap(Array.from({ length: starNum }).map(star => [Math.random() * (maxX + 100) - 100, Math.random() * (maxY + 100) - 100]))
  }

  draw (p5) {
    p5.push()
    p5.stroke(255)
    p5.strokeWeight(1)
    this.stars.forEach(star => p5.point(...star))
    p5.pop()
  }

  applyTravelFeel (delta) {
    this.stars = this.stars.map(star => [star[0] - delta.x * 3, star[1] - delta.y * 3])
  }
}

export default StarMap
