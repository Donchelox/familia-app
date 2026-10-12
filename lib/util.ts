import { revalidatePath } from 'next/cache'
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
export const refresh = () => revalidatePath('/', 'layout')
