import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// The game itself is a p5 canvas driven by web workers, neither of which runs
// under jsdom and none of which matters for routing/menu smoke tests. Stub it so
// these tests stay fast and only check the chrome around the game.
vi.mock('./components/asteroids', () => ({
  default: ({ mode }: { mode?: string }) => <div data-testid="asteroids">game:{mode}</div>
}))

const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </HelmetProvider>
  )

describe('app routes', () => {
  it('shows the training dashboard at the root', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /training/i })).toBeInTheDocument()
    expect(screen.getByTestId('asteroids')).toHaveTextContent('game:train')
  })

  it('renders the play route', () => {
    renderAt('/play')
    expect(screen.getByTestId('asteroids')).toHaveTextContent('game:play')
  })

  it('renders the watch route', () => {
    renderAt('/watch')
    expect(screen.getByTestId('asteroids')).toHaveTextContent('game:watch')
  })

  it('shows the settings menu with working navigation links', () => {
    renderAt('/settings')
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go back to training/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /go back to playing/i })).toHaveAttribute(
      'href',
      '/play'
    )
    expect(screen.getByRole('link', { name: /watch the champion/i })).toHaveAttribute(
      'href',
      '/watch'
    )
  })

  it('shows a not-found page for unknown routes', () => {
    renderAt('/no-such-route')
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument()
  })
})
