-- Agregar columnas de recurrencia e intervalo de notificación a shopping_items
alter table shopping_items
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval_days integer default null,
  add column if not exists last_notified_at timestamptz default null;
