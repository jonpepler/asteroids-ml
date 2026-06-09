import Asteroids from '../components/asteroids'
import SEO from '../components/seo'
import Theme from '../components/theme'

// Chromeless attract mode: replays the best trained genome full screen, with no
// HUD or training. Doubles as the basis for a screensaver (point a WKWebView or
// kiosk browser at this route).
const WatchPage = () => (
  <Theme>
    <SEO title="watch" />
    <Asteroids mode="watch" />
  </Theme>
)

export default WatchPage
