/**
 * Traduce y formatea mensajes de error de Supabase y APIs al español chileno/latino amigable.
 */
export function translateErrorMessage(err: unknown): string {
  if (!err) return 'Ocurrió un error inesperado. Por favor intenta de nuevo.'

  const message = typeof err === 'string' ? err : (err as any)?.message || String(err)
  const lower = message.toLowerCase()

  // 1. Límites de tiempo y seguridad (Rate limits)
  const secondsMatch = message.match(/after (\d+)\s*seconds?/i)
  if (secondsMatch) {
    return `Por seguridad, debes esperar ${secondsMatch[1]} segundos antes de volver a solicitar un código.`
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Has realizado demasiados intentos en poco tiempo. Por favor espera unos minutos.'
  }

  // 2. Errores de token / código OTP
  if (lower.includes('token') && (lower.includes('expired') || lower.includes('invalid'))) {
    return 'El código de 6 dígitos es incorrecto o ya expiró. Pide uno nuevo.'
  }

  if (lower.includes('otp') && lower.includes('disabled')) {
    return 'El acceso por código está temporalmente deshabilitado.'
  }

  // 3. Credenciales y cuenta
  if (lower.includes('invalid login credentials')) {
    return 'Los datos de acceso son incorrectos.'
  }

  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'Ya existe un usuario registrado con este correo.'
  }

  if (lower.includes('user not found')) {
    return 'No encontramos una cuenta asociada a este correo.'
  }

  if (lower.includes('email not confirmed')) {
    return 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.'
  }

  // 4. Formato de correo inválido
  if (lower.includes('invalid email') || lower.includes('validate email address')) {
    return 'Por favor ingresa un correo electrónico válido (ejemplo@correo.com).'
  }

  // 5. Problemas de conexión y red
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch failed')) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión a internet.'
  }

  // 6. Errores de base de datos y permisos comunes
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'No tienes permisos para realizar esta acción.'
  }

  if (lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return 'Ya existe un elemento registrado con estos mismos datos.'
  }

  // 7. Si no coincide con ninguno conocido, retornar un mensaje legible en español
  if (/^[a-zA-Z0-9_\s.,:-]+$/.test(message) && message.length < 120 && !lower.includes('error')) {
    // Si es un mensaje simple pero en inglés, mejor dar feedback genérico amigable
    if (lower.includes('must') || lower.includes('should') || lower.includes('cannot') || lower.includes('only')) {
      return 'No se pudo completar la acción. Por favor revisa los datos ingresados.'
    }
  }

  return 'Ocurrió un error. Por favor inténtalo nuevamente.'
}
