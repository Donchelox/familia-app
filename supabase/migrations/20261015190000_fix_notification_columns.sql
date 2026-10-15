-- =====================================================================
-- Migración: Columnas de recordatorios e intervalos en tabla families
-- Idempotente para ejecutar en Supabase SQL Editor
-- =====================================================================

alter table families add column if not exists med_reminder_interval int not null default 5;
alter table families add column if not exists reminder_push_detail boolean not null default false;
