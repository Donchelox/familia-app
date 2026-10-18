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

export interface PushSubscriptionItem {
  id: string
  user_id: string
  family_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface FamilyMemberInfo {
  id: string
  family_id: string
  name: string
  type: string // 'adult' | 'child' | 'pet'
  role?: string
  user_id?: string | null
}

export interface HouseMemberInfo {
  family_id: string
  user_id: string
  display_name?: string | null
  role?: string
}

export interface UserAuthMeta {
  name?: string
  fullName?: string
  email?: string
}

function isChildMember(fm?: FamilyMemberInfo | null, name?: string): boolean {
  if (!fm && !name) return false
  if (fm?.type === 'child') return true
  const role = (fm?.role || '').toLowerCase()
  const n = (name || fm?.name || '').toLowerCase()
  const childKeywords = ['hijo', 'hija', 'niño', 'niña', 'nino', 'nina', 'bebe', 'bebé', 'baby', 'infantil']
  return childKeywords.some((k) => role.includes(k) || n.includes(k))
}

function isPetMember(fm?: FamilyMemberInfo | null, name?: string): boolean {
  if (!fm && !name) return false
  if (fm?.type === 'pet') return true
  const role = (fm?.role || '').toLowerCase()
  const n = (name || fm?.name || '').toLowerCase()
  const petKeywords = ['mascota', 'perro', 'perra', 'gato', 'gata', 'conejo', 'can', 'felino']
  return petKeywords.some((k) => role.includes(k) || n.includes(k))
}

function isAdultMember(fm?: FamilyMemberInfo | null, name?: string): boolean {
  if (!fm && !name) return false
  if (fm?.type === 'adult') return true
  const role = (fm?.role || '').toLowerCase()
  const n = (name || fm?.name || '').toLowerCase()
  const adultKeywords = ['padre', 'madre', 'papá', 'papa', 'mamá', 'mama', 'adulto', 'adulta', 'abuelo', 'abuela', 'tío', 'tia', 'tía']
  return adultKeywords.some((k) => role.includes(k) || n.includes(k))
}

/**
 * Filtra las suscripciones push según las reglas de negocio de la familia:
 * - Si el medicamento está asignado a un adulto X: se notifica ÚNICAMENTE a ese adulto X (a los demás adultos NO se les envía).
 * - Si el medicamento es para un niño o mascota: se notifica a TODOS los adultos del hogar.
 */
export function filterSubscriptionsForMedication(opts: {
  med: MedRow
  subs: PushSubscriptionItem[]
  familyMembers: FamilyMemberInfo[]
  houseMembers: HouseMemberInfo[]
  userMetaMap?: Map<string, UserAuthMeta>
}): PushSubscriptionItem[] {
  const { med, subs, familyMembers, houseMembers, userMetaMap } = opts

  // 1. Filtrar suscripciones de esta familia
  const famSubs = subs.filter((s) => s.family_id === med.family_id)
  if (famSubs.length === 0) return []

  const famFms = familyMembers.filter((fm) => fm.family_id === med.family_id)
  const famHouseMembers = houseMembers.filter((m) => m.family_id === med.family_id)

  // 2. Identificar a TODOS los adultos de la familia
  const nonAdultUserIds = new Set(
    famFms
      .filter((fm) => fm.user_id && (isChildMember(fm) || isPetMember(fm)))
      .map((fm) => fm.user_id as string)
  )

  const allAdultUserIds = new Set(
    famHouseMembers
      .map((m) => m.user_id)
      .filter((uid) => !nonAdultUserIds.has(uid))
  )

  for (const fm of famFms) {
    if (fm.user_id && (fm.type === 'adult' || isAdultMember(fm))) {
      allAdultUserIds.add(fm.user_id)
    }
  }

  // Suscripciones que pertenecen a adultos de la familia
  const allAdultSubs = famSubs.filter((s) => allAdultUserIds.has(s.user_id))
  const fallbackAllAdultSubs = allAdultSubs.length > 0 ? allAdultSubs : famSubs

  // 3. Evaluar destinatario (person)
  const rawPerson = (med.person || '').trim()
  if (!rawPerson || rawPerson.toLowerCase() === 'general' || rawPerson.toLowerCase() === 'toda la familia') {
    return fallbackAllAdultSubs
  }

  // Soportar 1 o múltiples personas separadas por coma
  const targetNames = rawPerson
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (targetNames.length === 0) {
    return fallbackAllAdultSubs
  }

  let hasChildOrPet = false
  let isAssignedToAdult = false
  const matchedAdultUserIds = new Set<string>()

  for (const name of targetNames) {
    // A) ¿Coincide con algún integrante en family_members?
    const fm = famFms.find(
      (f) =>
        f.name?.trim().toLowerCase() === name ||
        (f.role && f.role.trim().toLowerCase() === name)
    )

    if (fm) {
      if (isChildMember(fm, name) || isPetMember(fm, name)) {
        hasChildOrPet = true
        break
      } else if (fm.type === 'adult' || isAdultMember(fm, name)) {
        isAssignedToAdult = true
        let uid = fm.user_id

        if (!uid) {
          const hm = famHouseMembers.find(
            (h) => h.display_name?.trim().toLowerCase() === name ||
                   h.display_name?.trim().toLowerCase() === fm.name.trim().toLowerCase()
          )
          if (hm) uid = hm.user_id
        }

        if (!uid && userMetaMap) {
          for (const [userId, meta] of userMetaMap.entries()) {
            const uName = meta.name?.trim().toLowerCase()
            const uFull = meta.fullName?.trim().toLowerCase()
            const emailPrefix = meta.email?.split('@')[0].toLowerCase()

            if (
              uName === name ||
              uFull === name ||
              emailPrefix === name ||
              uName === fm.name.trim().toLowerCase() ||
              uFull === fm.name.trim().toLowerCase()
            ) {
              uid = userId
              break
            }
          }
        }

        // Si solo hay un adulto registrado en la casa y este es el integrante adulto
        if (!uid && famHouseMembers.length === 1) {
          uid = famHouseMembers[0].user_id
        }

        if (uid) {
          matchedAdultUserIds.add(uid)
        }
      }
    } else {
      // B) No está en family_members con ese nombre exacto: verificar si es niño/mascota por nombre o término
      if (isChildMember(null, name) || isPetMember(null, name)) {
        hasChildOrPet = true
        break
      }

      // C) Verificar si coincide directamente con una cuenta de usuario adulto en houseMembers o userMetaMap
      const hm = famHouseMembers.find(
        (h) => h.display_name?.trim().toLowerCase() === name
      )
      if (hm) {
        isAssignedToAdult = true
        matchedAdultUserIds.add(hm.user_id)
      } else if (userMetaMap) {
        for (const [userId, meta] of userMetaMap.entries()) {
          const uName = meta.name?.trim().toLowerCase()
          const uFull = meta.fullName?.trim().toLowerCase()
          const emailPrefix = meta.email?.split('@')[0].toLowerCase()

          if (uName === name || uFull === name || emailPrefix === name) {
            isAssignedToAdult = true
            matchedAdultUserIds.add(userId)
            break
          }
        }
      }
    }
  }

  // REGLA 1: Si la medicina es para un niño o mascota:
  // Se notifica a TODOS los integrantes adultos de la familia
  if (hasChildOrPet) {
    return fallbackAllAdultSubs
  }

  // REGLA 2: Si la medicina está asignada a un integrante adulto X:
  // A los demás adultos NO se les debe enviar la notificación push, SOLAMENTE debe llegarle al integrante X
  if (isAssignedToAdult || matchedAdultUserIds.size > 0) {
    if (matchedAdultUserIds.size > 0) {
      // Filtrar estrictamente solo las suscripciones del integrante X asignado
      return famSubs.filter((s) => matchedAdultUserIds.has(s.user_id))
    }
    // Si era un adulto pero no tiene suscripciones o dispositivo vinculado,
    // a los demás adultos NO se les envía la notificación push.
    return []
  }

  // REGLA 3: Si no coincide con ningún integrante específico (ej. "General"):
  // Se envía a los adultos del hogar
  return fallbackAllAdultSubs
}
