-- Opcional: Agregar columna de recurrencia de recordatorios en la tabla families (por defecto 5 minutos)
alter table families add column if not exists med_reminder_interval int not null default 5;
