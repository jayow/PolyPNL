import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Poly PNL - Polymarket Realized PnL Tracker',
  description: 'Track your realized profit and loss from Polymarket trades',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
