import { Link } from 'gatsby'
import React from 'react'

import Footer from '../footer'

import '../style/asteroids/footer.scss'

const AstroFooter = () => (
  <footer className='astro-footer'>
    <Link to='/settings/'>
      settings
    </Link>
    <Footer additionalClassName='astro-footer__project-info' />
  </footer>
)

export default AstroFooter
