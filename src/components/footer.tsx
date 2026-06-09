import { version } from '../../package.json'
import './style/footer.scss'

interface FooterProps {
  additionalClassName?: string
}

const Footer = ({ additionalClassName }: FooterProps) => (
  <footer className={additionalClassName}>
    asteroids-ml {version} <div className="footer__divider">|</div> © {new Date().getFullYear()}{' '}
    <a href="https://github.com/jonpepler">jonpepler</a>
  </footer>
)

export default Footer
