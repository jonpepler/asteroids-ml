import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BRAIN_STORE_KEY } from '../../services/train/runner'
import DataScreen from './data-screen'

const { getRaw, del } = vi.hoisted(() => ({ getRaw: vi.fn(), del: vi.fn() }))
vi.mock('../../services/storage', () => ({ getRaw, del }))

const storedBrain = {
  head: { generation: 42 },
  currentGeneration: new Array(200).fill({}),
  best: {
    gen: 37,
    score: 685.4,
    json: {
      nodes: new Array(20).fill({}),
      connections: [{ enabled: true }, { enabled: true }, { enabled: false }]
    }
  },
  history: new Array(40).fill({ gen: 0, best: 0, avg: 0, min: 0 })
}

const renderScreen = () => render(<MemoryRouter>{<DataScreen />}</MemoryRouter>)

beforeEach(() => {
  getRaw.mockReset()
  del.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DataScreen', () => {
  it('inspects the saved record', async () => {
    getRaw.mockResolvedValue(storedBrain)
    renderScreen()

    expect(await screen.findByText('42')).toBeInTheDocument() // generation
    expect(screen.getByText('40')).toBeInTheDocument() // generations recorded
    expect(screen.getByText('200')).toBeInTheDocument() // population
    expect(screen.getByText('685')).toBeInTheDocument() // best score, rounded
    expect(screen.getByText('37')).toBeInTheDocument() // best from generation
    // enabled connections only (2 of 3)
    expect(screen.getByText('20 nodes, 2 connections')).toBeInTheDocument()
  })

  it('reports when there is no saved data', async () => {
    getRaw.mockResolvedValue(undefined)
    renderScreen()

    expect(await screen.findByText('no saved training data.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'clear training data' })).not.toBeInTheDocument()
  })

  it('clears the data after confirmation and re-reads as empty', async () => {
    getRaw.mockResolvedValueOnce(storedBrain).mockResolvedValue(undefined)
    del.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderScreen()
    const button = await screen.findByRole('button', { name: 'clear training data' })
    button.click()

    await waitFor(() => expect(del).toHaveBeenCalledWith(BRAIN_STORE_KEY))
    expect(await screen.findByText('no saved training data.')).toBeInTheDocument()
  })

  it('does not clear when the confirmation is dismissed', async () => {
    getRaw.mockResolvedValue(storedBrain)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderScreen()
    const button = await screen.findByRole('button', { name: 'clear training data' })
    button.click()

    expect(del).not.toHaveBeenCalled()
  })
})
