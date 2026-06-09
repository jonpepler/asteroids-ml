import Asteroids from '../components/asteroids'
import SEO from '../components/seo'
import Theme from '../components/theme'

const PlayPage = () => (
  <Theme>
    <SEO title="play" />
    <Asteroids mode="play" />
  </Theme>
)

export default PlayPage
