# Casa — app familiar

Next.js 15 + Supabase. Módulos: Inicio, Supermercado/Feria, Medicamentos, Tareas, Colegio y Ajustes (familia, integrantes, horario, preferencias y auditoría).

## Puesta en marcha paso a paso

### 1. Base de datos (Supabase)
En tu proyecto de Supabase → SQL Editor (o mediante Supabase CLI), ejecuta en el siguiente orden:
1. `supabase/schema.sql` (esquema base completo de familias, módulos y RLS).
2. `supabase/migrations/20261015000000_security_phase1.sql` (endurecimiento de seguridad, índices, RLS de push_subscriptions, triggers de integridad y límites CHECK).
3. `supabase/migrations/20261015190000_fix_notification_columns.sql` (columnas de intervalos y detalle de recordatorios).
4. `supabase/migrations/20261016000000_align_schema_and_code.sql` (alineación de esquema: family_members, school_schedule, dose_reminders, change_logs, y columnas en medications, todos, shopping_items, school_homework, school_tests, activity_log).

*(Los scripts antiguos se conservan en `supabase/legacy/` como referencia histórica).*

### 2. Autenticación y Correo (Supabase)
- **Emails**: En Authentication → Email Templates, en las plantillas "Magic Link" y "Confirm signup" reemplaza el enlace por `Tu código: {{ .Token }}`.
- **SMTP**: En Authentication → SMTP, configura un proveedor de correo (ej. Resend) para producción.
- **URL Configuration**: Agrega la URL del despliegue (ej. `https://tu-app.vercel.app`) como Site URL y en Redirect URLs (`/login`).

### 3. Variables de entorno
Copia `.env.example` a `.env.local` y completa los valores requeridos:
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anon / public key de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key (solo para cron y tareas administrativas del servidor).
- `CRON_SECRET`: Secreto de autorización para disparar los endpoints de cron (`Bearer <CRON_SECRET>`). Debe tener **al menos 32 caracteres aleatorios**.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Clave pública VAPID para notificaciones Web Push.
- `VAPID_PRIVATE_KEY`: Clave privada VAPID.
- `VAPID_SUBJECT`: Contacto VAPID (ej. `mailto:admin@tudominio.com`).
- `NEXT_PUBLIC_SITE_URL`: URL pública base de la aplicación.
- `HEALTHCHECK_URL` *(opcional)*: URL de monitoreo externo para ping al completar el cron con éxito.

### 4. Automatización del Cron cada minuto
Para que los recordatorios de medicamentos y avisos modulares se despachen a tiempo, el endpoint `/api/cron/medications` debe ejecutarse **cada minuto**:

- **Vercel Pro**: Configurar un cron job en `vercel.json` o Vercel Cron.
- **cron-job.org / servicio externo**: Configurar una tarea HTTP `GET` cada 1 minuto hacia `https://tu-app.vercel.app/api/cron/medications` con la cabecera:
  ```http
  Authorization: Bearer <CRON_SECRET>
  ```
- **Supabase pg_cron + pg_net**:
  ```sql
  select cron.schedule(
    'dispatch-medications-cron',
    '* * * * *',
    $$
    select net.http_get(
      url := 'https://tu-app.vercel.app/api/cron/medications',
      headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
    );
    $$
  );
  ```

### 5. Desarrollo local
```bash
npm install
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en el navegador.
