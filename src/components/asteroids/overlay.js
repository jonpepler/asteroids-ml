import React from 'react'
import PropTypes from 'prop-types'

import '../style/asteroids/overlay.scss'

const AstroOverlay = (props) => (
  <>
    {props.won ? <div className='astro-overlay'>YOU WIN</div> : ''}
  </>
)

AstroOverlay.propTypes = {
  won: PropTypes.bool
}

export default AstroOverlay
