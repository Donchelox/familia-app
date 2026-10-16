import { describe, it, expect } from 'vitest'
import {
  todayStr,
  weekday,
  isSchoolTestActive,
  isMedicationScheduledForDay,
  isTimeDueToday,
  TZ,
} from '@/lib/dates'

describe('lib/dates.ts', () => {
  it('TZ es America/Santiago', () => {
    expect(TZ).toBe('America/Santiago')
  })

  it('todayStr genera fecha en formato YYYY-MM-DD en zona horaria America/Santiago', () => {
    const today = todayStr()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('weekday calcula correctamente el día de la semana ISO (1=Lunes .. 7=Domingo)', () => {
    // 2026-10-12 fue Lunes
    expect(weekday('2026-10-12')).toBe(1)
    // 2026-10-16 es Viernes
    expect(weekday('2026-10-16')).toBe(5)
    // 2026-10-17 es Sábado
    expect(weekday('2026-10-17')).toBe(6)
    // 2026-10-18 es Domingo
    expect(weekday('2026-10-18')).toBe(7)
  })

  describe('isMedicationScheduledForDay', () => {
    it('retorna true para diario (daily) sin end_date', () => {
      expect(isMedicationScheduledForDay({ frequency: 'daily' }, '2026-10-16', 5)).toBe(true)
    })

    it('retorna false si end_date ya venció respecto al día evaluado', () => {
      expect(
        isMedicationScheduledForDay(
          { frequency: 'daily', end_date: '2026-10-15' },
          '2026-10-16',
          5
        )
      ).toBe(false)
    })

    it('retorna true si end_date es igual o posterior al día evaluado', () => {
      expect(
        isMedicationScheduledForDay(
          { frequency: 'daily', end_date: '2026-10-16' },
          '2026-10-16',
          5
        )
      ).toBe(true)
      expect(
        isMedicationScheduledForDay(
          { frequency: 'daily', end_date: '2026-10-20' },
          '2026-10-16',
          5
        )
      ).toBe(true)
    })

    it('retorna false para as_needed o sos (no son tomas programadas fijas)', () => {
      expect(isMedicationScheduledForDay({ frequency: 'as_needed' }, '2026-10-16', 5)).toBe(false)
      expect(isMedicationScheduledForDay({ frequency: 'sos' }, '2026-10-16', 5)).toBe(false)
    })

    it('evalúa weekdays (1..5) correctamente', () => {
      // Lunes a Viernes -> true
      expect(isMedicationScheduledForDay({ frequency: 'weekdays' }, '2026-10-16', 5)).toBe(true)
      // Sábado -> false
      expect(isMedicationScheduledForDay({ frequency: 'weekdays' }, '2026-10-17', 6)).toBe(false)
      // Domingo -> false
      expect(isMedicationScheduledForDay({ frequency: 'weekdays' }, '2026-10-18', 7)).toBe(false)
    })

    it('evalúa weekends (6..7) correctamente', () => {
      expect(isMedicationScheduledForDay({ frequency: 'weekends' }, '2026-10-16', 5)).toBe(false)
      expect(isMedicationScheduledForDay({ frequency: 'weekends' }, '2026-10-17', 6)).toBe(true)
      expect(isMedicationScheduledForDay({ frequency: 'weekends' }, '2026-10-18', 7)).toBe(true)
    })

    it('evalúa días específicos con days:X,Y,Z correctamente', () => {
      const med = { frequency: 'days:1,3,5' } // Lunes, Miércoles, Viernes
      expect(isMedicationScheduledForDay(med, '2026-10-12', 1)).toBe(true)
      expect(isMedicationScheduledForDay(med, '2026-10-13', 2)).toBe(false)
      expect(isMedicationScheduledForDay(med, '2026-10-14', 3)).toBe(true)
      expect(isMedicationScheduledForDay(med, '2026-10-15', 4)).toBe(false)
      expect(isMedicationScheduledForDay(med, '2026-10-16', 5)).toBe(true)
    })
  })

  describe('isSchoolTestActive', () => {
    const today = '2026-10-16'

    it('retorna false para pruebas de fechas anteriores', () => {
      expect(isSchoolTestActive('2026-10-15', '10:00', today)).toBe(false)
    })

    it('retorna true para pruebas de hoy antes de las 20:00 hrs', () => {
      expect(isSchoolTestActive(today, '08:30', today)).toBe(true)
      expect(isSchoolTestActive(today, '19:59', today)).toBe(true)
    })

    it('retorna false para pruebas de hoy a las 20:00 hrs o después', () => {
      expect(isSchoolTestActive(today, '20:00', today)).toBe(false)
      expect(isSchoolTestActive(today, '21:30', today)).toBe(false)
    })

    it('retorna true para pruebas futuras', () => {
      expect(isSchoolTestActive('2026-10-20', '21:00', today)).toBe(true)
    })
  })

  describe('isTimeDueToday', () => {
    it('retorna true si la hora actual está dentro de la ventana de atraso', () => {
      expect(isTimeDueToday('08:00', '08:00', 120)).toBe(true)
      expect(isTimeDueToday('08:00', '09:30', 120)).toBe(true) // 90 min tarde
      expect(isTimeDueToday('08:00', '10:00', 120)).toBe(true) // 120 min tarde exactos
    })

    it('retorna false si la hora aún no ha llegado (adelantada)', () => {
      expect(isTimeDueToday('08:00', '07:55', 120)).toBe(false)
    })

    it('retorna false si ya pasaron más de 120 min', () => {
      expect(isTimeDueToday('08:00', '10:01', 120)).toBe(false)
    })
  })
})
