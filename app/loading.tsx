export default function GlobalLoading() {
  return (
    <div className="w-full min-h-screen bg-[#131313] flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="flex flex-col items-center gap-4">
        {/* Logo o Icono Casa pulsante */}
        <div className="relative w-16 h-16 rounded-[22px] bg-gradient-to-tr from-[#F76911] to-[#F2A957] flex items-center justify-center shadow-[0_8px_30px_rgba(247,105,17,0.45)]">
          <svg
            className="w-8 h-8 text-white stroke-current stroke-[2.2] fill-none animate-pulse"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>

        {/* Spinner animado */}
        <div className="flex items-center gap-2.5 mt-2">
          <div className="w-4 h-4 border-2 border-[#F76911] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-neutral-300 tracking-wider">
            Cargando...
          </span>
        </div>
      </div>
    </div>
  )
}
