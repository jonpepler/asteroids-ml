import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { del, getRaw } from '../../services/storage'
import { BRAIN_STORE_KEY, type GenStat } from '../../services/train/runner'
import '../style/data-screen.scss'

// A loose view of the persisted brain record. Kept defensive (everything
// optional) so a partial or older record still inspects without throwing.
interface StoredBrainShape {
  head?: { generation: number }
  currentGeneration?: unknown[]
  best?: {
    gen: number
    score: number
    json?: { nodes?: unknown[]; connections?: { enabled: boolean }[] }
  }
  history?: GenStat[]
}

interface Summary {
  generation: number
  population: number
  generationsRecorded: number
  bestScore: number
  bestGen: number
  bestNodes: number
  bestConnections: number
  sizeKb: number
}

const summarise = (data: StoredBrainShape): Summary => {
  const json = data.best?.json
  return {
    generation: data.head?.generation ?? 0,
    population: data.currentGeneration?.length ?? 0,
    generationsRecorded: data.history?.length ?? 0,
    bestScore: Math.round(data.best?.score ?? 0),
    bestGen: data.best?.gen ?? 0,
    bestNodes: json?.nodes?.length ?? 0,
    bestConnections: json?.connections?.filter((c) => c.enabled).length ?? 0,
    sizeKb: Math.round((JSON.stringify(data).length / 1024) * 10) / 10
  }
}

const DataScreen = () => {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = (await getRaw(BRAIN_STORE_KEY)) as StoredBrainShape | undefined
    setSummary(data ? summarise(data) : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const clear = async () => {
    if (!window.confirm('Delete all saved training data? This cannot be undone.')) return
    await del(BRAIN_STORE_KEY)
    await load()
  }

  return (
    <div className="data-screen">
      <h1>training data</h1>

      {loading ? (
        <p>loading...</p>
      ) : summary ? (
        <>
          <dl className="data-screen__stats">
            <div>
              <dt>generation</dt>
              <dd>{summary.generation}</dd>
            </div>
            <div>
              <dt>population</dt>
              <dd>{summary.population}</dd>
            </div>
            <div>
              <dt>generations recorded</dt>
              <dd>{summary.generationsRecorded}</dd>
            </div>
            <div>
              <dt>best score</dt>
              <dd>{summary.bestScore}</dd>
            </div>
            <div>
              <dt>best from generation</dt>
              <dd>{summary.bestGen}</dd>
            </div>
            <div>
              <dt>best brain size</dt>
              <dd>
                {summary.bestNodes} nodes, {summary.bestConnections} connections
              </dd>
            </div>
            <div>
              <dt>stored size</dt>
              <dd>{summary.sizeKb} KB</dd>
            </div>
          </dl>

          <button type="button" className="data-screen__clear" onClick={clear}>
            clear training data
          </button>
        </>
      ) : (
        <p>no saved training data.</p>
      )}

      <div className="link-block">
        <Link to="/">go back to training</Link>
        <Link to="/watch">watch the champion</Link>
        <Link to="/settings">settings</Link>
      </div>
    </div>
  )
}

export default DataScreen
