import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'

import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

// Vite injects the configured `base` here, so the router shares the
// same '/asteroids-ml/' prefix the static host serves from.
createRoot(container).render(
  <HelmetProvider>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </HelmetProvider>
)
