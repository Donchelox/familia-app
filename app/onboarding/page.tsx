import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CreateFamilySchema } from '@/lib/validations/schemas'

export default async function Onboarding() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Si el usuario ya pertenece a una familia, ir directo al dashboard
  const { data: member } = await supabase
    .from('members')
    .select('family_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (member) {
    redirect('/')
  }

  // 2. Verificar si tiene invitaciones pendientes usando Service Role para ignorar RLS
  let pendingInvite: { id: string; family_id: string; role: string; family_name?: string } | null = null
  const cleanEmail = (user.email || '').trim().toLowerCase()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (cleanEmail && serviceKey && url) {
    const admin = createAdminClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: inv } = await admin
      .from('invites')
      .select('id, family_id, role, email')
      .ilike('email', cleanEmail)
      .limit(1)
      .maybeSingle()

    if (inv) {
      const { data: fam } = await admin
        .from('families')
        .select('name')
        .eq('id', inv.family_id)
        .maybeSingle()

      pendingInvite = {
        id: inv.id,
        family_id: inv.family_id,
        role: inv.role,
        family_name: fam?.name || 'Mi familia',
      }
    }
  }

  // Acción para aceptar la invitación encontrada
  async function acceptInvite() {
    'use server'
    const s = await createClient()
    const {
      data: { user: currentUser },
    } = await s.auth.getUser()
    if (!currentUser || !pendingInvite) return

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const uEmail = (currentUser.email || '').trim().toLowerCase()
    const dName =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      uEmail.split('@')[0]

    await admin.from('members').upsert(
      {
        family_id: pendingInvite.family_id,
        user_id: currentUser.id,
        email: uEmail,
        display_name: dName,
        role: pendingInvite.role,
      },
      { onConflict: 'family_id,user_id' }
    )

    await admin.from('invites').delete().eq('id', pendingInvite.id)

    // Vincular ficha de adulto si existe
    await admin
      .from('family_members')
      .update({ user_id: currentUser.id })
      .eq('family_id', pendingInvite.family_id)
      .is('user_id', null)
      .eq('type', 'adult')

    redirect('/')
  }

  // Acción para crear una familia nueva (solo si no fue invitado o decide rechazar)
  async function create(fd: FormData) {
    'use server'
    const parsed = CreateFamilySchema.safeParse({
      family: fd.get('family'),
      name: fd.get('name'),
    })
    if (!parsed.success) {
      throw new Error('Datos inválidos para crear la familia.')
    }
    const s = await createClient()
    const { error } = await s.rpc('create_family', {
      fname: parsed.data.family,
      dname: parsed.data.name,
    })
    if (error) throw new Error(error.message)
    redirect('/')
  }

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  return (
    <div className="w-full min-h-screen bg-[#131313] flex flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        {/* CABECERA CON ISOTIPO */}
        <header className="flex flex-col items-center text-center gap-3">
          <div
            style={orangeGradient}
            className="w-16 h-16 rounded-[22px] flex items-center justify-center shadow-[0_8px_24px_rgba(247,105,17,0.35)] shrink-0"
          >
            <svg
              className="w-8 h-8 text-white stroke-current stroke-[2.2] fill-none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0">
              {pendingInvite ? '¡Fuiste invitado!' : 'Crea tu familia'}
            </h1>
            <p className="text-xs text-neutral-400 mt-1.5 font-medium leading-relaxed max-w-[320px]">
              {pendingInvite
                ? `Te invitaron a formar parte de "${pendingInvite.family_name}".`
                : 'Quedarás como administrador principal. Podrás invitar y gestionar integrantes más adelante.'}
            </p>
          </div>
        </header>

        {/* SI TIENE INVITACIÓN PENDIENTE: MOSTRAR OPCIÓN DE UNIRSE */}
        {pendingInvite ? (
          <section className="p-6 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-2xl flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[#F76911]">Invitación pendiente</span>
              <span className="text-base font-bold text-white">{pendingInvite.family_name}</span>
              <span className="text-xs text-neutral-400">
                Rol: <b className="text-neutral-200 capitalize">{pendingInvite.role === 'editor' ? 'Puede editar' : pendingInvite.role}</b>
              </span>
            </div>

            <form action={acceptInvite}>
              <button
                type="submit"
                style={orangeGradient}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-[0_4px_16px_rgba(247,105,17,0.3)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Aceptar y unirme a la familia
              </button>
            </form>
          </section>
        ) : (
          /* FORMULARIO NORMAL PARA CREAR FAMILIA SI NO HAY INVITACIÓN */
          <section className="p-6 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-2xl flex flex-col gap-5">
            <form action={create} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="family" className="text-xs font-bold text-neutral-300">
                  Nombre del hogar o familia
                </label>
                <input
                  id="family"
                  name="family"
                  type="text"
                  required
                  placeholder="Ej. Familia Vásquez o Casa Central"
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-xs font-bold text-neutral-300">
                  Tu nombre o apodo
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Ej. Marcelo"
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911] transition-colors"
                />
              </div>

              <button
                type="submit"
                style={orangeGradient}
                className="w-full py-3.5 mt-2 rounded-2xl text-white font-bold text-sm shadow-[0_4px_16px_rgba(247,105,17,0.3)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Crear familia
              </button>
            </form>
          </section>
        )}

        {/* NOTA AL PIE DE PÁGINA */}
        <footer className="text-center px-4">
          <p className="text-[11px] text-neutral-500 leading-relaxed font-medium m-0">
            {pendingInvite
              ? 'Al aceptar, podrás colaborar en tareas, compras y medicinas de este hogar.'
              : '¿Te invitaron? Inicia sesión con el mismo correo de tu invitación para vincularte automáticamente.'}
          </p>
        </footer>
      </div>
    </div>
  )
}