// Lógica pura (sin base de datos) de los recordatorios repetidos de medicamentos.
// La usa app/api/cron/medications/route.ts, que la ejecuta cada minuto.
//
// Regla: primer aviso a la hora programada; si no se marca como tomada, se repite cada
// REMINDER_INTERVAL_MIN minutos hasta REMINDER_WINDOW_MIN minutos después del primer aviso.

export const REMINDER_INTERVAL_MIN = 5
export const REMINDER_WINDOW_MIN = 120
/** Si el cron no pudo correr justo a la hora, aún se inicia la serie hasta este atraso (min). */
export const START_GRACE_MIN = 10

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export interface MedRow {
  id: string
  name: string
  dose: string | null
  person: string | null
  family_id: string
  times: string[] | null
  frequency: string | null
  end_date: string | null
}

export interface ReminderRow {
  medication_id: string
  time: string
  first_sent_at: string
  last_slot: number
}

export interface PlannedReminder {
  med: MedRow
  time: string
  kind: 'first' | 'repeat'
  slot: number
  minutesLate: number
}

import { isMedicationScheduledForDay } from '@/lib/dates'

const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

/** ¿Toca tomar este medicamento hoy? (frecuencia + fecha de término). isoWeekday: 1 = lunes … 7 = domingo */
export function runsToday(med: Pick<MedRow, 'frequency' | 'end_date'>, day: string, isoWeekday: number): boolean {
  return isMedicationScheduledForDay(med, day, isoWeekday)
}

/**
 * Decide qué avisos corresponden en este instante. No toca la base de datos.
 * Las claves de `taken` y `reminders` son `${medication_id}|${HH:MM}` (todo referido al día de hoy en Chile).
 */
export function planReminders(opts: {
  meds: MedRow[]
  day: string
  isoWeekday: number
  nowMs: number
  nowHM: string
  taken: Set<string>
  reminders: Map<string, ReminderRow>
  pushFamilies: Set<string>
  familyIntervals?: Map<string, number>
}): PlannedReminder[] {
  const { meds, day, isoWeekday, nowMs, nowHM, taken, reminders, pushFamilies, familyIntervals } = opts
  const nowMin = toMin(nowHM)
  const nowIdx = Math.floor(nowMs / 60000) // minuto absoluto: evita que los segundos alarguen el intervalo a 6 min
  const out: PlannedReminder[] = []

  for (const med of meds) {
    if (!pushFamilies.has(med.family_id)) continue
    if (!runsToday(med, day, isoWeekday)) continue
    // "Según necesidad" no es una dosis agendada: solo se avisa una vez, sin insistir
    const repeats = (med.frequency || 'daily') !== 'as_needed'
    const intervalMin = familyIntervals?.get(med.family_id) || REMINDER_INTERVAL_MIN

    for (const rawTime of med.times ?? []) {
      const time = String(rawTime).slice(0, 5)
      if (!TIME_RE.test(time)) continue
      const key = `${med.id}|${time}`
      if (taken.has(key)) continue

      const late = nowMin - toMin(time)
      const rec = reminders.get(key)

      if (!rec) {
        // Primer aviso: a la hora programada o dentro de la ventana activa (hasta 120 min) si el cron se atrasó
        if (late >= 0 && late <= REMINDER_WINDOW_MIN) {
          out.push({ med, time, kind: 'first', slot: 0, minutesLate: late })
        }
        continue
      }

      if (!repeats) continue
      const elapsed = nowIdx - Math.floor(Date.parse(rec.first_sent_at) / 60000)
      if (elapsed > REMINDER_WINDOW_MIN) continue // pasaron 2 h desde el primer aviso
      const slot = Math.floor(elapsed / intervalMin)
      if (slot > rec.last_slot) {
        out.push({ med, time, kind: 'repeat', slot, minutesLate: Math.max(late, 0) })
      }
    }
  }
  return out
}
