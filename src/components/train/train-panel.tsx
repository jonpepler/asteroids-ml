import { Link } from 'react-router-dom'
import type { GenStat } from '../../services/train/runner'
import '../style/train-panel.scss'
import FitnessChart from './fitness-chart'

const speeds = [1, 2, 5, 10]

interface TrainPanelProps {
  history: GenStat[]
  speed: number
  onSpeedChange: (speed: number) => void
}

const TrainPanel = ({ history, speed, onSpeedChange }: TrainPanelProps) => {
  const latest = history[history.length - 1]
  const allTimeBest = history.reduce((max, h) => Math.max(max, h.best), 0)

  return (
    <aside className="train-panel">
      <h2 className="train-panel__title">training</h2>

      <FitnessChart history={history} />

      <dl className="train-panel__stats">
        <div>
          <dt>generation</dt>
          <dd>{latest ? latest.gen : 0}</dd>
        </div>
        <div>
          <dt>best (gen)</dt>
          <dd>{latest ? Math.round(latest.best) : 0}</dd>
        </div>
        <div>
          <dt>best (all)</dt>
          <dd>{Math.round(allTimeBest)}</dd>
        </div>
        <div>
          <dt>avg (gen)</dt>
          <dd>{latest ? Math.round(latest.avg) : 0}</dd>
        </div>
      </dl>

      <div className="train-panel__speed">
        <span className="train-panel__speed-label">speed</span>
        {speeds.map((s) => (
          <button
            key={s}
            type="button"
            className={s === speed ? 'is-active' : ''}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="train-panel__links">
        <Link to="/data">manage data</Link>
      </div>
    </aside>
  )
}

export default TrainPanel
