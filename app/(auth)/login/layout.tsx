import '@/app/globals.css'
import PreventContextMenu from '@/components/PreventContextMenu'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#131313] text-white">
      <PreventContextMenu />
      {children}
    </div>
  )
}