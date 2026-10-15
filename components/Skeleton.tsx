interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-neutral-800/60 skeleton-shimmer rounded-xl overflow-hidden ${className}`}
    />
  )
}

/** Skeleton con la forma exacta del Dashboard de Casa */
export function DashboardSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 select-none animate-in fade-in duration-150 pb-16">
      {/* Header Skeleton */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full !bg-neutral-800/80" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-12 h-3.5 rounded-md" />
            <Skeleton className="w-32 h-6 rounded-lg" />
          </div>
        </div>
        <Skeleton className="w-10 h-10 rounded-full" />
      </header>

      {/* Grid de Accesos Rápidos */}
      <section className="flex flex-col gap-3">
        {/* Fila 1: Compras y Feria (2 tarjetas grandes de 120px) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[120px] rounded-[20px] p-3.5 bg-[#1a1a1a] border border-neutral-800/80 flex flex-col justify-between overflow-hidden relative">
            <div className="flex justify-between items-start">
              <Skeleton className="w-6 h-6 rounded-md" />
              <Skeleton className="w-6 h-6 rounded-full" />
            </div>
            <Skeleton className="w-20 h-5 rounded-md" />
            <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
          </div>

          <div className="h-[120px] rounded-[20px] p-3.5 bg-[#1a1a1a] border border-neutral-800/80 flex flex-col justify-between overflow-hidden relative">
            <div className="flex justify-between items-start">
              <Skeleton className="w-6 h-6 rounded-md" />
              <Skeleton className="w-6 h-6 rounded-full" />
            </div>
            <Skeleton className="w-16 h-5 rounded-md" />
            <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
          </div>
        </div>

        {/* Fila 2: Medicinas, Colegio, Tareas (3 tarjetas de 115px) */}
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[115px] rounded-[20px] p-3 bg-[#1a1a1a] border border-neutral-800/80 flex flex-col justify-between overflow-hidden relative"
            >
              <div className="flex justify-between items-start">
                <Skeleton className="w-5 h-5 rounded-md" />
                <Skeleton className="w-5 h-5 rounded-full" />
              </div>
              <Skeleton className="w-14 h-4 rounded-md" />
              <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
            </div>
          ))}
        </div>
      </section>

      {/* Sección Próximos Eventos */}
      <section className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <Skeleton className="w-36 h-5 rounded-md" />
          <Skeleton className="w-16 h-4 rounded-md" />
        </div>

        {/* Tarjetas de eventos */}
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-[22px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between gap-3 overflow-hidden relative"
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <Skeleton className="w-10 h-10 rounded-2xl shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <Skeleton className="w-3/4 h-4 rounded-md" />
                  <Skeleton className="w-1/2 h-3 rounded-md" />
                </div>
              </div>
              <Skeleton className="w-12 h-6 rounded-xl shrink-0" />
              <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
