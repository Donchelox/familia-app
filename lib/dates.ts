export const TZ = 'America/Santiago'
export const todayStr = () => new Date().toLocaleDateString('sv', { timeZone: TZ })
export const nowHHMM = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
/** 1 = lunes … 7 = domingo */
export const weekday = () => new Date(todayStr() + 'T12:00:00Z').getUTCDay() || 7
export const diffDays = (d: string) =>
  Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(todayStr() + 'T00:00:00Z')) / 864e5)
export const rel = (d: string) => {
  const n = diffDays(d)
  return n < 0 ? `Hace ${-n} d` : n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`
}
export const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })

/**
 * Determina si una prueba escolar debe mostrarse en el listado según la regla:
 * - Si su fecha es anterior a hoy: no debe mostrarse (ya pasó).
 * - Si es hoy: se borra/oculta a las 20:00 hrs (8:00 PM), cuando terminan las clases.
 * - Si es posterior a hoy: se muestra normalmente.
 */
export const isSchoolTestActive = (testDate: string, currentHHMM?: string, currentDay?: string) => {
  const day = currentDay || todayStr()
  const hm = currentHHMM || nowHHMM()
  if (testDate < day) return false
  if (testDate === day) {
    return hm < '20:00'
  }
  return true
}
