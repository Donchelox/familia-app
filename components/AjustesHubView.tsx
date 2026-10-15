'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { updateAccount, signOut } from '@/app/actions/members'
import { RELEASES, getSemVerBreakdown } from '@/lib/version'

interface AjustesHubViewProps {
  familyId: string
  userName: string
  userEmail: string
  familyName: string
  membersCount: number
  isAdmin?: boolean
  medRemindersEnabled?: boolean
  medReminderInterval?: number
  appVersion?: string
}

export default function AjustesHubView({
  userName,
  userEmail,
  familyName,
  membersCount,
  isAdmin = false,
  medRemindersEnabled = true,
  medReminderInterval = 5,
  appVersion = '1.3.0',
}: AjustesHubViewProps) {
  const [isEditingAccount, setIsEditingAccount] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [accountName, setAccountName] = useState(userName)
  const [accountEmail, setAccountEmail] = useState(userEmail)
  const [currentFamilyName, setCurrentFamilyName] = useState(familyName)

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  const openAccountEdit = () => {
    setAccountName(userName)
    setAccountEmail(userEmail)
    setCurrentFamilyName(familyName)
    setIsEditingAccount(true)
  }

  const closeAccountEdit = () => setIsEditingAccount(false)

  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  const semver = getSemVerBreakdown(appVersion)
  const currentRelease = RELEASES.find((r) => r.version === appVersion) || RELEASES[0]

  return (
    <div className="w-full flex flex-col gap-6 relative min-h-[calc(100vh-80px)] pb-16 select-none">
      {/* 1. HEADER HOMOLOGADO */}
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
          <h1 className="text-2xl font-black tracking-tight text-white m-0">Ajustes</h1>
        </div>

        <NotificationBell />
      </header>

      {/* 2. CARD DE CUENTA Y PERFIL */}
      <section className="p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-full bg-[#F76911] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
            {initials}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-white leading-snug">{userName}</span>
            <span className="text-xs text-[#F2A957] font-semibold">{familyName}</span>
            <span className="text-xs text-neutral-400 font-medium truncate max-w-[190px]">
              {userEmail || 'Sin correo'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={openAccountEdit}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-[#F76911] hover:text-[#F2A957] hover:border-neutral-700 transition-colors cursor-pointer"
        >
          Editar
        </button>
      </section>

      {/* 3. SECCIÓN: HOGAR Y FAMILIA */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Hogar y Familia
        </span>

        <div className="rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 overflow-hidden shadow-sm">
          <Link
            href="/ajustes/integrantes"
            className="flex items-center justify-between p-4 hover:bg-neutral-800/40 transition-colors no-underline text-white group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-950/40 border border-orange-900/40 text-[#F76911] flex items-center justify-center text-lg shrink-0">
                👥
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-[#F2A957] transition-colors leading-snug">
                  Integrantes de la familia
                </span>
                <span className="text-xs text-neutral-400 font-normal">
                  Gestionar miembros del hogar e invitaciones
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">
                {membersCount} {membersCount === 1 ? 'miembro' : 'miembros'}
              </span>
              <svg className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </section>

      {/* 4. SECCIÓN: CONFIGURACIÓN */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Configuración
        </span>

        <div className="rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 overflow-hidden shadow-sm flex flex-col divide-y divide-neutral-800/60">
          {/* Subpágina: Preferencias */}
          <Link
            href="/ajustes/preferencias"
            className="flex items-center justify-between p-4 hover:bg-neutral-800/40 transition-colors no-underline text-white group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-950/40 border border-amber-900/40 text-[#F2A957] flex items-center justify-center text-lg shrink-0">
                🔔
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-[#F2A957] transition-colors leading-snug">
                  Preferencias y Recordatorios
                </span>
                <span className="text-xs text-neutral-400 font-normal">
                  Avisos de medicinas (cada {medReminderInterval} min), push y resumen
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-900 text-emerald-400 border border-emerald-900/40">
                {medRemindersEnabled ? 'Activos' : 'Pausados'}
              </span>
              <svg className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Subpágina: Historial y Auditoría */}
          <Link
            href="/ajustes/historial"
            className="flex items-center justify-between p-4 hover:bg-neutral-800/40 transition-colors no-underline text-white group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-cyan-950/40 border border-cyan-900/40 text-cyan-400 flex items-center justify-center text-lg shrink-0">
                📋
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-[#F2A957] transition-colors leading-snug">
                  Historial de Actividad & Auditoría
                </span>
                <span className="text-xs text-neutral-400 font-normal">
                  Creación, edición y tareas completadas
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                Ver registro
              </span>
              <svg className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. CERRAR SESIÓN */}
      <section className="pt-2">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-[#201212] border border-red-900/40 text-red-400 hover:text-red-300 hover:bg-[#2c1616] font-bold text-sm transition-colors active:scale-[0.98] cursor-pointer"
          >
            Cerrar sesión
          </button>
        </form>
      </section>

      {/* 6. VERSIÓN DE LA APP CON SEMVER INTERACTIVO */}
      <footer className="pt-4 pb-2 flex flex-col items-center justify-center gap-1.5 text-center">
        <button
          type="button"
          onClick={() => setShowReleaseModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer group shadow-sm active:scale-95"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-xs font-bold tracking-wide">Casa APP · v{appVersion}</span>
          <span className="text-[10px] text-neutral-500 group-hover:text-[#F76911] font-semibold">
            (SemVer) ℹ️
          </span>
        </button>
        <p className="text-[10px] text-neutral-500 font-medium m-0">
          Diseñado para el día a día familiar
        </p>
      </footer>

      {/* 7. MODAL DE INFORMACIÓN DE VERSIÓN Y SEMVER */}
      {showReleaseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={() => setShowReleaseModal(false)} />

          <div className="relative w-full max-w-[402px] bg-[#1a1a1a] rounded-t-[28px] border-t border-neutral-800 p-6 flex flex-col gap-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto shrink-0" />

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white m-0">Versión {appVersion}</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950/50 text-emerald-400 border border-emerald-900/40">
                    SemVer: {currentRelease.type}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5 m-0">
                  {currentRelease.date} · {currentRelease.title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowReleaseModal(false)}
                className="w-8 h-8 rounded-full bg-[#242424] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Desglose Semantic Versioning */}
            <div className="p-3 rounded-2xl bg-[#131313] border border-neutral-800 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-neutral-300">
                Estructura Semantic Versioning (SemVer)
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                  <span className="text-xs font-black text-white">{semver.major}</span>
                  <p className="text-[10px] text-neutral-400 m-0">Major</p>
                </div>
                <div className="p-2 rounded-xl bg-neutral-900/60 border border-[#F76911]/40">
                  <span className="text-xs font-black text-[#F76911]">{semver.minor}</span>
                  <p className="text-[10px] text-neutral-400 m-0">Minor (Features)</p>
                </div>
                <div className="p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                  <span className="text-xs font-black text-white">{semver.patch}</span>
                  <p className="text-[10px] text-neutral-400 m-0">Patch (Fixes)</p>
                </div>
              </div>
            </div>

            {/* Cambios de la versión actual */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-white">Novedades de esta versión:</span>
              <ul className="flex flex-col gap-1.5 p-0 m-0 list-none">
                {currentRelease.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                    <span className="text-[#F76911] font-bold">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Historial anterior */}
            <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800/60">
              <span className="text-xs font-bold text-neutral-400">Versiones anteriores:</span>
              <div className="flex flex-col gap-2">
                {RELEASES.filter((r) => r.version !== appVersion).map((rel) => (
                  <div key={rel.version} className="p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-800/60 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">v{rel.version} · {rel.title}</span>
                      <span className="text-[10px] text-neutral-500">{rel.date}</span>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-400 capitalize">{rel.type}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowReleaseModal(false)}
              className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer mt-1"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* 8. BOTTOM SHEET PARA EDITAR CUENTA */}
      {isEditingAccount && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={closeAccountEdit} />

          <div className="relative w-full max-w-[402px] bg-[#1a1a1a] rounded-t-[28px] border-t border-neutral-800 p-6 flex flex-col gap-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto shrink-0" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white m-0">Editar Cuenta y Familia</h3>
                <p className="text-xs text-neutral-400 mt-0.5 m-0">
                  Actualiza tus datos de acceso y el nombre de tu hogar.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAccountEdit}
                className="w-8 h-8 rounded-full bg-[#242424] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await updateAccount(formData)
                closeAccountEdit()
              }}
              className="flex flex-col gap-3.5"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">Tu nombre</label>
                <input
                  name="fullName"
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Ej. Marcelo Vásquez"
                  required
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">Nombre de la familia</label>
                <input
                  name="familyName"
                  type="text"
                  value={currentFamilyName}
                  onChange={(e) => setCurrentFamilyName(e.target.value)}
                  placeholder="Ej. Familia Vásquez Parada"
                  required
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">Correo electrónico</label>
                <input
                  name="email"
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  required
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                />
                <span className="text-[11px] text-neutral-500">
                  Si cambias el correo, Supabase enviará un correo de confirmación.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAccountEdit}
                  className="flex-1 py-3.5 rounded-2xl bg-[#242424] text-neutral-300 font-bold text-sm active:scale-95 transition-transform cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={cardGradientStyle}
                  className="flex-[2] py-3.5 rounded-2xl text-white font-bold text-sm active:scale-95 transition-transform shadow-md cursor-pointer"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
