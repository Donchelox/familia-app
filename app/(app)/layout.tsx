import { getContext, ROLE_LABEL } from '@/lib/family'
import Nav from '@/components/Nav'
import SplashScreen from '@/components/SplashScreen'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext()
  return (
    <SplashScreen>
      <div className="layout">
        <Nav family={ctx.familyName} role={ROLE_LABEL[ctx.role]} />
        <div className="content">
          <main>{children}</main>
        </div>
      </div>
    </SplashScreen>
  )
}