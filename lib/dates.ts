export const TZ = 'America/Santiago'
export const todayStr = () => new Date().toLocaleDateString('sv', { timeZone: TZ })
export const nowHHMM = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
/** 1 = lunes … 7 = domingo */
export const weekday = (d?: string) => {
  const dateStr = d || todayStr()
  return new Date(dateStr + 'T12:00:00Z').getUTCDay() || 7
}
export const diffDays = (d: string) => {
  const clean = d.includes('T') ? d.split('T')[0] : d
  return Math.round((Date.parse(clean + 'T00:00:00Z') - Date.parse(todayStr() + 'T00:00:00Z')) / 864e5)
}
export const rel = (d: string) => {
  const n = diffDays(d)
  return n < 0 ? `Hace ${-n} d` : n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`
}
export const fmtDate = (d: string) => {
  const clean = d.includes('T') ? d.split('T')[0] : d
  return new Date(clean + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })

export const addDaysStr = (baseDay: string, daysToAdd: number) => {
  const clean = baseDay.includes('T') ? baseDay.split('T')[0] : baseDay
  const d = new Date(clean + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + daysToAdd)
  return d.toISOString().split('T')[0]
}

/** Obtiene el lunes (YYYY-MM-DD) de la semana para una fecha dada */
export const getWeekMonday = (d?: string) => {
  const base = d || todayStr()
  const dayNum = weekday(base) // 1: lunes ... 7: domingo
  return addDaysStr(base, -(dayNum - 1))
}

/** Formatea rango de semana: ej. "19 al 25 de oct." */
export const formatWeekRange = (mondayStr: string) => {
  const clean = mondayStr.includes('T') ? mondayStr.split('T')[0] : mondayStr
  const sundayStr = addDaysStr(clean, 6)
  const dMon = new Date(clean + 'T12:00:00Z')
  const dSun = new Date(sundayStr + 'T12:00:00Z')
  const dayMon = dMon.getUTCDate()
  const daySun = dSun.getUTCDate()
  const monthSun = dSun.toLocaleDateString('es-CL', { month: 'short', timeZone: 'UTC' })
  return `${dayMon} al ${daySun} de ${monthSun}`
}

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

/**
 * Determina si una hora programada ya venció hoy dentro de una ventana de gracia dada (por defecto 120 min).
 * Permite que los avisos no se pierdan si el cron se retrasa unos minutos o corre cada 5-15 min.
 */
export function isTimeDueToday(targetHM: string, currentHM?: string, maxWindowMin: number = 120): boolean {
  const current = currentHM || nowHHMM()
  const [th, tm] = targetHM.split(':').map(Number)
  const [ch, cm] = current.split(':').map(Number)
  if (isNaN(th) || isNaN(tm) || isNaN(ch) || isNaN(cm)) return false
  const targetMin = th * 60 + tm
  const currentMin = ch * 60 + cm
  const diff = currentMin - targetMin
  return diff >= 0 && diff <= maxWindowMin
}
