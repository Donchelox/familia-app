-- =====================================================================
-- Migración: Control de Stock, Múltiples Horarios, Tipo de Presentación e Instrucciones
-- =====================================================================

alter table medications
  add column if not exists stock integer default null,
  add column if not exists stock_alert_threshold integer default 5,
  add column if not exists icon_type text default 'pill',
  add column if not exists instructions text default null;

create index if not exists idx_medications_family_stock on medications (family_id, stock);
