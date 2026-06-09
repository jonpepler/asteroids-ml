import type { ReactNode } from 'react'
import { siteMetadata } from '../site-metadata'
import Footer from './footer'
import Header from './header'

const Layout = ({ children }: { children: ReactNode }) => (
  <>
    <Header siteTitle={siteMetadata.title} />
    <main>{children}</main>
    <Footer />
  </>
)

export default Layout
