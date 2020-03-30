import React from 'react'

import Theme from '../components/theme'
import SEO from '../components/seo'

import Asteroids from '../components/asteroids'

const PlayPage = () => (
  <Theme>
    <SEO title='play' />
    <Asteroids mode='play' />
  </Theme>
)

export default PlayPage
