import Link from 'next/link'
import { getContext } from '@/lib/family'
import { todayStr, nowHHMM, rel } from '@/lib/dates'
import NotificationBell from '@/components/NotificationBell'

export default async function Inicio() {
  const { supabase, familyId } = await getContext()
  const today = todayStr()

  // Consultas paralelas a la base de datos
  const [
    shopAllRes,
    todosRes,
    testsRes,
    hwRes,
    medsRes,
    logsRes,
    userRes,
    membersRes,
  ] = await Promise.all([
    supabase
      .from('shopping_items')
      .select('*')
      .eq('family_id', familyId)
      .or('done.eq.false,done.is.null'),
    supabase
      .from('todos')
      .select('id, title', { count: 'exact' })
      .eq('family_id', familyId)
      .or('done.eq.false,done.is.null'),
    supabase
      .from('school_tests')
      .select('*')
      .eq('family_id', familyId),
    supabase
      .from('school_homework')
      .select('*')
      .eq('family_id', familyId),
    supabase
      .from('medications')
      .select('id, name, person, times')
      .eq('family_id', familyId),
    supabase
      .from('dose_logs')
      .select('medication_id, time')
      .eq('family_id', familyId)
      .eq('day', today),
    supabase.auth.getUser(),
    supabase
      .from('family_members')
      .select('id, name, user_id')
      .eq('family_id', familyId),
  ])

  // 1. OBTENCIÓN DEL NOMBRE Y AVATAR PERSONAL
  const currentUser = userRes.data?.user
  const currentMember = (membersRes.data ?? []).find(
    (m) => m.user_id && m.user_id === currentUser?.id
  )

  const rawName =
    currentMember?.name ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'Marcelo')

  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // 2. CONTEO SEPARADO DE COMPRAS (SÚPER) Y FERIA
  const shopItems = shopAllRes.data ?? []

  const feriaItems = shopItems.filter((item: any) => {
    const listVal = (item.list || item.location || item.category || '').toLowerCase()
    return listVal === 'feria'
  })

  const superItems = shopItems.filter((item: any) => {
    const listVal = (item.list || item.location || item.category || '').toLowerCase()
    return listVal !== 'feria'
  })

  const superCount = superItems.length
  const feriaCount = feriaItems.length

  // 3. MEDICINAS PENDIENTES DE HOY
  const taken = new Set((logsRes.data ?? []).map((l) => `${l.medication_id}|${l.time}`))
  const pendingMeds = (medsRes.data ?? [])
    .flatMap((m) =>
      (m.times || []).map((t: string) => ({
        id: m.id,
        name: m.name,
        person: m.person,
        time: t,
      }))
    )
    .filter((dose) => !taken.has(`${dose.id}|${dose.time}`))
    .sort((a, b) => a.time.localeCompare(b.time))

  // 4. COLEGIO: Pruebas + Tareas escolares pendientes
  const allTests = testsRes.data ?? []
  const hwItems = (hwRes.data ?? []).filter(
    (h: any) => h.done === false || h.done === null || h.done === undefined
  )
  const schoolTotalCount = allTests.length + hwItems.length

  // 5. TAREAS GENERALES
  const generalTodosCount = todosRes.count ?? (todosRes.data?.length ?? 0)

  // 6. PRÓXIMOS EVENTOS
  type EventItem = {
    id: string
    category: 'Colegio' | 'Medicinas' | 'Tareas' | 'Compras'
    title: string
    description: string
    href: string
  }

  const upcomingEvents: EventItem[] = []

  allTests.slice(0, 2).forEach((test: any) => {
    upcomingEvents.push({
      id: `test-${test.id}`,
      category: 'Colegio',
      title: test.subject || 'Prueba',
      // Mapeo con 'topic' de la base de datos
      description: test.topic || test.topics || (test.test_date ? `Fecha: ${rel(test.test_date).toLowerCase()}` : 'Prueba pendiente'),
      href: '/colegio',
    })
  })

  pendingMeds.slice(0, 2).forEach((dose, idx) => {
    upcomingEvents.push({
      id: `med-${dose.id}-${idx}`,
      category: 'Medicinas',
      title: `${dose.name} (${dose.time})`,
      description: `Para ${dose.person}`,
      href: '/meds',
    })
  })

  ;(todosRes.data ?? []).slice(0, 2).forEach((todo) => {
    upcomingEvents.push({
      id: `todo-${todo.id}`,
      category: 'Tareas',
      title: todo.title,
      description: 'Pendiente en casa',
      href: '/tareas',
    })
  })

  shopItems.slice(0, 1).forEach((item: any) => {
    const isFeriaItem = (item.list || item.location || '').toLowerCase() === 'feria'
    upcomingEvents.push({
      id: `shop-${item.id}`,
      category: 'Compras',
      title: item.name,
      description: isFeriaItem ? 'Lista de la feria' : 'Lista del súper',
      href: isFeriaItem ? '/feria' : '/super',
    })
  })

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* HEADER: Avatar individual, Saludo y Campana sincronizada */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ajustes"
            aria-label="Ir a ajustes"
            className="w-12 h-12 rounded-full bg-[#F76911] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0 transition-transform active:scale-95 no-underline hover:opacity-90"
          >
            <span className="text-white font-bold">{initials}</span>
          </Link>
          <div className="leading-tight">
            <span className="text-sm font-normal text-neutral-400">Hola</span>
            <h1 className="text-2xl font-black tracking-tight text-white">{displayName}</h1>
          </div>
        </div>

        {/* Campana sincronizada */}
        <NotificationBell />
      </header>

      {/* GRID DE ACCESOS DIRECTOS */}
      <section className="flex flex-col gap-3">
        {/* Fila 1: Compras (Súper) y Feria */}
        <div className="grid grid-cols-2 gap-3">
          {/* Compras -> /super */}
          <Link
            href="/super"
            style={cardGradientStyle}
            className="relative h-[120px] rounded-[20px] p-3 flex flex-col justify-between overflow-hidden shadow-md text-white transition-all hover:border-2 hover:border-white/20 active:scale-[0.98] no-underline"
          >
            <div className="flex justify-between items-start">
              <svg className="w-6 h-6 stroke-white stroke-[2.2] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {superCount > 0 && (
                <span className="w-6 h-6 rounded-full bg-white text-[#F76911] text-xs font-black flex items-center justify-center shadow">
                  {superCount}
                </span>
              )}
            </div>
            <span className="text-base font-black tracking-wide text-white">Compras</span>
          </Link>

          {/* Feria -> /feria */}
          <Link
            href="/feria"
            style={cardGradientStyle}
            className="relative h-[120px] rounded-[20px] p-3 flex flex-col justify-between overflow-hidden shadow-md text-white transition-all hover:border-2 hover:border-white/20 active:scale-[0.98] no-underline"
          >
            <div className="flex justify-between items-start">
              <svg className="w-6 h-6 stroke-white stroke-[2.2] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {feriaCount > 0 && (
                <span className="w-6 h-6 rounded-full bg-white text-[#F76911] text-xs font-black flex items-center justify-center shadow">
                  {feriaCount}
                </span>
              )}
            </div>
            <span className="text-base font-black tracking-wide text-white">Feria</span>
          </Link>
        </div>

        {/* Fila 2: Medicinas, Colegio, Tareas */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Medicinas -> /meds */}
          <Link
            href="/meds"
            style={cardGradientStyle}
            className="relative h-[115px] rounded-[20px] p-3 flex flex-col justify-between overflow-hidden shadow-md text-white transition-all hover:border-2 hover:border-white/20 active:scale-[0.98] no-underline"
          >
            <svg className="absolute -bottom-3 -right-3 w-20 h-20 text-white/15 stroke-current stroke-[1.5] fill-none pointer-events-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <div className="flex justify-between items-start relative z-10">
              <svg className="w-6 h-6 stroke-white stroke-[2.2] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {pendingMeds.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-[#F76911] text-[11px] font-black flex items-center justify-center shadow">
                  {pendingMeds.length}
                </span>
              )}
            </div>
            <span className="text-xs font-black tracking-wide text-white relative z-10">Medicinas</span>
          </Link>

          {/* Colegio -> /colegio */}
          <Link
            href="/colegio"
            style={cardGradientStyle}
            className="relative h-[115px] rounded-[20px] p-3 flex flex-col justify-between overflow-hidden shadow-md text-white transition-all hover:border-2 hover:border-white/20 active:scale-[0.98] no-underline"
          >
            <svg className="absolute -bottom-2 -right-2 w-20 h-20 text-white/15 stroke-current stroke-[1.5] fill-none pointer-events-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
            <div className="flex justify-between items-start relative z-10">
              <svg className="w-6 h-6 stroke-white stroke-[2.2] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              {schoolTotalCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-[#F76911] text-[11px] font-black flex items-center justify-center shadow">
                  {schoolTotalCount}
                </span>
              )}
            </div>
            <span className="text-xs font-black tracking-wide text-white relative z-10">Colegio</span>
          </Link>

          {/* Tareas -> /tareas */}
          <Link
            href="/tareas"
            style={cardGradientStyle}
            className="relative h-[115px] rounded-[20px] p-3 flex flex-col justify-between overflow-hidden shadow-md text-white transition-all hover:border-2 hover:border-white/20 active:scale-[0.98] no-underline"
          >
            <svg className="absolute -bottom-2 -right-2 w-20 h-20 text-white/15 stroke-current stroke-[1.5] fill-none pointer-events-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <div className="flex justify-between items-start relative z-10">
              <svg className="w-6 h-6 stroke-white stroke-[2.2] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {generalTodosCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-[#F76911] text-[11px] font-black flex items-center justify-center shadow">
                  {generalTodosCount}
                </span>
              )}
            </div>
            <span className="text-xs font-black tracking-wide text-white relative z-10">Tareas</span>
          </Link>
        </div>
      </section>

      {/* SECCIÓN: PRÓXIMOS EVENTOS */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#F76911]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-lg font-bold text-white tracking-tight">Próximos eventos</h2>
          </div>
          <Link href="/colegio" className="text-sm font-semibold !text-[#F76911] hover:underline no-underline">
            + Ver todos
          </Link>
        </div>

        {/* Lista de Eventos */}
        <div className="space-y-4">
          {upcomingEvents.length === 0 ? (
            <p className="text-neutral-500 text-sm py-4">No hay eventos pendientes hoy.</p>
          ) : (
            upcomingEvents.map((evt) => (
              <Link
                key={evt.id}
                href={evt.href}
                className="flex items-center justify-between py-2 border-b border-neutral-800/40 transition-colors group no-underline text-white"
              >
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fde9da] !text-[#F76911]">
                    {evt.category}
                  </span>
                  <h3 className="text-base font-bold text-white group-hover:text-[#F2A957] transition-colors leading-snug">
                    {evt.title}
                  </h3>
                  <p className="text-xs text-neutral-400 font-medium">{evt.description}</p>
                </div>

                <div className="text-[#F76911] pl-3">
                  <svg className="w-5 h-5 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}