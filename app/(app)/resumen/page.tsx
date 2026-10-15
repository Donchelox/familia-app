import Link from 'next/link'
import { getContext } from '@/lib/family'
import NotificationBell from '@/components/NotificationBell'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import { fetchMorningSummary } from '@/lib/morningSummary'
import { todayStr } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function ResumenPage() {
  const { supabase, familyId } = await getContext()
  const today = todayStr()

  const [summary, userRes, membersRes] = await Promise.all([
    fetchMorningSummary(supabase, familyId, today),
    supabase.auth.getUser(),
    supabase.from('family_members').select('id, name, user_id').eq('family_id', familyId),
  ])

  const currentUser = userRes.data?.user
  const currentMember = (membersRes.data ?? []).find(
    (m) => m.user_id && m.user_id === currentUser?.id
  )
  const firstName =
    currentMember?.name?.trim() ||
    currentUser?.user_metadata?.name ||
    'Familia'

  const hasItems = summary.totalItemsScheduled > 0
  const pendingMedsCount = summary.medsToday.filter((m) => !m.isTaken).length

  return (
    <div className="w-full flex flex-col gap-6 select-none pb-16">
      {/* 1. HEADER */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer no-underline"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0">Resumen Matutino</h1>
            <p className="text-xs text-neutral-400 font-medium m-0">{summary.formattedDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* 2. HERO CARD MATUTINA: "ESTE DÍA TIENES" */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1f140d 0%, #171717 60%, #131313 100%)',
        }}
        className="relative overflow-hidden p-6 rounded-[32px] border border-[#F76911]/30 shadow-[0_12px_36px_rgba(247,105,17,0.15)] flex flex-col gap-4"
      >
        {/* Glow decorativo de amanecer */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#F76911]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌅</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#F76911]">
                Plan del Día
              </span>
              <span className="text-sm font-bold text-neutral-200">
                ¡Buenos días, {firstName}!
              </span>
            </div>
          </div>

          <span className="text-xs font-black px-3 py-1 rounded-full bg-[#F76911]/20 text-[#F2A957] border border-[#F76911]/40 shadow-sm">
            {summary.totalItemsScheduled} {summary.totalItemsScheduled === 1 ? 'evento' : 'eventos'}
          </span>
        </div>

        {/* Título Principal Requerido */}
        <div className="relative z-10 pt-1">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight m-0">
            Este día tienes:
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 font-medium mt-1 leading-snug">
            {hasItems
              ? 'Revisa el cronograma organizado para ti y tu familia hoy.'
              : '¡No hay pendientes programados para hoy! Disfruta tu jornada.'}
          </p>
        </div>

        {/* Chips de Resumen Rápido */}
        {hasItems && (
          <div className="flex flex-wrap gap-2 pt-2 relative z-10">
            {summary.medsToday.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-xs font-bold text-emerald-300">
                <span>💊</span>
                <span>
                  {summary.medsToday.length} dosis de medicinas
                  {pendingMedsCount > 0 && (
                    <span className="text-emerald-400 ml-1 font-black">
                      ({pendingMedsCount} pend.)
                    </span>
                  )}
                </span>
              </span>
            )}

            {summary.testsToday.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-900/50 text-xs font-bold text-purple-300">
                <span>📝</span>
                <span>{summary.testsToday.length} prueba{summary.testsToday.length === 1 ? '' : 's'} hoy</span>
              </span>
            )}

            {summary.homeworkToday.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-900/50 text-xs font-bold text-purple-300">
                <span>📚</span>
                <span>{summary.homeworkToday.length} tarea{summary.homeworkToday.length === 1 ? '' : 's'} escolar{summary.homeworkToday.length === 1 ? '' : 'es'}</span>
              </span>
            )}

            {summary.todosToday.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-950/40 border border-orange-900/50 text-xs font-bold text-orange-300">
                <span>📋</span>
                <span>{summary.todosToday.length} quehacer{summary.todosToday.length === 1 ? '' : 'es'}</span>
              </span>
            )}

            {(summary.shoppingSuperCount > 0 || summary.shoppingFeriaCount > 0) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-900/50 text-xs font-bold text-amber-300">
                <span>🛒</span>
                <span>
                  {summary.shoppingSuperCount + summary.shoppingFeriaCount} compras
                </span>
              </span>
            )}
          </div>
        )}
      </section>

      {/* 3. ESTADO VACÍO (SI NO HAY NADA PROGRAMADO) */}
      {!hasItems && (
        <div className="p-8 rounded-[32px] bg-[#1a1a1a] border border-neutral-800 text-center flex flex-col items-center gap-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#131313] border border-neutral-800 flex items-center justify-center text-3xl shadow-inner">
            ☀️
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">¡Día 100% Despejado!</h3>
            <p className="text-xs text-neutral-400 max-w-sm">
              No tienes medicamentos pendientes, pruebas escolares ni tareas fijadas para hoy.
            </p>
          </div>
          <Link
            href="/"
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#F76911] text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all no-underline"
          >
            <span>Ir al Inicio</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* 4. BLOQUE: MEDICAMENTOS PROGRAMADOS PARA HOY */}
      {summary.medsToday.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">💊</span>
              <h3 className="text-base font-black text-white tracking-tight m-0">
                Medicamentos de Hoy
              </h3>
            </div>
            <Link
              href="/meds"
              className="text-xs font-bold text-[#F76911] hover:underline no-underline"
            >
              Ver todos →
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {summary.medsToday.map((med) => (
              <div
                key={med.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  med.isTaken
                    ? 'bg-[#141815] border-emerald-950/60 opacity-80'
                    : 'bg-[#1a1a1a] border-neutral-800/80 hover:border-[#F76911]/40'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black ${
                      med.isTaken
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/50'
                        : 'bg-[#1f140d] text-[#F76911] border border-[#F76911]/30'
                    }`}
                  >
                    <span className="text-xs leading-none">{med.time}</span>
                    <span className="text-[9px] uppercase opacity-75">hrs</span>
                  </div>

                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-bold ${
                        med.isTaken ? 'line-through text-neutral-400' : 'text-white'
                      }`}
                    >
                      {med.name}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {med.person ? `${med.person} · ` : ''}
                      {med.dose || 'Dosis habitual'}
                    </span>
                  </div>
                </div>

                <div>
                  {med.isTaken ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-900/60 text-emerald-400 text-[11px] font-bold">
                      <span>✓</span>
                      <span>Tomado</span>
                    </span>
                  ) : (
                    <Link
                      href="/meds"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F76911]/15 border border-[#F76911]/40 text-[#F2A957] hover:bg-[#F76911] hover:text-white transition-all text-[11px] font-bold no-underline cursor-pointer"
                    >
                      <span>Tomar</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. BLOQUE: COLEGIO (PRUEBAS Y TAREAS ESCOLARES DE HOY) */}
      {(summary.testsToday.length > 0 || summary.homeworkToday.length > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">📚</span>
              <h3 className="text-base font-black text-white tracking-tight m-0">
                Colegio para Hoy
              </h3>
            </div>
            <Link
              href="/colegio"
              className="text-xs font-bold text-[#F76911] hover:underline no-underline"
            >
              Ir a colegio →
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Pruebas de hoy destacadas */}
            {summary.testsToday.map((test) => (
              <div
                key={test.id}
                className="p-4 rounded-2xl bg-[#1e1315] border border-rose-900/50 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400 font-bold shrink-0">
                    📝
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-900/40 text-rose-300">
                        Prueba Hoy
                      </span>
                      <span className="text-sm font-bold text-white">{test.subject}</span>
                    </div>
                    {test.topics && (
                      <span className="text-xs text-neutral-300 mt-0.5">{test.topics}</span>
                    )}
                  </div>
                </div>

                <Link
                  href="/colegio"
                  className="text-xs font-bold text-rose-300 hover:text-white no-underline"
                >
                  Detalles →
                </Link>
              </div>
            ))}

            {/* Tareas escolares de hoy */}
            {summary.homeworkToday.map((hw) => (
              <div
                key={hw.id}
                className="p-4 rounded-2xl bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/40 border border-amber-900/50 flex items-center justify-center text-amber-400 shrink-0">
                    📖
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-amber-400">{hw.subject}</span>
                    <span className="text-sm font-bold text-white">{hw.title}</span>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    hw.done
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50'
                      : 'bg-amber-950/40 text-amber-300 border border-amber-900/50'
                  }`}
                >
                  {hw.done ? 'Completada' : 'Por entregar'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. BLOQUE: TAREAS DEL HOGAR */}
      {summary.todosToday.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="text-base font-black text-white tracking-tight m-0">
                Quehaceres y Tareas de la Casa
              </h3>
            </div>
            <Link
              href="/tareas"
              className="text-xs font-bold text-[#F76911] hover:underline no-underline"
            >
              Ver todas ({summary.todosToday.length}) →
            </Link>
          </div>

          <div className="p-4 rounded-2xl bg-[#1a1a1a] border border-neutral-800/80 flex flex-col gap-2">
            {summary.todosToday.slice(0, 5).map((todo) => (
              <div
                key={todo.id}
                className="flex items-center justify-between py-2 border-b border-neutral-800/50 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#F76911]" />
                  <span className="text-xs font-bold text-neutral-200">{todo.title}</span>
                </div>
                <Link
                  href="/tareas"
                  className="text-[11px] text-[#F2A957] hover:underline no-underline font-medium"
                >
                  Completar
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. BLOQUE: COMPRAS PENDIENTES */}
      {(summary.shoppingSuperCount > 0 || summary.shoppingFeriaCount > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛒</span>
              <h3 className="text-base font-black text-white tracking-tight m-0">
                Compras Pendientes
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/super"
              className="p-4 rounded-2xl bg-[#1a1a1a] border border-neutral-800/80 hover:border-sky-500/50 transition-all flex flex-col justify-between gap-3 no-underline group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🏬</span>
                <span className="text-xs font-black text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-lg border border-sky-500/30">
                  {summary.shoppingSuperCount}
                </span>
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors block">
                  Supermercado
                </span>
                <span className="text-[11px] text-neutral-400">
                  {summary.shoppingSuperCount === 1 ? '1 producto por comprar' : `${summary.shoppingSuperCount} productos por comprar`}
                </span>
              </div>
            </Link>

            <Link
              href="/feria"
              className="p-4 rounded-2xl bg-[#1a1a1a] border border-neutral-800/80 hover:border-pink-500/50 transition-all flex flex-col justify-between gap-3 no-underline group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🥬</span>
                <span className="text-xs font-black text-pink-400 bg-pink-500/15 px-2 py-0.5 rounded-lg border border-pink-500/30">
                  {summary.shoppingFeriaCount}
                </span>
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors block">
                  Feria Libre
                </span>
                <span className="text-[11px] text-neutral-400">
                  {summary.shoppingFeriaCount === 1 ? '1 producto por comprar' : `${summary.shoppingFeriaCount} productos por comprar`}
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* 8. BOTÓN DE REGRESO INFERIOR */}
      <div className="pt-4 flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#1a1a1a] border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all text-xs font-bold no-underline"
        >
          <span>← Volver al Dashboard</span>
        </Link>
      </div>
    </div>
  )
}
