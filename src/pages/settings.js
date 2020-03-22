import React from 'react'
import { Link } from 'gatsby'

import Layout from '../components/layout'
import SEO from '../components/seo'

import { useStateWithLocalStorage } from '../components/hooks/use-state-with-storage'
import ColourPicker from '../components/colour-picker'
import Theme from '../components/theme'

const Settings = () => {
  const [colour, setColour] = useStateWithLocalStorage('circleColour')
  return (
    <Theme>
      <Layout>
        <SEO title='settings' />
        <h1>settings</h1>
        <ColourPicker colour={colour} handleChangeColour={setColour} />
        <Link to='/'>go back to training</Link>
      </Layout>
    </Theme>
  )
}

export default Settings
