import { Link } from 'react-router-dom'
import Layout from '../components/layout'
import SEO from '../components/seo'
import Theme from '../components/theme'

const Settings = () => (
  <Theme>
    <Layout>
      <SEO title="settings" />
      <h1>settings</h1>
      <div className="link-block">
        <Link to="/">go back to training</Link>
        <Link to="/play">go back to playing</Link>
        <Link to="/watch">watch the champion</Link>
      </div>
    </Layout>
  </Theme>
)

export default Settings
