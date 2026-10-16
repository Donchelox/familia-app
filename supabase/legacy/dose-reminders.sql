-- Seguimiento de los recordatorios repetidos de medicamentos.
-- Lo usa el cron /api/cron/medications para saber qué dosis ya avisó y cuándo (cada 5 min hasta 2 h).
create table if not exists dose_reminders (
  medication_id uuid not null references medications on delete cascade,
  family_id uuid not null references families on delete cascade,
  day date not null,
  time text not null,                                  -- hora programada de la dosis, 'HH:MM'
  first_sent_at timestamptz not null default now(),    -- primer aviso: desde aquí se cuentan los 5 min y las 2 h
  last_slot int not null default 0,                    -- último intervalo de 5 min ya notificado (0 = primer aviso)
  primary key (medication_id, day, time)
);
create index if not exists dose_reminders_day_idx on dose_reminders (day);

-- Solo el cron (service role) usa esta tabla: con RLS activo y sin políticas, nadie más puede leerla ni escribirla.
alter table dose_reminders enable row level security;
