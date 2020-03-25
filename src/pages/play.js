import React from 'react'

import Theme from '../components/theme'
import SEO from '../components/seo'

import Asteroids from '../components/asteroids'

const IndexPage = () => (
  <Theme>
    <SEO title='train' />
    <Asteroids mode='play' />
  </Theme>
)

export default IndexPage
