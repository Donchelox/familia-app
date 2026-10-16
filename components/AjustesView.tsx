'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import LogPanel from '@/components/LogPanel'
import {
  updateAccount,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  updatePreferences,
  signOut,
} from '@/app/actions/members'
import { unsubscribeCurrentPush } from '@/components/PushSubscriptionManager'
import { purgeAllUserDataAndCache } from '@/lib/offline/clientSync'

export type FamilyMember = {
  id: string
  name: string
  role: string
  type: string
}

interface AjustesViewProps {
  familyId: string
  userName: string
  userEmail: string
  familyName: string
  members: FamilyMember[]
  isAdmin?: boolean
  initialMedReminders?: boolean
  initialMorningSummary?: boolean
  appVersion?: string
}

type SheetMode =
  | null
  | { type: 'edit_account' }
  | { type: 'add_member' }
  | { type: 'edit_member'; member: FamilyMember }

export default function AjustesView({
  familyId,
  userName,
  userEmail,
  familyName,
  members,
  isAdmin = false,
  initialMedReminders = true,
  initialMorningSummary = true,
  appVersion = '1.2.0',
}: AjustesViewProps) {
  const [sheet, setSheet] = useState<SheetMode>(null)
  const [isPending, startTransition] = useTransition()

  // Estados locales para los Toggles de Preferencias
  const [medReminders, setMedReminders] = useState<boolean>(initialMedReminders)
  const [morningSummary, setMorningSummary] = useState<boolean>(initialMorningSummary)

  // Estados para Editar Perfil / Cuenta
  const [accountName, setAccountName] = useState(userName)
  const [accountEmail, setAccountEmail] = useState(userEmail)
  const [currentFamilyName, setCurrentFamilyName] = useState(familyName)

  // Estados para Integrantes
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('Hijo')
  const [memberType, setMemberType] = useState('child')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberError, setMemberError] = useState('')
  const [notice, setNotice] = useState('')

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  const handleToggleMedReminders = () => {
    const nextVal = !medReminders
    setMedReminders(nextVal)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('medReminders', String(nextVal))
      fd.append('morningSummary', String(morningSummary))
      await updatePreferences(fd)
    })
  }

  const handleToggleMorningSummary = () => {
    const nextVal = !morningSummary
    setMorningSummary(nextVal)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('medReminders', String(medReminders))
      fd.append('morningSummary', String(nextVal))
      await updatePreferences(fd)
    })
  }

  const openAccountEdit = () => {
    setAccountName(userName)
    setAccountEmail(userEmail)
    setCurrentFamilyName(familyName)
    setSheet({ type: 'edit_account' })
  }

  const openAddMember = () => {
    setMemberName('')
    setMemberRole('Hijo')
    setMemberType('child')
    setMemberEmail('')
    setMemberError('')
    setSheet({ type: 'add_member' })
  }

  const openEditMember = (m: FamilyMember) => {
    setMemberName(m.name)
    setMemberRole(m.role)
    setMemberType(m.type)
    setMemberEmail('')
    setMemberError('')
    setSheet({ type: 'edit_member', member: m })
  }

  const closeSheet = () => setSheet(null)

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

      {/* 2. SECCIÓN: TU CUENTA */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#F76911]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h2 className="text-base font-bold text-white tracking-tight m-0">Tu Cuenta</h2>
        </div>

        <div className="p-4 rounded-[20px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#F76911] text-white flex items-center justify-center font-bold text-base shadow-md shrink-0">
              {userName.slice(0, 2).toUpperCase()}
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
            className="text-sm font-bold text-[#F76911] hover:text-[#F2A957] transition-colors p-1 cursor-pointer"
          >
            Editar
          </button>
        </div>
      </section>

      {/* 3. SECCIÓN: INTEGRANTES DEL HOGAR */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#F76911]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <h2 className="text-base font-bold text-white tracking-tight m-0">Integrantes del hogar</h2>
        </div>

        <div className="flex flex-col gap-1">
          {members.length === 0 ? (
            <div className="p-8 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 text-center text-neutral-400 text-xs">
              Aún no has agregado integrantes. Pulsa el botón de abajo para registrar uno.
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="py-3 flex items-center justify-between border-b border-neutral-800/40"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F76911] to-[#F2A957] flex items-center justify-center font-bold text-white text-sm shadow">
                    {member.type === 'pet' ? '🐾' : member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white leading-snug">{member.name}</span>
                    <span className="text-xs text-neutral-400 font-medium capitalize">
                      {member.role || 'Integrante'}
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openEditMember(member)}
                    className="text-sm font-bold text-[#F76911] hover:text-[#F2A957] transition-colors p-1 cursor-pointer"
                  >
                    Editar
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {notice && (
          <div
            role="status"
            className="p-3 rounded-2xl bg-[#1f1a14] border border-[#F76911]/30 text-[#F2A957] text-xs font-semibold flex items-start justify-between gap-2"
          >
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} className="text-neutral-400 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {isAdmin ? (
          <button
            type="button"
            onClick={openAddMember}
            style={cardGradientStyle}
            className="w-full py-4 mt-2 rounded-[20px] font-black text-sm text-white shadow-[0_4px_16px_rgba(247,105,17,0.3)] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
          >
            <span className="text-lg leading-none">+</span>
            <span>Añadir integrante</span>
          </button>
        ) : (
          <p className="text-[11px] text-neutral-500 text-center m-0">
            Solo el administrador de la familia puede añadir o editar integrantes.
          </p>
        )}
      </section>

      {/* 4. SECCIÓN: PREFERENCIAS CON TOGGLES */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#F76911]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h2 className="text-base font-bold text-white tracking-tight m-0">Preferencias</h2>
        </div>

        <div className="p-4 rounded-[20px] bg-[#1a1a1a] border border-neutral-800/80 flex flex-col gap-4">
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/60 pb-3">
            <div className="pr-4">
              <p className="text-sm font-bold text-white leading-tight m-0">Recordatorios de Medicinas</p>
              <p className="text-xs text-neutral-400 mt-0.5 m-0">Avisos según dosis programadas</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={medReminders}
              onClick={handleToggleMedReminders}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                medReminders ? 'bg-[#F76911]' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  medReminders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="pr-4">
              <p className="text-sm font-bold text-white leading-tight m-0">Resumen Matutino</p>
              <p className="text-xs text-neutral-400 mt-0.5 m-0">Tareas y eventos escolares a las 08:00</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={morningSummary}
              onClick={handleToggleMorningSummary}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                morningSummary ? 'bg-[#F76911]' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  morningSummary ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 5. HISTORIAL DE CAMBIOS Y AUDITORÍA PARA LA IA */}
      <section className="flex flex-col gap-2">
        <LogPanel familyId={familyId} />
      </section>

      {/* 6. CERRAR SESIÓN */}
      <section className="pt-2">
        <form
          action={async () => {
            await purgeAllUserDataAndCache()
            await unsubscribeCurrentPush()
            await signOut()
          }}
        >
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-[#201212] border border-red-900/40 text-red-400 hover:text-red-300 hover:bg-[#2c1616] font-bold text-sm transition-colors active:scale-[0.98] cursor-pointer"
          >
            Cerrar sesión
          </button>
        </form>
      </section>

      {/* 7. VERSIÓN DE LA APP */}
      <footer className="pt-4 pb-2 flex flex-col items-center justify-center gap-1 text-center">
        <p className="text-xs font-semibold text-neutral-500 tracking-wide m-0">
          Casa APP - Versión {appVersion}
        </p>
        <p className="text-[10px] text-neutral-600 font-medium m-0">
          Diseñado para el día a día familiar
        </p>
      </footer>

      {/* 8. BOTTOM SHEET UNIFICADO */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={closeSheet} />

          <div className="relative w-full max-w-[402px] bg-[#1a1a1a] rounded-t-[28px] border-t border-neutral-800 p-6 flex flex-col gap-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto shrink-0" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white m-0">
                  {sheet.type === 'edit_account'
                    ? 'Editar Cuenta y Familia'
                    : sheet.type === 'add_member'
                    ? 'Añadir integrante'
                    : 'Editar integrante'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5 m-0">
                  {sheet.type === 'edit_account'
                    ? 'Actualiza tus datos de acceso y el nombre de tu hogar.'
                    : 'Configura el nombre y el rol en la familia.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeSheet}
                className="w-8 h-8 rounded-full bg-[#242424] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulario Editar Cuenta */}
            {sheet.type === 'edit_account' && (
              <form
                action={async (formData) => {
                  await updateAccount(formData)
                  closeSheet()
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
                    placeholder="Ej. Tu nombre o apodo"
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
                    placeholder="Ej. Mi Familia o Casa"
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
                    onClick={closeSheet}
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
            )}

            {/* Formulario Añadir o Editar Integrante */}
            {(sheet.type === 'add_member' || sheet.type === 'edit_member') && (
              <form
                action={async (formData) => {
                  setMemberError('')
                  const res =
                    sheet.type === 'add_member'
                      ? await addFamilyMember(formData)
                      : await updateFamilyMember(formData)
                  if (!res.ok) return setMemberError(res.error || 'No se pudo guardar.')
                  setNotice(res.message || '')
                  closeSheet()
                }}
                className="flex flex-col gap-3.5"
              >
                {sheet.type === 'edit_member' && (
                  <input type="hidden" name="memberId" value={sheet.member.id} />
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-300">Nombre del integrante</label>
                  <input
                    name="name"
                    type="text"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Ej. Lucas, Valentina, Firulais..."
                    autoFocus
                    required
                    className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-300">Rol familiar</label>
                    <input
                      name="role"
                      type="text"
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      placeholder="Ej. Hijo, Pareja, Mascota"
                      required
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-300">Tipo</label>
                    <select
                      name="type"
                      value={memberType}
                      onChange={(e) => setMemberType(e.target.value)}
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-3 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                    >
                      <option value="child">Hijo / Estudiante</option>
                      <option value="adult">Adulto / Tutor</option>
                      <option value="pet">Mascota 🐾</option>
                    </select>
                  </div>
                </div>

                {/* Adulto: correo para invitarlo como editor (obligatorio al añadir, opcional al editar) */}
                {memberType === 'adult' && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="member-email" className="text-xs font-bold text-neutral-300">
                      {sheet.type === 'add_member' ? 'Correo electrónico' : 'Invitar con correo (opcional)'}
                    </label>
                    <input
                      id="member-email"
                      name="email"
                      type="email"
                      autoComplete="off"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      required={sheet.type === 'add_member'}
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                    />
                    <span className="text-[11px] text-neutral-500 leading-snug">
                      Le enviaremos una invitación. Entrará con este correo como <b className="text-neutral-300">editor</b>:
                      podrá añadir medicinas, tareas, súper, feria y colegio, pero no integrantes.
                    </span>
                  </div>
                )}

                {memberError && (
                  <p className="text-xs font-semibold text-red-400 m-0">{memberError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="flex-1 py-3.5 rounded-2xl bg-[#242424] text-neutral-300 font-bold text-sm active:scale-95 transition-transform cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={cardGradientStyle}
                    className="flex-[2] py-3.5 rounded-2xl text-white font-bold text-sm active:scale-95 transition-transform shadow-md cursor-pointer"
                  >
                    {sheet.type === 'add_member' ? '+ Guardar' : 'Actualizar'}
                  </button>
                </div>
              </form>
            )}

            {/* Eliminar integrante al editar */}
            {sheet.type === 'edit_member' && (
              <form
                action={async (formData) => {
                  await deleteFamilyMember(formData)
                  closeSheet()
                }}
                className="pt-1 border-t border-neutral-800/60"
              >
                <input type="hidden" name="memberId" value={sheet.member.id} />
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-[#2a1616] text-red-400 font-bold text-xs hover:bg-[#381a1a] transition-colors cursor-pointer"
                >
                  Eliminar este integrante
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}