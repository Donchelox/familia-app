'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateErrorMessage } from '@/lib/formatErrors'
import { purgeAllUserDataAndCache } from '@/lib/offline/clientSync'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyMessage, setBusyMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Al llegar a la pantalla de login, asegurar que no queden datos cacheados de sesiones anteriores
  useEffect(() => {
    purgeAllUserDataAndCache().catch(() => {})
  }, [])

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setBusyMessage('Enviando código...')
    setError('')
    
    const cleanEmail = email.trim().toLowerCase()
    
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
    })
    
    setBusy(false)
    setBusyMessage('')
    if (error) {
      console.error('Error Supabase OTP:', error)
      return setError(translateErrorMessage(error))
    }
    setStep('code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setBusyMessage('Verificando código...')
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })

    if (error) {
      setBusy(false)
      setBusyMessage('')
      return setError(translateErrorMessage(error))
    }

    // Código válido: mantener estado de carga y feedback de éxito antes de entrar
    setIsSuccess(true)
    setBusyMessage('¡Código verificado! Entrando a tu hogar...')
    // Redirigir de inmediato al dashboard
    window.location.href = '/'
  }

  return (
    <div className="w-full min-h-[calc(100vh-40px)] flex flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-[380px] flex flex-col gap-6">

        {/* LOGO E IDENTIFICADOR */}
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0">Casa</h1>
            <p className="text-xs text-neutral-400 mt-1 font-medium leading-relaxed max-w-[280px]">
              {step === 'email'
                ? 'Ingresa tu correo y te enviaremos un código de 6 dígitos.'
                : `Ingresa el código que enviamos a ${email}`}
            </p>
          </div>
        </header>

        {/* ALERTA DE ERROR */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-[#261313] border border-red-900/50 text-red-300 text-xs font-semibold leading-snug flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* TARJETA DEL FORMULARIO */}
        <section className="p-6 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-2xl flex flex-col gap-4">
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <svg className="w-8 h-8 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <h3 className="text-base font-black text-white m-0">¡Acceso verificado!</h3>
                <p className="text-xs text-neutral-400 m-0">Entrando a tu hogar...</p>
              </div>
              <div className="w-5 h-5 border-2 border-[#F76911] border-t-transparent rounded-full animate-spin mt-2" />
            </div>
          ) : step === 'email' ? (
            <form onSubmit={sendCode} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-bold text-neutral-300">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={busy}
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911] transition-colors disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                style={orangeGradient}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-[0_4px_16px_rgba(247,105,17,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{busyMessage || 'Enviando...'}</span>
                  </>
                ) : (
                  'Enviar código'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="code" className="text-xs font-bold text-neutral-300">
                  Código de 6 dígitos
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                  disabled={busy}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3.5 text-center tracking-[0.35em] text-lg font-black text-white placeholder-neutral-600 focus:outline-none focus:border-[#F76911] transition-colors disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  style={orangeGradient}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-[0_4px_16px_rgba(247,105,17,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{busyMessage || 'Verificando...'}</span>
                    </>
                  ) : (
                    'Entrar'
                  )}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep('email')
                    setCode('')
                    setError('')
                  }}
                  className="w-full py-3 rounded-2xl bg-[#242424] text-neutral-300 hover:text-white font-bold text-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
                >
                  Cambiar correo
                </button>
              </div>
            </form>
          )}
        </section>

        {/* PIE DE PÁGINA */}
        <footer className="text-center">
          <p className="text-[11px] text-neutral-500 font-medium m-0">
            Acceso seguro sin contraseñas
          </p>
        </footer>

      </div>
    </div>
  )
}