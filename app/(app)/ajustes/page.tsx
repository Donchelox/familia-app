import Link from 'next/link'
import { getContext } from '@/lib/family'
import { addFamilyMember, deleteFamilyMember } from '@/app/actions/members'

export default async function AjustesPage() {
  const { supabase, familyId } = await getContext()

  const { data: members } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

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

        {/* Listado de integrantes */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Integrantes de la familia</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Perfiles visuales para asignar medicinas, eventos y tareas sin cuenta de usuario.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {(!members || members.length === 0) ? (
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

                  <form action={deleteFamilyMember.bind(null, member.id)}>
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
        </section>

        {/* Formulario para añadir */}
        <section>
          <form
            action={addFamilyMember}
            className="p-4 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 flex flex-col gap-3.5"
          >
            <h3 className="text-sm font-bold text-white">Añadir integrante o mascota</h3>
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs text-neutral-300 font-medium">Nombre</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Ej. Nombre del peque o mascota"
                required
                className="w-full bg-[#131313] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="role" className="text-xs text-neutral-300 font-medium">Rol / Relación</label>
                <select
                  id="role"
                  name="role"
                  className="w-full bg-[#131313] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#F76911]"
                >
                  <option value="hijo">Hijo / Hija</option>
                  <option value="mascota">Mascota</option>
                  <option value="adulto">Adulto</option>
                  <option value="familiar">Familiar</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="type" className="text-xs text-neutral-300 font-medium">Tipo</label>
                <select
                  id="type"
                  name="type"
                  className="w-full bg-[#131313] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#F76911]"
                >
                  <option value="person">Persona</option>
                  <option value="pet">Mascota</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              style={cardGradientStyle}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-transform active:scale-[0.98] shadow-md mt-1"
            >
              + Guardar integrante
            </button>
          </form>
        </section>

      </div>
    </div>
  )
}