import React from 'react'
import PropTypes from 'prop-types'
import './style/theme.scss'

const Theme = ({ children }) => <>{children}</>
Theme.propTypes = {
  children: PropTypes.node
}
export default Theme
