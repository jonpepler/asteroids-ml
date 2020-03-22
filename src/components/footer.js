import React from 'react'
import PropTypes from 'prop-types'
import { version } from '../../package.json'

import './style/footer.scss'

const Footer = (props) => (
  <footer className={props.additionalClassName}>
    asteroids-ml {version} <div className='footer__divider'>|</div> © {new Date().getFullYear()} <a href='https://github.com/jonpepler'>jonpepler</a>
  </footer>
)

Footer.propTypes = {
  additionalClassName: PropTypes.string
}

export default Footer
