import { Link } from 'react-router-dom'
import './style/header.scss'

interface HeaderProps {
  siteTitle?: string
}

const Header = ({ siteTitle = '' }: HeaderProps) => (
  <header>
    <h1>
      <Link to="/">{siteTitle}</Link>
    </h1>
  </header>
)

export default Header
