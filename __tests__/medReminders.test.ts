import { describe, it, expect } from 'vitest'
import { planReminders, type MedRow, type ReminderRow } from '@/lib/medReminders'

describe('planReminders (lib/medReminders.ts)', () => {
  const baseMed: MedRow = {
    id: 'med-1',
    name: 'Paracetamol',
    dose: '500mg',
    person: 'Familiar',
    family_id: 'fam-1',
    times: ['08:00', '16:00'],
    frequency: 'daily',
    end_date: null,
  }

  const baseOpts = {
    meds: [baseMed],
    day: '2026-10-16',
    isoWeekday: 5, // Viernes
    nowMs: Date.parse('2026-10-16T08:00:00-03:00'),
    nowHM: '08:00',
    taken: new Set<string>(),
    reminders: new Map<string, ReminderRow>(),
    pushFamilies: new Set(['fam-1']),
    familyIntervals: new Map<string, number>([['fam-1', 10]]),
  }

  it('genera primer aviso a la hora exacta (slot 0, kind "first", minutesLate 0)', () => {
    const plan = planReminders(baseOpts)
    expect(plan).toHaveLength(1)
    expect(plan[0]).toEqual({
      med: baseMed,
      time: '08:00',
      kind: 'first',
      slot: 0,
      minutesLate: 0,
    })
  })

  it('genera primer aviso tardío dentro de la ventana de 120 min si no se había enviado', () => {
    const plan = planReminders({
      ...baseOpts,
      nowHM: '08:25',
      nowMs: Date.parse('2026-10-16T08:25:00-03:00'),
    })
    expect(plan).toHaveLength(1)
    expect(plan[0]).toEqual({
      med: baseMed,
      time: '08:00',
      kind: 'first',
      slot: 0,
      minutesLate: 25,
    })
  })

  it('no genera aviso si está fuera de la ventana de 120 min (> 120 min)', () => {
    const plan = planReminders({
      ...baseOpts,
      nowHM: '10:05', // 125 min de atraso respecto a 08:00
      nowMs: Date.parse('2026-10-16T10:05:00-03:00'),
    })
    expect(plan).toHaveLength(0)
  })

  it('repite por slots respetando los intervalos configurados (5, 10, 15, 30 min)', () => {
    const firstSent = '2026-10-16T08:00:00-03:00'
    const firstSentMs = Date.parse(firstSent)

    // Test con intervalo 5 min
    const rem5 = new Map<string, ReminderRow>([
      ['med-1|08:00', { medication_id: 'med-1', time: '08:00', first_sent_at: firstSent, last_slot: 0 }],
    ])
    const plan5 = planReminders({
      ...baseOpts,
      nowHM: '08:05',
      nowMs: firstSentMs + 5 * 60000,
      reminders: rem5,
      familyIntervals: new Map([['fam-1', 5]]),
    })
    expect(plan5).toHaveLength(1)
    expect(plan5[0].kind).toBe('repeat')
    expect(plan5[0].slot).toBe(1)

    // Test con intervalo 10 min
    const rem10 = new Map<string, ReminderRow>([
      ['med-1|08:00', { medication_id: 'med-1', time: '08:00', first_sent_at: firstSent, last_slot: 0 }],
    ])
    const plan10 = planReminders({
      ...baseOpts,
      nowHM: '08:10',
      nowMs: firstSentMs + 10 * 60000,
      reminders: rem10,
      familyIntervals: new Map([['fam-1', 10]]),
    })
    expect(plan10).toHaveLength(1)
    expect(plan10[0].slot).toBe(1)

    // Test con intervalo 15 min
    const plan15 = planReminders({
      ...baseOpts,
      nowHM: '08:15',
      nowMs: firstSentMs + 15 * 60000,
      reminders: rem10,
      familyIntervals: new Map([['fam-1', 15]]),
    })
    expect(plan15).toHaveLength(1)
    expect(plan15[0].slot).toBe(1)

    // Test con intervalo 30 min (a los 15 min no debe sonar todavía)
    const plan30NotYet = planReminders({
      ...baseOpts,
      nowHM: '08:15',
      nowMs: firstSentMs + 15 * 60000,
      reminders: rem10,
      familyIntervals: new Map([['fam-1', 30]]),
    })
    expect(plan30NotYet).toHaveLength(0)

    const plan30Ready = planReminders({
      ...baseOpts,
      nowHM: '08:30',
      nowMs: firstSentMs + 30 * 60000,
      reminders: rem10,
      familyIntervals: new Map([['fam-1', 30]]),
    })
    expect(plan30Ready).toHaveLength(1)
    expect(plan30Ready[0].slot).toBe(1)
  })

  it('no duplica si el cron corre dos veces en el mismo minuto (last_slot ya alcanzado)', () => {
    const firstSent = '2026-10-16T08:00:00-03:00'
    const firstSentMs = Date.parse(firstSent)
    const reminders = new Map<string, ReminderRow>([
      ['med-1|08:00', { medication_id: 'med-1', time: '08:00', first_sent_at: firstSent, last_slot: 1 }],
    ])

    const plan = planReminders({
      ...baseOpts,
      nowHM: '08:10',
      nowMs: firstSentMs + 10 * 60000, // slot = 1, pero last_slot ya es 1
      reminders,
      familyIntervals: new Map([['fam-1', 10]]),
    })
    expect(plan).toHaveLength(0)
  })

  it('no genera aviso si la dosis ya fue tomada hoy (takenSet contiene key)', () => {
    const taken = new Set(['med-1|08:00'])
    const plan = planReminders({
      ...baseOpts,
      taken,
    })
    expect(plan).toHaveLength(0)
  })

  it('familia sin push habilitado no genera avisos', () => {
    const plan = planReminders({
      ...baseOpts,
      pushFamilies: new Set(), // fam-1 no está
    })
    expect(plan).toHaveLength(0)
  })

  it('frecuencia por días de la semana y end_date vencida', () => {
    // Caso 1: frecuencia days:1,3 (Lunes y Miércoles), hoy es Viernes (isoWeekday = 5)
    const medDays: MedRow = {
      ...baseMed,
      id: 'med-days',
      frequency: 'days:1,3',
    }
    const planWrongDay = planReminders({
      ...baseOpts,
      meds: [medDays],
      isoWeekday: 5,
    })
    expect(planWrongDay).toHaveLength(0)

    // Mismo medicamento en Miércoles (isoWeekday = 3)
    const planRightDay = planReminders({
      ...baseOpts,
      meds: [medDays],
      isoWeekday: 3,
    })
    expect(planRightDay).toHaveLength(1)

    // Caso 2: end_date vencida ayer
    const medExpired: MedRow = {
      ...baseMed,
      id: 'med-expired',
      end_date: '2026-10-15', // Ayer
    }
    const planExpired = planReminders({
      ...baseOpts,
      meds: [medExpired],
    })
    expect(planExpired).toHaveLength(0)
  })

  it('caso especial as_needed: documenta comportamiento actual donde isMedicationScheduledForDay retorna false', () => {
    // En lib/dates.ts, isMedicationScheduledForDay('as_needed') retorna false.
    // Como planReminders usa runsToday() que delega en isMedicationScheduledForDay,
    // med.frequency === 'as_needed' es filtrado en runsToday() y no genera avisos.
    const medAsNeeded: MedRow = {
      ...baseMed,
      id: 'med-sos',
      frequency: 'as_needed',
    }
    const plan = planReminders({
      ...baseOpts,
      meds: [medAsNeeded],
    })
    // Se verifica el comportamiento real para documentar en el informe
    expect(plan).toHaveLength(0)
  })

  it('cambio de hora (DST) de Chile: los slots se calculan por minutos transcurridos en tiempo unix', () => {
    // En Chile el horario de verano cambia la hora local pero el cálculo de slots en planReminders
    // usa nowIdx = Math.floor(nowMs / 60000) y Math.floor(Date.parse(first_sent_at) / 60000).
    const firstSent = '2026-09-05T23:50:00-04:00' // Antes del cambio de hora
    const firstSentMs = Date.parse(firstSent)
    const twentyMinLaterMs = firstSentMs + 20 * 60000

    const rem = new Map<string, ReminderRow>([
      ['med-1|08:00', { medication_id: 'med-1', time: '08:00', first_sent_at: firstSent, last_slot: 0 }],
    ])

    const plan = planReminders({
      ...baseOpts,
      nowMs: twentyMinLaterMs,
      nowHM: '08:20',
      reminders: rem,
      familyIntervals: new Map([['fam-1', 10]]),
    })

    expect(plan).toHaveLength(1)
    expect(plan[0].slot).toBe(2) // 20 min transcurridos / 10 min por slot = slot 2
  })
})
