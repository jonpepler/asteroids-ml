class StarMap {
  constructor (starPoints) {
    this.stars = starPoints
    this.power = 3
  }

  static generate (maxX, maxY) {
    const starNum = Math.floor(Math.random() * maxX * maxY / 2800)
    const random = bound => Math.random() * (bound + 100) - 100
    return new StarMap(
      Array.from({ length: starNum })
        .map(star => [random(maxX), random(maxY)])
    )
  }

  draw (p5) {
    p5.push()
    p5.stroke(255)
    p5.strokeWeight(2)
    this.stars.forEach(star => {
      p5.push()
      if (Math.random() < 0.0005) p5.strokeWeight(4)
      p5.point(...star)
      p5.pop()
    })
    p5.pop()
  }

  applyTravelFeel (delta) {
    this.stars = this.stars.map(star =>
      [star[0] - delta.x * this.power, star[1] - delta.y * this.power]
    )
  }
}

export default StarMap
