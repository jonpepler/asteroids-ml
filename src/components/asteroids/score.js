import React from 'react'
import PropTypes from 'prop-types'

const Score = (props) => (
  <div className='score'>
    SCORE {props.score.toString().padStart(4, '0')}
  </div>
)

Score.propTypes = {
  score: PropTypes.number
}

export default Score
