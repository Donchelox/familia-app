# Casa — app familiar

Next.js 15 + Supabase. Módulos: Inicio, Supermercado/Feria, Medicamentos, Tareas, Colegio y Ajustes (familia, horario, registro).

Guía de puesta en marcha paso a paso: ver el mensaje de la conversación o seguir:
1. Supabase: crear proyecto → SQL Editor → ejecutar `supabase/schema.sql` completo (una sola vez).
2. Supabase → Authentication → Emails: en las plantillas "Magic Link" y "Confirm signup" reemplaza el enlace por `Tu código: {{ .Token }}`.
3. Supabase → Authentication → SMTP: configura un SMTP propio (ej. Resend); el de prueba envía muy pocos correos por hora.
4. Copia `.env.example` a `.env.local` con URL y anon key (Project Settings → API) y prueba con `npm install && npm run dev`.
5. Sube el repo a GitHub → Vercel → Import → agrega las 2 variables de entorno → Deploy.
6. Supabase → Authentication → URL Configuration: agrega la URL de Vercel como Site URL.
7. Entra con tu correo, crea la familia, carga el horario en Ajustes e invita al resto.

Pendiente (fase 2): recordatorios reales de medicamentos (correo + push) y PWA instalable.
