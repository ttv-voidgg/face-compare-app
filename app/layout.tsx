import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Face Match: Webcam vs Uploaded Image',
  description: 'A simple face comparison tool built with Next.js and face-api.js. Upload an image, scan your face using your webcam, and get instant feedback on how closely the faces match based on facial recognition technology.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
