import { Route, Routes } from 'react-router-dom'
import NotFoundPage from './pages/404'
import DataPage from './pages/data'
import TrainPage from './pages/index'
import PlayPage from './pages/play'
import Settings from './pages/settings'
import WatchPage from './pages/watch'

const App = () => (
  <Routes>
    <Route path="/" element={<TrainPage />} />
    <Route path="/play" element={<PlayPage />} />
    <Route path="/watch" element={<WatchPage />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/data" element={<DataPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
)

export default App
