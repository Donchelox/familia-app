import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Onboarding() {
  async function create(fd: FormData) {
    'use server'
    const supabase = await createClient()
    const { error } = await supabase.rpc('create_family', {
      fname: String(fd.get('family')).trim(),
      dname: String(fd.get('name')).trim(),
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
              Crea tu familia
            </h1>
            <p className="text-xs text-neutral-400 mt-1.5 font-medium leading-relaxed max-w-[320px]">
              Quedarás como administrador principal. Podrás invitar y gestionar integrantes más adelante.
            </p>
          </div>
        </header>

        {/* FORMULARIO EN CARD ELEVADA */}
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

        {/* NOTA AL PIE DE PÁGINA */}
        <footer className="text-center px-4">
          <p className="text-[11px] text-neutral-500 leading-relaxed font-medium m-0">
            ¿Te invitaron? Inicia sesión con el mismo correo de tu invitación para vincularte automáticamente.
          </p>
        </footer>

      </div>
    </div>
  )
}