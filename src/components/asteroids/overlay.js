import React from 'react'
import PropTypes from 'prop-types'

import '../style/asteroids/overlay.scss'

const AstroOverlay = (props) => (
  <>
    {props.gameState === 1
      ? <div className='astro-overlay'>YOU WIN</div>
      : props.gameState === 2
        ? <div className='astro-overlay'>YOU LOSE</div>
        : ''}
  </>
)

AstroOverlay.propTypes = {
  gameState: PropTypes.number
}

export default AstroOverlay
