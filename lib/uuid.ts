/**
 * Genera un identificador compatible con UUID v4 (RFC 4122).
 * Utiliza crypto.randomUUID() nativo si está disponible, o un fallback
 * pseudoaleatorio válido para asegurar que PostgreSQL en Supabase nunca rechace
 * el ID con 'invalid input syntax for type uuid'.
 */
export function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
