import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Poly PNL - Polymarket Realized PnL Tracker',
  description: 'Track your realized profit and loss from Polymarket trades',
  icons: {
    icon: '/Hanyon.png',
    shortcut: '/Hanyon.png',
    apple: '/Hanyon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
