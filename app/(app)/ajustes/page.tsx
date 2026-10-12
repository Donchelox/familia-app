import { getContext } from '@/lib/family'
import MembersPanel from '@/components/MembersPanel'
import ScheduleAdmin from '@/components/ScheduleAdmin'
import LogPanel from '@/components/LogPanel'
import { signOut } from '@/app/actions/family'

export default async function Ajustes() {
  const ctx = await getContext()
  const admin = ctx.role === 'admin'
  return (
    <>
      <div className="page-h"><h1>Ajustes</h1></div>
      <MembersPanel ctx={ctx} />
      {admin && <ScheduleAdmin ctx={ctx} />}
      {admin && <LogPanel ctx={ctx} />}
      <form action={signOut}><button className="btn ghost">Cerrar sesión</button></form>
    </>
  )
}
