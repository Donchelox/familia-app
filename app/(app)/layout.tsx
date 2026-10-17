import { Suspense } from 'react'
import Nav from '@/components/Nav' // Tu componente de navegación original intacto
import PreventContextMenu from '@/components/PreventContextMenu'
import PageProgressBar from '@/components/PageProgressBar'
import { getApiContext } from '@/lib/family'
import ClientFamilyHydrator from '@/components/ClientFamilyHydrator'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getApiContext()
  const familyId = ctx?.familyId || ''

  return (
    <div className="w-full min-h-screen bg-[#131313] text-white">
      <ClientFamilyHydrator familyId={familyId} />
      <Suspense fallback={null}>
        <PageProgressBar />
      </Suspense>
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