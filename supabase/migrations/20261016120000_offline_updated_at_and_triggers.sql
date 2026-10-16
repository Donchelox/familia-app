-- Migración idempotente para soporte de resolución de conflictos offline
-- Agrega columna updated_at con default now() y triggers automáticos BEFORE UPDATE en tablas offline-first:
-- medications, school_homework, school_tests, shopping_items, todos

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. medications
alter table medications add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_medications_updated_at on medications;
create trigger set_medications_updated_at
  before update on medications
  for each row
  execute function update_updated_at_column();

-- 2. school_homework
alter table school_homework add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_school_homework_updated_at on school_homework;
create trigger set_school_homework_updated_at
  before update on school_homework
  for each row
  execute function update_updated_at_column();

-- 3. school_tests
alter table school_tests add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_school_tests_updated_at on school_tests;
create trigger set_school_tests_updated_at
  before update on school_tests
  for each row
  execute function update_updated_at_column();

-- 4. shopping_items
alter table shopping_items add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_shopping_items_updated_at on shopping_items;
create trigger set_shopping_items_updated_at
  before update on shopping_items
  for each row
  execute function update_updated_at_column();

-- 5. todos
alter table todos add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_todos_updated_at on todos;
create trigger set_todos_updated_at
  before update on todos
  for each row
  execute function update_updated_at_column();
