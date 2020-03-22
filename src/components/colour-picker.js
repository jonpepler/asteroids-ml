import React from 'react'
import PropTypes from 'prop-types'
import { CompactPicker } from 'react-color'

import './style/colour-picker.scss'

const ColourPicker = (props) => (
  <div className='colour-picker'>
    <CompactPicker
      color={props.colour}
      onChangeComplete={({ hex }) => props.handleChangeColour(hex)}
    />
  </div>
)

ColourPicker.propTypes = {
  colour: PropTypes.string,
  handleChangeColour: PropTypes.func
}

export default ColourPicker
