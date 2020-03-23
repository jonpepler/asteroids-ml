import React from 'react'
import { Link } from 'gatsby'

import Layout from '../components/layout'
import SEO from '../components/seo'

import Theme from '../components/theme'

const Settings = () => {
  return (
    <Theme>
      <Layout>
        <SEO title='settings' />
        <h1>settings</h1>
        <Link to='/'>go back to training</Link>
      </Layout>
    </Theme>
  )
}

export default Settings
