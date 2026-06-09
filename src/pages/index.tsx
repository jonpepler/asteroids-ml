import { useState } from 'react'
import Asteroids from '../components/asteroids'
import SEO from '../components/seo'
import Theme from '../components/theme'
import TrainPanel from '../components/train/train-panel'
import type { GenStat } from '../services/train/runner'

const TrainPage = () => {
  const [history, setHistory] = useState<GenStat[]>([])
  const [speed, setSpeed] = useState(1)

  return (
    <Theme>
      <SEO title="train" />
      <Asteroids mode="train" speed={speed} onGeneration={(updated) => setHistory([...updated])} />
      <TrainPanel history={history} speed={speed} onSpeedChange={setSpeed} />
    </Theme>
  )
}

export default TrainPage
