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

/** Skeleton de una tarjeta de medicamento (Dosis) */
export function MedsCardSkeleton() {
  return (
    <div className="p-4 rounded-[26px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between gap-3 relative overflow-hidden">
      {/* Check a la izquierda del todo: squircle 48x48 */}
      <Skeleton className="w-12 h-12 rounded-[18px] shrink-0" />
      {/* Información del remedio */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-12 h-4 rounded-md" />
          <Skeleton className="w-28 h-4 rounded-md" />
          <Skeleton className="w-16 h-4 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-16 h-3 rounded-md" />
          <Skeleton className="w-20 h-3 rounded-md" />
        </div>
      </div>
      {/* Botón de acción */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
    </div>
  )
}

/** Lista de tarjetas de medicamento con shimmer */
export function MedsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <MedsCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton de página completa para /meds */
export function MedsPageSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 select-none pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-36 h-6 rounded-lg" />
            <Skeleton className="w-48 h-3.5 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-7 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </header>

      {/* Buscador */}
      <Skeleton className="w-full h-10 rounded-2xl" />

      {/* Chips de resumen */}
      <div className="flex items-center gap-2">
        <Skeleton className="w-28 h-7 rounded-full" />
        <Skeleton className="w-36 h-7 rounded-full" />
      </div>

      {/* Filtros por Integrante */}
      <div className="flex items-center gap-2 overflow-hidden pb-1">
        <Skeleton className="w-16 h-8 rounded-2xl shrink-0" />
        <Skeleton className="w-20 h-8 rounded-2xl shrink-0" />
        <Skeleton className="w-24 h-8 rounded-2xl shrink-0" />
        <Skeleton className="w-20 h-8 rounded-2xl shrink-0" />
      </div>

      {/* Lista de medicamentos */}
      <MedsListSkeleton count={4} />
    </div>
  )
}

/** Skeleton de una tarjeta de tarea */
export function TaskCardSkeleton() {
  return (
    <div className="p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 flex items-start gap-3.5 relative overflow-hidden">
      {/* Check a la izquierda */}
      <Skeleton className="w-7 h-7 rounded-xl shrink-0 mt-0.5" />
      {/* Cuerpo */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="w-3/5 h-4.5 rounded-md" />
          <Skeleton className="w-16 h-4 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-3.5 rounded-md" />
          <Skeleton className="w-14 h-3.5 rounded-full" />
        </div>
      </div>
      <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
    </div>
  )
}

/** Lista de tareas con shimmer */
export function TaskListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton de página completa para /tareas */
export function TareasPageSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 select-none pb-12 animate-in fade-in duration-150">
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-28 h-6 rounded-lg" />
            <Skeleton className="w-44 h-3.5 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-7 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </header>

      {/* Buscador */}
      <Skeleton className="w-full h-10 rounded-2xl" />

      {/* Barra de filtros */}
      <div className="flex items-center gap-2 overflow-hidden">
        <Skeleton className="w-16 h-8 rounded-xl shrink-0" />
        <Skeleton className="w-24 h-8 rounded-xl shrink-0" />
        <Skeleton className="w-28 h-8 rounded-xl shrink-0" />
      </div>

      {/* Lista */}
      <TaskListSkeleton count={4} />
    </div>
  )
}

/** Skeleton de un producto en Super o Feria */
export function ShoppingCardSkeleton() {
  return (
    <div className="p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between gap-3.5 relative overflow-hidden">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Check a la izquierda */}
        <Skeleton className="w-7 h-7 rounded-xl shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <Skeleton className="w-1/2 h-4 rounded-md" />
          <Skeleton className="w-20 h-3 rounded-md" />
        </div>
      </div>
      <Skeleton className="w-16 h-6 rounded-xl shrink-0" />
      <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
    </div>
  )
}

/** Lista de productos en Super o Feria */
export function ShoppingListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <ShoppingCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton de página completa para /super o /feria */
export function ShoppingPageSkeleton({ title = 'Lista de Compras' }: { title?: string }) {
  return (
    <div className="w-full flex flex-col gap-5 select-none pb-12 animate-in fade-in duration-150">
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-32 h-6 rounded-lg" />
            <Skeleton className="w-40 h-3.5 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-7 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </header>

      {/* Tabs Super / Feria */}
      <div className="flex p-1 bg-[#1a1a1a] border border-neutral-800/80 rounded-2xl gap-2">
        <Skeleton className="flex-1 h-9 rounded-xl" />
        <Skeleton className="flex-1 h-9 rounded-xl" />
      </div>

      {/* Filtros de categoría */}
      <div className="p-4 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="w-28 h-5 rounded-md" />
          <Skeleton className="w-44 h-7 rounded-xl" />
        </div>
        <div className="flex items-center gap-2 overflow-hidden pt-1">
          <Skeleton className="w-16 h-7 rounded-xl shrink-0" />
          <Skeleton className="w-24 h-7 rounded-xl shrink-0" />
          <Skeleton className="w-28 h-7 rounded-xl shrink-0" />
          <Skeleton className="w-20 h-7 rounded-xl shrink-0" />
        </div>
      </div>

      {/* Lista de productos */}
      <ShoppingListSkeleton count={4} />
    </div>
  )
}

/** Skeleton de tarjeta en Colegio (Prueba o Tarea) */
export function ColegioCardSkeleton() {
  return (
    <div className="p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between gap-3 relative overflow-hidden">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Skeleton className="w-7 h-7 rounded-xl shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Skeleton className="w-20 h-4 rounded-md" />
            <Skeleton className="w-24 h-4 rounded-md" />
          </div>
          <Skeleton className="w-3/4 h-3.5 rounded-md" />
        </div>
      </div>
      <Skeleton className="w-14 h-7 rounded-xl shrink-0" />
      <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
    </div>
  )
}

/** Lista de Colegio con shimmer */
export function ColegioListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <ColegioCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton de página completa para /colegio */
export function ColegioPageSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 select-none pb-12 animate-in fade-in duration-150">
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-28 h-6 rounded-lg" />
            <Skeleton className="w-44 h-3.5 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-7 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-[#1a1a1a] border border-neutral-800/80 rounded-2xl gap-2">
        <Skeleton className="flex-1 h-9 rounded-xl" />
        <Skeleton className="flex-1 h-9 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="w-28 h-5 rounded-md" />
            <Skeleton className="w-16 h-6 rounded-lg" />
          </div>
          <ColegioListSkeleton count={2} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="w-36 h-5 rounded-md" />
            <Skeleton className="w-16 h-6 rounded-lg" />
          </div>
          <ColegioListSkeleton count={3} />
        </div>
      </div>
    </div>
  )
}

/** Skeleton de página completa para /ajustes */
export function AjustesSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 select-none pb-12 animate-in fade-in duration-150">
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-28 h-6 rounded-lg" />
            <Skeleton className="w-48 h-3.5 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-7 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </header>

      {/* Tarjeta Perfil */}
      <div className="p-5 rounded-[26px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between relative overflow-hidden">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="w-32 h-5 rounded-md" />
            <Skeleton className="w-48 h-3.5 rounded-md" />
          </div>
        </div>
        <Skeleton className="w-16 h-8 rounded-xl shrink-0" />
        <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
      </div>

      {/* Sección Hogar */}
      <div className="flex flex-col gap-2">
        <Skeleton className="w-28 h-3.5 rounded-md ml-1" />
        <div className="h-16 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 relative overflow-hidden">
          <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
        </div>
      </div>

      {/* Sección Configuración */}
      <div className="flex flex-col gap-2">
        <Skeleton className="w-28 h-3.5 rounded-md ml-1" />
        <div className="h-28 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 relative overflow-hidden">
          <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
        </div>
      </div>
    </div>
  )
}

