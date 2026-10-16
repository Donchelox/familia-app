'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import {
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  type MemberActionResult,
} from '@/app/actions/members'
import { cancelInvite } from '@/app/actions/family'

export type FamilyMember = {
  id: string
  name: string
  role: string
  type: string
}

export type FamilyInvite = {
  id: string
  email: string
  role: string
  created_at?: string
}

interface IntegrantesViewProps {
  familyId: string
  members: FamilyMember[]
  invites: FamilyInvite[]
  isAdmin?: boolean
}

type SheetMode =
  | null
  | { type: 'add_member' }
  | { type: 'edit_member'; member: FamilyMember }

export default function IntegrantesView({
  familyId,
  members,
  invites,
  isAdmin = false,
}: IntegrantesViewProps) {
  const [sheet, setSheet] = useState<SheetMode>(null)
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('Hijo')
  const [memberType, setMemberType] = useState('child')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberError, setMemberError] = useState('')
  const [notice, setNotice] = useState('')
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null)

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
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

  const handleCopyInviteLink = (email: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/login?inviteEmail=${encodeURIComponent(email)}`
    navigator.clipboard.writeText(link)
    setCopiedInvite(email)
    setTimeout(() => setCopiedInvite(null), 3000)
  }

  return (
    <div className="w-full flex flex-col gap-6 relative min-h-[calc(100vh-80px)] pb-16 select-none">
      {/* 1. HEADER */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/ajustes"
            aria-label="Volver a ajustes"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer no-underline"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0">Integrantes</h1>
            <p className="text-xs text-neutral-400 font-medium m-0">Gestión de la familia y accesos</p>
          </div>
        </div>

        <NotificationBell />
      </header>

      {/* 2. MENSAJES DE NOTIFICACIÓN */}
      {notice && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-[#1f1a14] border border-[#F76911]/30 text-[#F2A957] text-xs font-semibold flex items-start justify-between gap-2 shadow-sm"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-neutral-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 3. LISTADO DE MIEMBROS */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Miembros del hogar</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
              {members.length}
            </span>
          </div>
        </div>

        <div className="rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 p-2 divide-y divide-neutral-800/50 shadow-md">
          {members.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 text-xs">
              Aún no has registrado integrantes. Pulsa el botón de abajo para añadir uno.
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="p-3.5 flex items-center justify-between hover:bg-neutral-800/30 transition-colors rounded-2xl"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#F76911] to-[#F2A957] flex items-center justify-center font-bold text-white text-sm shadow shrink-0">
                    {member.type === 'pet' ? '🐾' : member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white leading-snug">{member.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-neutral-400 font-medium capitalize">
                        {member.role || 'Integrante'}
                      </span>
                      {member.type === 'pet' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950/40 text-amber-400 border border-amber-900/40">
                          Mascota
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openEditMember(member)}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-[#F76911] hover:text-[#F2A957] hover:border-neutral-700 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
                  >
                    Editar
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Botón Añadir Integrante */}
        {isAdmin ? (
          <button
            type="button"
            onClick={openAddMember}
            style={cardGradientStyle}
            className="w-full py-4 mt-1 rounded-[20px] font-black text-sm text-white shadow-[0_4px_16px_rgba(247,105,17,0.3)] flex items-center justify-center gap-2 hover:scale-[1.01] hover:shadow-[0_6px_22px_rgba(247,105,17,0.5)] active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            <span className="text-lg leading-none">+</span>
            <span>Añadir integrante</span>
          </button>
        ) : (
          <p className="text-[11px] text-neutral-500 text-center m-0">
            Solo el administrador puede añadir o modificar integrantes.
          </p>
        )}
      </section>

      {/* 4. INVITACIONES PENDIENTES */}
      {invites.length > 0 && (
        <section className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Invitaciones pendientes ({invites.length})
            </span>
          </div>

          <div className="rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 p-2 divide-y divide-neutral-800/50 shadow-md">
            {invites.map((inv) => (
              <div key={inv.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate">{inv.email}</span>
                  <span className="text-[11px] text-[#F2A957] font-medium">
                    Rol: {inv.role === 'admin' ? 'Administrador' : inv.role === 'editor' ? 'Editor' : 'Lector'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyInviteLink(inv.email)}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer shadow-sm"
                  >
                    {copiedInvite === inv.email ? '✓ Copiado' : '🔗 Copiar link'}
                  </button>

                  {isAdmin && (
                    <form action={cancelInvite}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="text-xs font-bold px-2 py-1.5 rounded-xl text-red-400 hover:text-red-300 hover:scale-110 active:scale-90 transition-all duration-150 cursor-pointer"
                        title="Cancelar invitación"
                      >
                        ✕
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. BOTTOM SHEET AÑADIR / EDITAR INTEGRANTE */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={closeSheet} />

          <div className="relative w-full max-w-[402px] bg-[#1a1a1a] rounded-t-[28px] border-t border-neutral-800 p-6 flex flex-col gap-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto shrink-0" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white m-0">
                  {sheet.type === 'add_member' ? 'Añadir integrante' : 'Editar integrante'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5 m-0">
                  Configura el nombre y el rol en la familia.
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

            <form
              action={async (formData) => {
                setMemberError('')
                const res =
                  sheet.type === 'add_member'
                    ? await addFamilyMember(formData)
                    : await updateFamilyMember(formData)
                if (res?.error) {
                  setMemberError(res.error)
                  return
                }
                if (res?.message) {
                  setNotice(res.message)
                }
                closeSheet()
              }}
              className="flex flex-col gap-3.5"
            >
              {sheet.type === 'edit_member' && (
                <input type="hidden" name="memberId" value={sheet.member.id} />
              )}

              {memberError && (
                <div role="alert" className="p-3 rounded-2xl bg-red-950/40 border border-red-900 text-red-300 text-xs font-semibold">
                  {memberError}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">Nombre del integrante</label>
                <input
                  name="name"
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Ej. Mamá, Papá, Hijo..."
                  required
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'adult', label: 'Adulto', emoji: '👤' },
                    { id: 'child', label: 'Niño/a', emoji: '🧒' },
                    { id: 'pet', label: 'Mascota', emoji: '🐾' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMemberType(t.id)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
                        memberType === t.id
                          ? 'bg-[#F76911]/20 border-[#F76911] text-white shadow-sm'
                          : 'bg-[#131313] border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="text-base">{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="type" value={memberType} />
              </div>

              {memberType === 'adult' && (
                <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                  <label className="text-xs font-bold text-white flex items-center justify-between">
                    <span>Invitar a la app (correo)</span>
                    <span className="text-[10px] text-neutral-400 font-normal">
                      {sheet.type === 'edit_member' ? 'Opcional si aún no entra' : 'Requerido'}
                    </span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="familiar@ejemplo.com"
                    required={sheet.type === 'add_member'}
                    className="w-full bg-[#131313] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                  />
                  <p className="text-[11px] text-neutral-400 leading-snug m-0">
                    Se le enviará una invitación como editor para colaborar en tareas, compras y colegio.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">Rol o parentesco</label>
                <input
                  name="role"
                  type="text"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  placeholder="Ej. Papá, Mamá, Hijo mayor..."
                  required
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
                />
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
                  {sheet.type === 'add_member' ? 'Guardar' : 'Actualizar'}
                </button>
              </div>

              {sheet.type === 'edit_member' && isAdmin && (
                <div className="pt-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`¿Eliminar a ${sheet.member.name} de la familia?`)) return
                      const fd = new FormData()
                      fd.append('memberId', sheet.member.id)
                      await deleteFamilyMember(fd)
                      closeSheet()
                    }}
                    className="w-full py-2.5 text-xs text-red-400 hover:text-red-300 font-bold hover:underline cursor-pointer"
                  >
                    Eliminar integrante de la familia
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
