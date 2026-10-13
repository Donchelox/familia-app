import '@/app/globals.css'
import Nav from '@/components/Nav' // Tu componente de navegación original intacto
import PreventContextMenu from '@/components/PreventContextMenu'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full min-h-screen bg-[#131313] text-white">
      <PreventContextMenu />

      {/* Contenedor responsivo sin restricciones rígidas */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 sm:pb-24">
        {children}
      </div>

      {/* Tu navegación original */}
      <Nav />
    </div>
  )
}