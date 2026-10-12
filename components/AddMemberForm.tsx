'use client'

import { useState } from 'react'
import { addFamilyMember } from '@/app/actions/members'

export function AddMemberForm() {
  const [role, setRole] = useState('hijo')
  const requiresEmail = role === 'adulto' || role === 'familiar'

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  return (
    <form
      action={async (formData) => {
        await addFamilyMember(formData)
        const form = document.getElementById('add-member-form') as HTMLFormElement
        form?.reset()
        setRole('hijo')
      }}
      id="add-member-form"
      className="p-4 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 flex flex-col gap-3.5"
    >
      <h3 className="text-sm font-bold text-white">Añadir integrante o mascota</h3>

      {/* Nombre */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs text-neutral-300 font-medium">Nombre</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder={role === 'mascota' ? 'Ej. Firulais, Pelusa...' : 'Ej. Nombre del integrante'}
          required
          className="w-full bg-[#131313] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
        />
      </div>

      {/* Rol (sin selector de Tipo) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-xs text-neutral-300 font-medium">Parentesco o Rol</label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-[#131313] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#F76911]"
        >
          <option value="hijo">Hijo / Hija (sin correo)</option>
          <option value="mascota">Mascota (sin correo)</option>
          <option value="adulto">Adulto (requiere correo)</option>
          <option value="familiar">Familiar (requiere correo)</option>
        </select>
      </div>

      {/* Correo condicional */}
      {requiresEmail && (
        <div className="flex flex-col gap-1.5 transition-all">
          <label htmlFor="email" className="text-xs text-neutral-300 font-medium">
            Correo electrónico (para inicio de sesión)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="correo@ejemplo.com"
            required={requiresEmail}
            className="w-full bg-[#131313] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
          />
        </div>
      )}

      <button
        type="submit"
        style={cardGradientStyle}
        className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-transform active:scale-[0.98] shadow-md mt-1"
      >
        + Guardar integrante
      </button>
    </form>
  )
}