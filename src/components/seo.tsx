/**
 * SEO component. Site metadata is inlined (see ../site-metadata) now that the
 * project is a Vite SPA rather than a Gatsby site with a GraphQL data layer.
 */

import { Helmet } from 'react-helmet-async'
import { siteMetadata } from '../site-metadata'

type MetaEntry = { name: string; content: string } | { property: string; content: string }

interface SEOProps {
  title: string
  description?: string
  lang?: string
  meta?: MetaEntry[]
}

function SEO({ description = '', lang = 'en', meta = [], title }: SEOProps) {
  const metaDescription = description || siteMetadata.description

  return (
    <Helmet
      htmlAttributes={{ lang }}
      title={title}
      titleTemplate={`%s | ${siteMetadata.title}`}
      meta={[
        { name: 'description', content: metaDescription },
        { property: 'og:title', content: title },
        { property: 'og:description', content: metaDescription },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:creator', content: siteMetadata.author },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: metaDescription },
        ...meta
      ]}
    />
  )
}

export default SEO
