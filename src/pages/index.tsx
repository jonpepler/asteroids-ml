import Asteroids from '../components/asteroids'
import SEO from '../components/seo'
import Theme from '../components/theme'

const TrainPage = () => (
  <Theme>
    <SEO title="train" />
    <Asteroids mode="train" />
  </Theme>
)

export default TrainPage
