import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'uomap | University of Ottawa',
  description: 'Map out your schedule and find student opportunities at uOttawa.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-0NY9Z1L9Q5" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-0NY9Z1L9Q5');
        `}</Script>
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
