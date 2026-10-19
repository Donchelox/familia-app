-- =====================================================================
-- Migración Completa: Columnas de Recurrencia para Compras y Tareas
-- Ejecutar en Supabase SQL Editor si deseas almacenar estos campos remotamente
-- =====================================================================

-- 1. Tabla shopping_items (Supermercado y Feria)
alter table shopping_items
  add column if not exists category text,
  add column if not exists quantity text,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval_days integer default null,
  add column if not exists last_notified_at timestamptz default null;

-- 2. Tabla todos (Tareas del Hogar)
alter table todos
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval_days integer default null;
