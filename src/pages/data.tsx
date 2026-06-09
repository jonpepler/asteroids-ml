import DataScreen from '../components/data/data-screen'
import Layout from '../components/layout'
import SEO from '../components/seo'
import Theme from '../components/theme'

const DataPage = () => (
  <Theme>
    <Layout>
      <SEO title="data" />
      <DataScreen />
    </Layout>
  </Theme>
)

export default DataPage
