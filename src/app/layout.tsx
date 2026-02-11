import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'RAG Knowledge Base',
  description: 'Multi-tenant RAG knowledge base and support console',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-neutral-50 text-neutral-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
