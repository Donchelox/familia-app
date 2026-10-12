import { getContext, ROLE_LABEL } from '@/lib/family'
import Nav from '@/components/Nav'
import SplashScreen from '@/components/SplashScreen'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext()

  return (
    <SplashScreen>
      <div className="min-h-screen bg-[#131313] text-white flex flex-col items-center w-full">
        {/* Contenedor central a 402px con 20px de padding lateral forzado para toda la app */}
        <div className="w-full max-w-[402px] px-5 pt-6 pb-28 flex flex-col flex-1">
          {children}
        </div>
        
        <Nav family={ctx.familyName} role={ROLE_LABEL[ctx.role]} />
      </div>
    </SplashScreen>
  )
}