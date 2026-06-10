import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { GenStat } from '../../services/train/runner'
import TrainPanel from './train-panel'

const history: GenStat[] = [
  { gen: 1, best: 120, avg: 30, min: 0 },
  { gen: 3, best: 430, avg: 81, min: 12 }
]

// The panel renders a <Link>, so it needs router context.
const renderPanel = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('TrainPanel', () => {
  it('shows the latest generation stats', () => {
    renderPanel(<TrainPanel history={history} speed={1} onSpeedChange={() => {}} />)
    // latest generation number and its average
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('81')).toBeInTheDocument()
    // 430 is both this generation's best and the all-time best
    expect(screen.getAllByText('430')).toHaveLength(2)
  })

  it('renders zeros before the first generation completes', () => {
    renderPanel(<TrainPanel history={[]} speed={1} onSpeedChange={() => {}} />)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('marks the active speed', () => {
    renderPanel(<TrainPanel history={[]} speed={5} onSpeedChange={() => {}} />)
    expect(screen.getByRole('button', { name: '5x' })).toHaveClass('is-active')
    expect(screen.getByRole('button', { name: '1x' })).not.toHaveClass('is-active')
  })

  it('reports the chosen speed when a speed button is clicked', () => {
    const onSpeedChange = vi.fn()
    renderPanel(<TrainPanel history={[]} speed={1} onSpeedChange={onSpeedChange} />)
    fireEvent.click(screen.getByRole('button', { name: '10x' }))
    expect(onSpeedChange).toHaveBeenCalledWith(10)
  })

  it('shows species count and generations since all-time best', () => {
    /* All-time best (500) is at gen 1; latest is gen 9 with 3 species.
       "since best" should be 9 - 1 = 8. */
    const stalled: GenStat[] = [
      { gen: 1, best: 500, avg: 100, min: 0, species: 8 },
      { gen: 9, best: 420, avg: 110, min: 0, species: 3 }
    ]
    renderPanel(<TrainPanel history={stalled} speed={1} onSpeedChange={() => {}} />)
    expect(screen.getByText('species')).toBeInTheDocument()
    expect(screen.getByText('since best')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })
})
