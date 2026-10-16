import { revalidatePath } from 'next/cache'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
export const refresh = () => revalidatePath('/', 'layout')
