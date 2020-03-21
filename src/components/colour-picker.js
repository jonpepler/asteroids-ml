import React from 'react'
import { CompactPicker } from 'react-color'

const ColourPicker = (props) => (
    <CompactPicker
      color={props.colour}
      onChangeComplete={({hex}) => props.handleChangeColour(hex)}
    />
)

export default ColourPicker