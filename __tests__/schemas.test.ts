import { describe, it, expect } from 'vitest'
import {
  UUID_SCHEMA,
  TIME_SCHEMA,
  DATE_SCHEMA,
  EMAIL_SCHEMA,
  AddShoppingItemSchema,
  UpdateShoppingItemSchema,
  AddMultipleShoppingItemsSchema,
  AddTodoSchema,
  TodoIdSchema,
  AddTestSchema,
  AddHomeworkSchema,
  AddSchoolBlockSchema,
  MedicationSchema,
  UpdateMedicationSchema,
  ToggleDoseSchema,
  InviteMemberSchema,
  SetRoleSchema,
  FamilyMemberSchema,
  UpdateFamilyMemberSchema,
  UpdatePreferencesSchema,
  UpdateAccountSchema,
  CreateFamilySchema,
} from '@/lib/validations/schemas'

describe('lib/validations/schemas.ts', () => {
  describe('Primitivos', () => {
    it('UUID_SCHEMA valida uuids v4 e invalida cadenas arbitrarias', () => {
      expect(UUID_SCHEMA.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true)
      expect(UUID_SCHEMA.safeParse('not-a-uuid').success).toBe(false)
      expect(UUID_SCHEMA.safeParse('').success).toBe(false)
    })

    it('TIME_SCHEMA valida formato HH:MM e invalida horas fuera de rango', () => {
      expect(TIME_SCHEMA.safeParse('08:00').success).toBe(true)
      expect(TIME_SCHEMA.safeParse('23:59').success).toBe(true)
      expect(TIME_SCHEMA.safeParse('24:00').success).toBe(false)
      expect(TIME_SCHEMA.safeParse('8:00').success).toBe(false)
      expect(TIME_SCHEMA.safeParse('12:60').success).toBe(false)
    })

    it('DATE_SCHEMA valida formato YYYY-MM-DD', () => {
      expect(DATE_SCHEMA.safeParse('2026-10-16').success).toBe(true)
      expect(DATE_SCHEMA.safeParse('16-10-2026').success).toBe(false)
      expect(DATE_SCHEMA.safeParse('2026/10/16').success).toBe(false)
    })

    it('EMAIL_SCHEMA normaliza correos a minusculas y valida formato', () => {
      const res = EMAIL_SCHEMA.safeParse('  User@Example.COM  ')
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data).toBe('user@example.com')
      }
      expect(EMAIL_SCHEMA.safeParse('not-an-email').success).toBe(false)
    })
  })

  describe('Supermercado y Feria', () => {
    it('AddShoppingItemSchema valida items correctos y defaults', () => {
      const parsed = AddShoppingItemSchema.safeParse({ name: 'Leche' })
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.list).toBe('super')
      }

      // Nombre vacío es inválido
      expect(AddShoppingItemSchema.safeParse({ name: '   ' }).success).toBe(false)
      // Lista distinta de super o feria es inválida
      expect(AddShoppingItemSchema.safeParse({ name: 'Papas', list: 'tienda' }).success).toBe(false)
    })

    it('UpdateShoppingItemSchema requiere uuid válido', () => {
      expect(
        UpdateShoppingItemSchema.safeParse({
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Pan',
        }).success
      ).toBe(true)
      expect(UpdateShoppingItemSchema.safeParse({ id: 'abc', name: 'Pan' }).success).toBe(false)
    })

    it('AddMultipleShoppingItemsSchema valida array no vacío', () => {
      expect(AddMultipleShoppingItemsSchema.safeParse({ items: ['Manzanas', 'Peras'] }).success).toBe(true)
      expect(AddMultipleShoppingItemsSchema.safeParse({ items: [] }).success).toBe(false)
    })
  })

  describe('Tareas del hogar', () => {
    it('AddTodoSchema valida titulo no vacio', () => {
      expect(AddTodoSchema.safeParse({ title: 'Lavar platos' }).success).toBe(true)
      expect(AddTodoSchema.safeParse({ title: '' }).success).toBe(false)
    })

    it('TodoIdSchema valida id uuid', () => {
      expect(TodoIdSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true)
      expect(TodoIdSchema.safeParse({ id: '123' }).success).toBe(false)
    })
  })

  describe('Colegio', () => {
    it('AddTestSchema valida materia y fecha YYYY-MM-DD', () => {
      expect(
        AddTestSchema.safeParse({
          subject: 'Matemáticas',
          topic: 'Fracciones',
          date: '2026-10-20',
        }).success
      ).toBe(true)

      expect(AddTestSchema.safeParse({ subject: '', date: '2026-10-20' }).success).toBe(false)
      expect(AddTestSchema.safeParse({ subject: 'Historia', date: '20-10-2026' }).success).toBe(false)
    })

    it('AddHomeworkSchema valida tarea escolar', () => {
      expect(
        AddHomeworkSchema.safeParse({
          subject: 'Lenguaje',
          task: 'Leer capitulo 4',
          due: '2026-10-18',
        }).success
      ).toBe(true)
      expect(AddHomeworkSchema.safeParse({ subject: 'Arte', task: '', due: '2026-10-18' }).success).toBe(false)
    })

    it('AddSchoolBlockSchema valida dia entre 1 y 5 y bloques', () => {
      expect(
        AddSchoolBlockSchema.safeParse({
          day: 1,
          start: 2,
          length: 1,
          subject: 'Ciencias',
        }).success
      ).toBe(true)

      // Día 6 (Sábado) es inválido para horario escolar
      expect(
        AddSchoolBlockSchema.safeParse({
          day: 6,
          start: 1,
          subject: 'Taller',
        }).success
      ).toBe(false)
    })
  })

  describe('Medicamentos', () => {
    it('MedicationSchema valida horas y nombre', () => {
      expect(
        MedicationSchema.safeParse({
          name: 'Ibuprofeno',
          dose: '400mg',
          times: ['08:00', '20:00'],
        }).success
      ).toBe(true)

      // Sin horas es inválido
      expect(
        MedicationSchema.safeParse({
          name: 'Ibuprofeno',
          times: [],
        }).success
      ).toBe(false)

      // Horas con formato inválido
      expect(
        MedicationSchema.safeParse({
          name: 'Ibuprofeno',
          times: ['8:00'],
        }).success
      ).toBe(false)
    })

    it('ToggleDoseSchema valida marcaje de dosis', () => {
      expect(
        ToggleDoseSchema.safeParse({
          medicationId: '123e4567-e89b-12d3-a456-426614174000',
          scheduledTime: '14:00',
          isTaken: true,
        }).success
      ).toBe(true)
    })
  })

  describe('Integrantes y Familia', () => {
    it('InviteMemberSchema valida roles permitidos', () => {
      expect(InviteMemberSchema.safeParse({ email: 'test@example.com', role: 'editor' }).success).toBe(true)
      expect(InviteMemberSchema.safeParse({ email: 'test@example.com', role: 'guest' }).success).toBe(false)
    })

    it('FamilyMemberSchema valida tipo adult o child', () => {
      expect(FamilyMemberSchema.safeParse({ name: 'Lucas', role: 'Hijo', type: 'child' }).success).toBe(true)
      expect(FamilyMemberSchema.safeParse({ name: 'Mamá', role: 'Mamá', type: 'adult' }).success).toBe(true)
    })

    it('UpdatePreferencesSchema valida intervalos de 5, 10, 15, 30', () => {
      expect(UpdatePreferencesSchema.safeParse({ medReminderInterval: 10 }).success).toBe(true)
      expect(UpdatePreferencesSchema.safeParse({ medReminderInterval: 15 }).success).toBe(true)
      expect(UpdatePreferencesSchema.safeParse({ medReminderInterval: 25 }).success).toBe(false)
    })

    it('CreateFamilySchema valida nombre de familia y de usuario', () => {
      expect(CreateFamilySchema.safeParse({ family: 'Familia González', name: 'Carlos' }).success).toBe(true)
      expect(CreateFamilySchema.safeParse({ family: '', name: 'Carlos' }).success).toBe(false)
    })
  })
})
