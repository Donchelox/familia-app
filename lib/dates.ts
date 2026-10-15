export const TZ = 'America/Santiago'
export const todayStr = () => new Date().toLocaleDateString('sv', { timeZone: TZ })
export const nowHHMM = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
/** 1 = lunes … 7 = domingo */
export const weekday = (d?: string) => {
  const dateStr = d || todayStr()
  return new Date(dateStr + 'T12:00:00Z').getUTCDay() || 7
}
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

/**
 * Determina con precisión si un medicamento debe tomarse en una fecha determinada.
 * Evalúa fecha de fin y frecuencia (diaria, días específicos "days:1,3,5", semana "weekdays", finde "weekends", o SOS "as_needed").
 */
export function isMedicationScheduledForDay(
  med: {
    frequency?: string | null
    end_date?: string | null
  },
  dayStr?: string,
  isoWeekdayNum?: number
): boolean {
  const day = dayStr || todayStr()
  const isoDay = isoWeekdayNum ?? weekday(day)

  // 1. Si el tratamiento finalizó antes de este día, ya no corresponde
  if (med.end_date && med.end_date < day) {
    return false
  }

  const freq = (med.frequency || 'daily').trim()

  // 2. SOS / Según necesidad: no es una toma programada fija para hoy
  if (freq === 'as_needed' || freq === 'sos') {
    return false
  }

  // 3. Días de semana (Lunes a Viernes: 1..5)
  if (freq === 'weekdays') {
    return isoDay >= 1 && isoDay <= 5
  }

  // 4. Fines de semana (Sábado y Domingo: 6..7)
  if (freq === 'weekends') {
    return isoDay >= 6 && isoDay <= 7
  }

  // 5. Días específicos seleccionados (ej: "days:1,3,5" para Lunes, Miércoles, Viernes)
  if (freq.startsWith('days:')) {
    const allowedDays = freq
      .slice(5)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n))
    return allowedDays.includes(isoDay)
  }

  // 6. 'daily', 'every_8h', 'every_12h', etc.: corresponden todos los días
  return true
}
