import React from 'react'
import PropTypes from 'prop-types'
import Score from './score'

import '../style/asteroids/banner.scss'

const AstroBanner = (props) => (
  <aside className='astro-banner'>
    <Score score={props.score} />
  </aside>
)

AstroBanner.propTypes = {
  score: PropTypes.number
}

export default AstroBanner
