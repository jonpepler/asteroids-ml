import React from 'react'
import { Link } from 'gatsby'

import Layout from '../components/layout'
import SEO from '../components/seo'

import { useStateWithLocalStorage } from '../components/hooks/use-state-with-storage'
import ColourPicker from '../components/colour-picker'

const Settings = () => {
  const [colour, setColour] = useStateWithLocalStorage('circleColour')
  return (
    <Layout>
      <SEO title='settings' />
      <h1>settings</h1>
      <ColourPicker colour={colour} handleChangeColour={setColour}/>
      <Link to='/'>go back to training</Link>
    </Layout>
  )
}

export default Settings
