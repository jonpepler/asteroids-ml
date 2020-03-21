import React from 'react'
import { Link } from 'gatsby'

import Layout from '../components/layout'
import SEO from '../components/seo'

import Asteroids from '../components/asteroids'

const IndexPage = () => (
  <Layout>
    <SEO title='train' />
    <Asteroids />
    <Link to='/settings/'>
      settings
    </Link>
  </Layout>
)

export default IndexPage
