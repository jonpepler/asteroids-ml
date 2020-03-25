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
        <div className='link-block'>
          <Link to='/'>go back to training</Link>
          <Link to='/play'>go back to playing</Link>
        </div>
      </Layout>
    </Theme>
  )
}

export default Settings
