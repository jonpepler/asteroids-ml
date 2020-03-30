import React from 'react'

import Theme from '../components/theme'
import SEO from '../components/seo'

import Asteroids from '../components/asteroids'

const TrainPage = () => (
  <Theme>
    <SEO title='train' />
    <Asteroids mode='train' />
  </Theme>
)

export default TrainPage
