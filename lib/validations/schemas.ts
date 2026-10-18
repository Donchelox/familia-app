import { z } from 'zod'

export const UUID_SCHEMA = z.string().uuid()
export const TIME_SCHEMA = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const DATE_SCHEMA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const EMAIL_SCHEMA = z.string().trim().toLowerCase().email().max(254)

// 1. Supermercado y Feria
export const AddShoppingItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  list: z.enum(['super', 'feria']).default('super'),
  category: z.string().trim().max(100).nullable().optional(),
  quantity: z.string().trim().max(50).nullable().optional(),
  is_recurring: z.boolean().optional().default(false),
  recurrence_interval_days: z.coerce.number().int().min(1).max(365).nullable().optional(),
})

export const UpdateShoppingItemSchema = z.object({
  id: UUID_SCHEMA,
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().max(100).nullable().optional(),
  quantity: z.string().trim().max(50).nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_interval_days: z.coerce.number().int().min(1).max(365).nullable().optional(),
})

export const AddMultipleShoppingItemsSchema = z.object({
  list: z.enum(['super', 'feria']).default('super'),
  items: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
})

// 2. Tareas del hogar
export const AddTodoSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export const TodoIdSchema = z.object({
  id: UUID_SCHEMA,
})

// 3. Colegio
export const AddTestSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  topic: z.string().trim().max(200).nullable().optional(),
  date: DATE_SCHEMA,
})

export const AddHomeworkSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  task: z.string().trim().min(1).max(200),
  due: DATE_SCHEMA,
})

export const AddSchoolBlockSchema = z.object({
  day: z.coerce.number().int().min(1).max(5),
  start: z.coerce.number().int().min(1).max(12),
  length: z.coerce.number().int().min(1).max(2).default(1),
  subject: z.string().trim().min(1).max(100),
})

// 4. Medicamentos
export const MedicationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  dose: z.string().trim().max(100).nullable().optional(),
  person: z.string().trim().max(100).nullable().optional(),
  times: z.array(TIME_SCHEMA).min(1).max(12),
})

export const UpdateMedicationSchema = MedicationSchema.extend({
  id: UUID_SCHEMA,
})

export const ToggleDoseSchema = z.object({
  medicationId: UUID_SCHEMA,
  scheduledTime: TIME_SCHEMA,
  isTaken: z.boolean(),
})

// 5. Integrantes y Familia
export const InviteMemberSchema = z.object({
  email: EMAIL_SCHEMA,
  role: z.enum(['admin', 'editor', 'viewer']),
})

export const SetRoleSchema = z.object({
  user_id: UUID_SCHEMA,
  role: z.enum(['admin', 'editor', 'viewer']),
})

export const FamilyMemberSchema = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(50).default('hijo'),
  type: z.enum(['adult', 'child']).default('child'),
  email: EMAIL_SCHEMA.optional().or(z.literal('')),
})

export const UpdateFamilyMemberSchema = FamilyMemberSchema.extend({
  memberId: UUID_SCHEMA,
})

export const UpdatePreferencesSchema = z.object({
  medReminders: z.boolean().default(true),
  reminderPushDetail: z.boolean().default(false),
  morningSummary: z.boolean().default(true),
  medReminderInterval: z.coerce.number().pipe(z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)])).default(5),
  morningSummaryTime: TIME_SCHEMA.default('07:00'),
  schoolReminders: z.boolean().default(true),
  schoolReminderTime: TIME_SCHEMA.default('07:30'),
  feriaReminders: z.boolean().default(true),
  feriaDays: z.array(z.string().trim()).default(['Jueves', 'Domingo']),
  feriaTime: TIME_SCHEMA.default('07:00'),
  superReminders: z.boolean().default(true),
  superTime: TIME_SCHEMA.default('18:00'),
})

export const UpdateAccountSchema = z.object({
  fullName: z.string().trim().max(100).optional(),
  familyName: z.string().trim().min(1).max(80).optional(),
  email: EMAIL_SCHEMA.optional().or(z.literal('')),
})

export const SetRemindersSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
})

export const CreateFamilySchema = z.object({
  family: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(100),
})

