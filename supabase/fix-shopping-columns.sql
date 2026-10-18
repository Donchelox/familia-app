-- Columnas que el código ya usa en shopping_items (Súper: category, Feria: quantity, Recurrencia)
alter table shopping_items
  add column if not exists category text,
  add column if not exists quantity text,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval_days integer default null,
  add column if not exists last_notified_at timestamptz default null;

