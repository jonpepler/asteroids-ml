import React from 'react'
import PropTypes from 'prop-types'
import { CompactPicker } from 'react-color'

const ColourPicker = (props) => (
  <CompactPicker
    color={props.colour}
    onChangeComplete={({ hex }) => props.handleChangeColour(hex)}
  />
)

ColourPicker.propTypes = {
  colour: PropTypes.string,
  handleChangeColour: PropTypes.func
}

export default ColourPicker
