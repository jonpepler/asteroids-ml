import { Route, Routes } from 'react-router-dom'
import NotFoundPage from './pages/404'
import TrainPage from './pages/index'
import PlayPage from './pages/play'
import Settings from './pages/settings'

const App = () => (
  <Routes>
    <Route path="/" element={<TrainPage />} />
    <Route path="/play" element={<PlayPage />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
)

export default App
