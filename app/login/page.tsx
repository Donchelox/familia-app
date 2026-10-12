'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (error) return setError('No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.')
    setStep('code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) return setError('El código no es válido o venció. Pide uno nuevo.')
    router.replace('/')
    router.refresh()
  }

  return (
    <main>
      <h1 style={{ margin: '48px 0 8px' }}>Casa</h1>
      <p className="muted" style={{ marginBottom: 32 }}>
        {step === 'email' ? 'Ingresa tu correo y te enviaremos un código de 6 dígitos.' : `Enviamos un código a ${email}.`}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {step === 'email' ? (
        <form onSubmit={sendCode}>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>Enviar código</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <div className="field">
            <label htmlFor="code">Código</label>
            <input id="code" className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="inline">
            <button className="btn" disabled={busy}>Entrar</button>
            <button type="button" className="btn ghost" onClick={() => { setStep('email'); setCode(''); setError('') }}>Cambiar correo</button>
          </div>
        </form>
      )}
    </main>
  )
}
