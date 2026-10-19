import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#131313] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
      <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl mb-4 shadow-lg">
        🔍
      </div>
      <h1 className="text-xl font-black text-white tracking-tight m-0">
        Página no encontrada
      </h1>
      <p className="text-xs text-neutral-400 mt-2 max-w-sm leading-relaxed">
        La sección que estás buscando no existe o fue movida.
      </p>
      <Link
        href="/"
        className="mt-6 px-5 py-2.5 rounded-2xl bg-[#F76911] text-white text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all no-underline inline-block cursor-pointer"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
