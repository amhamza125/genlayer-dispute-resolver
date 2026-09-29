export const metadata = {
  title: 'GenLayer Dispute Resolver',
  description: 'On-chain arbitration UI',
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
