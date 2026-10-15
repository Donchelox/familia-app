-- Columnas de recurrencia y detalle de recordatorios en la tabla families
alter table families add column if not exists med_reminder_interval int not null default 5;
alter table families add column if not exists reminder_push_detail boolean not null default false;
