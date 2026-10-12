import Link from 'next/link'
import { getContext } from '@/lib/family'
import { deleteFamilyMember, signOut } from '@/app/actions/members'
import { AddMemberForm } from '@/components/AddMemberForm'

export default async function AjustesPage() {
  const { supabase, familyId, familyName } = await getContext()

  const [membersRes, userRes] = await Promise.all([
    supabase
      .from('family_members')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ])

  const members = membersRes.data ?? []
  const user = userRes.data?.user
  const userEmail = user?.email || 'Sin correo asociado'
  const userName = user?.user_metadata?.full_name || familyName || 'Usuario'

  return (
    <div className="w-full min-h-screen bg-[#131313] p-0 m-0 flex flex-col items-center text-white">
      <div className="w-full max-w-[402px] px-5 pt-7 pb-32 flex flex-col gap-6">
        
        {/* Header con botón de volver */}
        <header className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-neutral-800 flex items-center justify-center text-white active:scale-95 transition-transform no-underline"
          >
            <svg className="w-5 h-5 stroke-white stroke-2 fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-black tracking-tight text-white">Ajustes del Hogar</h1>
        </header>

        {/* 1. SECCIÓN: Perfil y Cuenta */}
        <section className="p-4 rounded-[20px] bg-[#1a1a1a] border border-neutral-800/80 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white">Tu Cuenta</h2>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#F76911] text-white flex items-center justify-center font-bold text-base">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{userName}</p>
              <p className="text-xs text-neutral-400">{userEmail}</p>
            </div>
          </div>
        </section>

        {/* 2. SECCIÓN: Integrantes del Hogar */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Integrantes del hogar</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Hijos y mascotas no requieren acceso con correo; adultos y familiares pueden iniciar sesión.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {members.length === 0 ? (
              <div className="p-4 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 text-xs text-neutral-400 text-center">
                Aún no has agregado integrantes adicionales.
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="p-3.5 rounded-[20px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F76911] to-[#F2A957] flex items-center justify-center font-bold text-white text-sm">
                      {member.type === 'pet' ? '🐾' : member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">{member.name}</h3>
                      <span className="text-[11px] font-semibold text-[#F2A957] capitalize">
                        {member.role}
                      </span>
                    </div>
                  </div>

                  <form action={deleteFamilyMember}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <button
                      type="submit"
                      aria-label="Eliminar integrante"
                      className="text-neutral-500 hover:text-red-400 transition-colors p-1.5"
                    >
                      <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          {/* Formulario interactivo con rol y tipo inferido */}
          <AddMemberForm />
        </section>

        {/* 3. SECCIÓN: Preferencias y Horarios */}
        <section className="p-4 rounded-[20px] bg-[#1a1a1a] border border-neutral-800/80 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white">Preferencias y Notificaciones</h2>
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
            <div>
              <p className="text-xs font-semibold text-white">Recordatorios de Medicinas</p>
              <p className="text-[11px] text-neutral-400">Avisos según dosis programadas</p>
            </div>
            <span className="text-xs font-bold text-[#F76911]">Activo</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-semibold text-white">Resumen Diario Matutino</p>
              <p className="text-[11px] text-neutral-400">Tareas y eventos a las 08:00</p>
            </div>
            <span className="text-xs font-bold text-[#F76911]">Activo</span>
          </div>
        </section>

        {/* 4. SECCIÓN: Cerrar Sesión */}
        <section className="pt-2">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#221313] border border-red-900/40 text-red-400 hover:text-red-300 hover:bg-[#2e1717] font-bold text-sm transition-colors active:scale-[0.98]"
            >
              Cerrar sesión
            </button>
          </form>
        </section>

      </div>
    </div>
  )
}