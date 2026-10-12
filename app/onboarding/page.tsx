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

  return (
    <main>
      <h1 style={{ margin: '48px 0 8px' }}>Crea tu familia</h1>
      <p className="muted" style={{ marginBottom: 32 }}>
        Quedarás como administrador. Si te invitaron, entra con el mismo correo de la invitación y verás tu familia automáticamente.
      </p>
      <form action={create}>
        <div className="field">
          <label htmlFor="family">Nombre de la familia</label>
          <input id="family" name="family" required />
        </div>
        <div className="field">
          <label htmlFor="name">Tu nombre</label>
          <input id="name" name="name" required />
        </div>
        <button className="btn">Crear familia</button>
      </form>
    </main>
  )
}
