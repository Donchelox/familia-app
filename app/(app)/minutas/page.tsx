'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import { createClient } from '@/lib/supabase/client'
import { offlineDB } from '@/lib/offline/db'
import { useOfflineMutation } from '@/lib/offline/useOfflineMutation'
import { getOfflineFamilyId, saveOfflineFamilyId } from '@/lib/offline/familyContext'
import { safeUUID } from '@/lib/uuid'
import {
  todayStr,
  weekday,
  getWeekMonday,
  addDaysStr,
  formatWeekRange,
  fmtDate,
} from '@/lib/dates'
import type { LocalLunchMenu } from '@/lib/offline/types'

// Días de la semana estructurados
const DAYS = [
  { num: 1, name: 'Lunes', short: 'Lun', emoji: '🍗' },
  { num: 2, name: 'Martes', short: 'Mar', emoji: '🍲' },
  { num: 3, name: 'Miércoles', short: 'Mié', emoji: '🥩' },
  { num: 4, name: 'Jueves', short: 'Jue', emoji: '🍝' },
  { num: 5, name: 'Viernes', short: 'Vie', emoji: '🐟' },
  { num: 6, name: 'Sábado', short: 'Sáb', emoji: '🥘' },
  { num: 7, name: 'Domingo', short: 'Dom', emoji: '🍖' },
]

// Banco de sugerencias de almuerzos tradicionales y caseros
interface PresetMeal {
  name: string
  category: 'Legumbres' | 'Caseros' | 'Pollo y Carnes' | 'Pastas' | 'Pescados' | 'Ligeros'
  starter: string
  dessert: string
  ingredients: string[]
}

const PRESET_MEALS: PresetMeal[] = [
  {
    name: 'Cazuela de vacuno con choclo y zapallo',
    category: 'Caseros',
    starter: 'Ensalada chilena (tomate, cebolla y cilantro)',
    dessert: 'Manzana o fruta de estación',
    ingredients: ['Carne para cazuela', 'Zapallo camote', 'Choclo entero', 'Papas', 'Porotos verdes', 'Cilantro fresco'],
  },
  {
    name: 'Lentejas con arroz y longaniza',
    category: 'Legumbres',
    starter: 'Ensalada de lechuga con palta',
    dessert: 'Jalea o fruta fresca',
    ingredients: ['Lentejas', 'Arroz', 'Cebolla', 'Zanahoria', 'Pimentón', 'Longaniza o chorizo'],
  },
  {
    name: 'Porotos con riendas y zapallo',
    category: 'Legumbres',
    starter: 'Ensalada de apio con palta',
    dessert: 'Mote con huesillo',
    ingredients: ['Porotos secos o burros', 'Tallarines o riendas', 'Zapallo camote', 'Cebolla', 'Ajo', 'Comino'],
  },
  {
    name: 'Charquicán con huevo frito',
    category: 'Caseros',
    starter: 'Ensalada de repollo con limón',
    dessert: 'Compota de manzana casera',
    ingredients: ['Posta o carne molida', 'Papas', 'Zapallo', 'Choclo', 'Porotos verdes', 'Huevos'],
  },
  {
    name: 'Pastel de choclo casero',
    category: 'Caseros',
    starter: 'Ensalada a la chilena',
    dessert: 'Sandía o melón picado',
    ingredients: ['Pasta de choclo', 'Carne molida o picada', 'Cebolla', 'Huevos duros', 'Aceitunas', 'Pechuga de pollo'],
  },
  {
    name: 'Pollo al jugo con puré de papas',
    category: 'Pollo y Carnes',
    starter: 'Sopa de verduras o consomé',
    dessert: 'Flan de vainilla casero',
    ingredients: ['Trozos de pollo o trutros', 'Papas para puré', 'Leche', 'Mantequilla', 'Cebolla', 'Zanahoria', 'Orégano'],
  },
  {
    name: 'Tallarines con salsa boloñesa casera',
    category: 'Pastas',
    starter: 'Ensalada verde mixta',
    dessert: 'Yogurt con fruta',
    ingredients: ['Fideos tallarines', 'Carne molida', 'Salsa de tomate', 'Cebolla', 'Ajo', 'Queso rallado'],
  },
  {
    name: 'Pescado al horno con arroz primavera',
    category: 'Pescados',
    starter: 'Ensalada rusa (papa, zanahoria y mayonesa)',
    dessert: 'Naranja en rodajas',
    ingredients: ['Filete de reineta o merluza', 'Arroz', 'Arvejas', 'Choclo', 'Zanahoria picada', 'Limón'],
  },
  {
    name: 'Carbonada de verduras y carne',
    category: 'Caseros',
    starter: 'Tomates con choclo y albahaca',
    dessert: 'Plátano con miel o fruta',
    ingredients: ['Posta en cubos', 'Papas', 'Zapallo', 'Choclo desgranado', 'Porotos verdes', 'Arroz'],
  },
  {
    name: 'Tomaticán de pollo con arroz blanco',
    category: 'Caseros',
    starter: 'Ensalada de pepino con yogur',
    dessert: 'Duraznos en conserva',
    ingredients: ['Pechuga de pollo', 'Tomates maduros', 'Choclo desgranado', 'Cebolla', 'Orégano', 'Arroz'],
  },
  {
    name: 'Budín de zapallito italiano al gratín',
    category: 'Ligeros',
    starter: 'Crema de verduras casera',
    dessert: 'Fruta fresca de temporada',
    ingredients: ['Zapallitos italianos', 'Cebolla', 'Huevos', 'Pan marraqueta o leche', 'Queso rallado'],
  },
  {
    name: 'Salmón a la plancha con verduras salteadas',
    category: 'Pescados',
    starter: 'Mix de hojas verdes con frutos secos',
    dessert: 'Frutillas con crema o solas',
    ingredients: ['Filete de salmón', 'Zapallito italiano', 'Pimentón rojo y verde', 'Champiñones', 'Aceite de oliva'],
  },
]

const STORAGE_KEY_PREFIX = 'casa_minutas_v1_'

// Helper para leer minutas guardadas en localStorage
function getStoredMinutas(mondayKey: string): LocalLunchMenu[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${mondayKey}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

// Helper para persistir minutas en localStorage
function saveStoredMinutas(mondayKey: string, data: LocalLunchMenu[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${mondayKey}`, JSON.stringify(data))
  } catch {}
}

export default function MinutasPage() {
  const supabase = createClient()
  const { mutate } = useOfflineMutation()

  // Semana seleccionada (lunes YYYY-MM-DD)
  const currentMonday = useMemo(() => getWeekMonday(), [])
  const [selectedMonday, setSelectedMonday] = useState<string>(currentMonday)

  // Día activo (1: Lunes ... 7: Domingo)
  const todayDateStr = todayStr()
  const todayDayNum = weekday(todayDateStr) // 1 a 7
  const [selectedDayNum, setSelectedDayNum] = useState<number>(todayDayNum)

  // Modo de vista: 'day' (Día a Día) | 'week' (Semana Completa)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  // Datos de minutas inicializados inmediatamente desde localStorage (0ms latencia)
  const [menus, setMenus] = useState<LocalLunchMenu[]>([])
  const [isInitialMount, setIsInitialMount] = useState(true)

  const [familyId, setFamilyId] = useState<string>('')
  const [familyMembers, setFamilyMembers] = useState<{ id: string; name: string }[]>([])

  // Modal Crear / Editar
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingDayNum, setEditingDayNum] = useState<number>(todayDayNum)
  const [mainDish, setMainDish] = useState('')
  const [starter, setStarter] = useState('')
  const [dessert, setDessert] = useState('')
  const [drink, setDrink] = useState('')
  const [cookName, setCookName] = useState('')
  const [notes, setNotes] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [addShoppingAuto, setAddShoppingAuto] = useState(false)
  const [autoTargetList, setAutoTargetList] = useState<'super' | 'feria'>('super')
  const [saving, setSaving] = useState(false)

  // Modal Sugerencias / Ideas
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const [presetCategory, setPresetCategory] = useState<string>('Todos')

  // Modal Enviar a Compras
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false)
  const [shoppingTargetDay, setShoppingTargetDay] = useState<LocalLunchMenu | null>(null)
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([])
  const [shoppingTargetList, setShoppingTargetList] = useState<'super' | 'feria'>('super')
  const [sendingToShopping, setSendingToShopping] = useState(false)

  // Toast flotante
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur))
    }, 3200)
  }

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  // Cargar minutas de la semana actual inmediatamente desde localStorage
  useEffect(() => {
    const cached = getStoredMinutas(selectedMonday)
    setMenus(cached)
    setIsInitialMount(false)

    // Cargar familyId e integrantes en segundo plano sin bloquear la UI
    async function loadMetaAndRemote() {
      try {
        const famId = (await getOfflineFamilyId()) || ''
        if (famId) {
          setFamilyId(famId)
        }

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          // Obtener family_id si no lo tenemos aún
          let resolvedFamId = famId
          if (!resolvedFamId) {
            try {
              const { data: mData } = await supabase.from('members').select('family_id').limit(1).maybeSingle()
              if (mData?.family_id) {
                resolvedFamId = mData.family_id
                setFamilyId(mData.family_id)
                saveOfflineFamilyId(mData.family_id)
              }
            } catch {}
          }

          // Cargar integrantes para el selector de cocinero
          if (resolvedFamId) {
            try {
              const { data: memData } = await supabase
                .from('family_members')
                .select('id, name')
                .eq('family_id', resolvedFamId)
              if (memData && memData.length > 0) {
                setFamilyMembers(memData)
              }
            } catch {}

            // Intentar consultar Supabase con timeout de 2.5s (no bloqueante)
            try {
              const fetchPromise = supabase
                .from('lunch_menus')
                .select('*')
                .eq('family_id', resolvedFamId)
                .eq('week_start', selectedMonday)

              const timeoutPromise = new Promise<{ data: any[] | null; error: any }>((resolve) =>
                setTimeout(() => resolve({ data: null, error: 'timeout' }), 2500)
              )

              const res: any = await Promise.race([fetchPromise, timeoutPromise])
              if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
                const formatted: LocalLunchMenu[] = res.data.map((r: any) => ({
                  id: r.id,
                  family_id: r.family_id,
                  day_of_week: Number(r.day_of_week),
                  week_start: r.week_start,
                  main_dish: r.main_dish,
                  starter: r.starter ?? null,
                  dessert: r.dessert ?? null,
                  drink: r.drink ?? null,
                  cook_name: r.cook_name ?? null,
                  notes: r.notes ?? null,
                  ingredients: Array.isArray(r.ingredients)
                    ? r.ingredients
                    : typeof r.ingredients === 'string'
                    ? r.ingredients.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [],
                  done: Boolean(r.done),
                  created_at: r.created_at,
                  _synced: true,
                }))
                setMenus(formatted)
                saveStoredMinutas(selectedMonday, formatted)
              }
            } catch {}
          }
        }
      } catch (err) {
        console.debug('[Minutas] Background sync aviso:', err)
      }
    }

    loadMetaAndRemote()
  }, [selectedMonday])

  // Mapa de menús indexados por day_of_week (1..7)
  const menuByDay = useMemo(() => {
    const map = new Map<number, LocalLunchMenu>()
    menus.forEach((m) => {
      map.set(m.day_of_week, m)
    })
    return map
  }, [menus])

  // Menú del día seleccionado
  const activeMenu = menuByDay.get(selectedDayNum)

  // Total de días planificados en la semana
  const plannedCount = menus.length

  // Navegación de semanas
  function goToPreviousWeek() {
    setSelectedMonday((prev) => addDaysStr(prev, -7))
  }

  function goToNextWeek() {
    setSelectedMonday((prev) => addDaysStr(prev, 7))
  }

  function goToCurrentWeek() {
    setSelectedMonday(currentMonday)
    setSelectedDayNum(todayDayNum)
  }

  const isCurrentWeek = selectedMonday === currentMonday

  // Abrir modal de edición/creación
  const openEditModal = useCallback((dayNum: number) => {
    setEditingDayNum(dayNum)
    const existing = menuByDay.get(dayNum)

    if (existing) {
      setMainDish(existing.main_dish || '')
      setStarter(existing.starter || '')
      setDessert(existing.dessert || '')
      setDrink(existing.drink || '')
      setCookName(existing.cook_name || '')
      setNotes(existing.notes || '')
      setIngredientsText(
        Array.isArray(existing.ingredients) ? existing.ingredients.join(', ') : ''
      )
    } else {
      setMainDish('')
      setStarter('')
      setDessert('')
      setDrink('')
      setCookName('')
      setNotes('')
      setIngredientsText('')
    }
    setAddShoppingAuto(false)
    setIsSheetOpen(true)
  }, [menuByDay])

  // Guardar almuerzo
  async function handleSaveMenu(e: React.FormEvent) {
    e.preventDefault()
    if (!mainDish.trim()) return
    setSaving(true)

    const targetFamId = familyId || (await getOfflineFamilyId()) || safeUUID()
    const existing = menuByDay.get(editingDayNum)
    const menuId = existing?.id || safeUUID()

    const parsedIngredients = ingredientsText
      .split(',')
      .map((i) => i.trim())
      .filter((i) => i.length > 0)

    const updatedItem: LocalLunchMenu = {
      id: menuId,
      family_id: targetFamId,
      day_of_week: editingDayNum,
      week_start: selectedMonday,
      main_dish: mainDish.trim(),
      starter: starter.trim() || null,
      dessert: dessert.trim() || null,
      drink: drink.trim() || null,
      cook_name: cookName.trim() || null,
      notes: notes.trim() || null,
      ingredients: parsedIngredients,
      done: existing ? existing.done : false,
      created_at: existing?.created_at || new Date().toISOString(),
      _synced: false,
      _updated_at: Date.now(),
    }

    // 1. Guardar de inmediato en estado y en localStorage
    setMenus((prev) => {
      const filtered = prev.filter((m) => m.day_of_week !== editingDayNum)
      const nextList = [...filtered, updatedItem]
      saveStoredMinutas(selectedMonday, nextList)
      return nextList
    })

    // 2. Si la tabla en Supabase está disponible, sincronizar en background sin bloquear
    ;(async () => {
      try {
        await supabase.from('lunch_menus').upsert({
          id: menuId,
          family_id: targetFamId,
          day_of_week: editingDayNum,
          week_start: selectedMonday,
          main_dish: updatedItem.main_dish,
          starter: updatedItem.starter,
          dessert: updatedItem.dessert,
          drink: updatedItem.drink,
          cook_name: updatedItem.cook_name,
          notes: updatedItem.notes,
          ingredients: updatedItem.ingredients,
          done: updatedItem.done,
          created_at: updatedItem.created_at,
        })
      } catch {}
    })()

    // 3. Si seleccionó agregar a compras automáticamente
    if (addShoppingAuto && parsedIngredients.length > 0) {
      await addIngredientsToShoppingList(parsedIngredients, autoTargetList, targetFamId)
      showToast(
        `Almuerzo guardado y ${parsedIngredients.length} ingredientes enviados a ${
          autoTargetList === 'feria' ? 'Feria Libre' : 'Supermercado'
        }`
      )
    } else {
      showToast('¡Almuerzo guardado con éxito! 🍽️')
    }

    setSaving(false)
    setIsSheetOpen(false)
  }

  // Eliminar almuerzo
  async function handleDeleteMenu(dayNum: number) {
    const existing = menuByDay.get(dayNum)
    if (!existing) return

    const dayObj = DAYS.find((d) => d.num === dayNum)
    if (!confirm(`¿Eliminar el almuerzo del ${dayObj?.name || 'día'}?`)) {
      return
    }

    setMenus((prev) => {
      const nextList = prev.filter((m) => m.day_of_week !== dayNum)
      saveStoredMinutas(selectedMonday, nextList)
      return nextList
    })

    // Sincronizar borrado en Supabase si está disponible
    ;(async () => {
      try {
        await supabase.from('lunch_menus').delete().eq('id', existing.id)
      } catch {}
    })()

    showToast('Almuerzo eliminado.')
    setIsSheetOpen(false)
  }

  // Toggle estado de preparado / listo
  function toggleDone(menu: LocalLunchMenu) {
    const nextDone = !menu.done
    const updated: LocalLunchMenu = {
      ...menu,
      done: nextDone,
      _updated_at: Date.now(),
    }

    setMenus((prev) => {
      const nextList = prev.map((m) => (m.id === menu.id ? updated : m))
      saveStoredMinutas(selectedMonday, nextList)
      return nextList
    })

    ;(async () => {
      try {
        await supabase.from('lunch_menus').update({ done: nextDone }).eq('id', menu.id)
      } catch {}
    })()

    showToast(nextDone ? '¡Almuerzo listo para servir! 🍽️' : 'Almuerzo marcado como pendiente.')
  }

  // Agregar ingredientes a Compras (/super o /feria)
  async function addIngredientsToShoppingList(
    items: string[],
    targetList: 'super' | 'feria',
    famId?: string
  ) {
    const targetFamId = famId || familyId || (await getOfflineFamilyId()) || safeUUID()

    for (const item of items) {
      const cleanName = item.trim()
      if (!cleanName) continue

      const tempId = safeUUID()
      const shoppingPayload = {
        id: tempId,
        family_id: targetFamId,
        name: cleanName,
        list: targetList,
        quantity: targetList === 'feria' ? '1 kg' : '1 unidad',
        done: false,
        created_at: new Date().toISOString(),
      }

      // Guardar en Dexie para disponibilidad inmediata en /super o /feria
      try {
        await offlineDB.shopping_lists.put({
          ...shoppingPayload,
          _synced: false,
          _updated_at: Date.now(),
        })
      } catch {}

      // Cola de sincronización hacia shopping_items
      try {
        await mutate({
          familyId: targetFamId,
          entity: 'shopping_lists',
          action: 'INSERT',
          entityId: tempId,
          payload: shoppingPayload,
        })
      } catch {}
    }
  }

  // Ejecutar envío desde el modal específico de compras
  async function handleSendShoppingFromModal() {
    if (selectedIngredients.length === 0) return
    setSendingToShopping(true)

    await addIngredientsToShoppingList(selectedIngredients, shoppingTargetList)

    setSendingToShopping(false)
    setIsShoppingModalOpen(false)
    showToast(
      `¡${selectedIngredients.length} ingredientes agregados a ${
        shoppingTargetList === 'feria' ? 'Feria Libre' : 'Supermercado'
      }! 🛒`
    )
  }

  // Abrir modal de enviar ingredientes
  function openShoppingModal(menu: LocalLunchMenu) {
    setShoppingTargetDay(menu)
    const ingList =
      Array.isArray(menu.ingredients) && menu.ingredients.length > 0
        ? menu.ingredients
        : [menu.main_dish]
    setSelectedIngredients(ingList)
    setShoppingTargetList('super')
    setIsShoppingModalOpen(true)
  }

  // Aplicar sugerencia predefinida
  function applyPreset(preset: PresetMeal) {
    setMainDish(preset.name)
    setStarter(preset.starter)
    setDessert(preset.dessert)
    setIngredientsText(preset.ingredients.join(', '))
    setIsPresetModalOpen(false)
    setIsSheetOpen(true)
    showToast(`Sugerencia cargada: ${preset.name}`)
  }

  // Sugerencia aleatoria instantánea para el día activo
  function suggestRandom() {
    const randomIndex = Math.floor(Math.random() * PRESET_MEALS.length)
    const preset = PRESET_MEALS[randomIndex]
    setEditingDayNum(selectedDayNum)
    applyPreset(preset)
  }

  // Copiar minuta semanal formateada para WhatsApp
  function copyMinutaForWhatsApp() {
    const weekLabel = formatWeekRange(selectedMonday)
    let text = `🍽️ *MINUTA DE ALMUERZOS DE LA SEMANA*\n`
    text += `📅 *Semana:* ${weekLabel}\n\n`

    DAYS.forEach((d) => {
      const item = menuByDay.get(d.num)
      const dayDate = fmtDate(addDaysStr(selectedMonday, d.num - 1))
      text += `${d.emoji} *${d.name.toUpperCase()}* (${dayDate}):\n`

      if (item && item.main_dish) {
        text += `  🍲 Fondo: ${item.main_dish}\n`
        if (item.starter) text += `  🥗 Entrada: ${item.starter}\n`
        if (item.dessert) text += `  🍮 Postre: ${item.dessert}\n`
        if (item.drink) text += `  🥤 Jugo: ${item.drink}\n`
        if (item.cook_name) text += `  👨‍🍳 Cocina: ${item.cook_name}\n`
        if (item.notes) text += `  📝 Nota: ${item.notes}\n`
      } else {
        text += `  *(Sin planificar aún)*\n`
      }
      text += `\n`
    })

    text += `✨ ¡A disfrutar de ricos almuerzos en familia! 🍴`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 ¡Minuta copiada al portapapeles para WhatsApp!')
      })
    } else {
      showToast('Minuta generada en pantalla.')
    }
  }

  // Filtrado de recetas predefinidas por categoría
  const filteredPresets = useMemo(() => {
    if (presetCategory === 'Todos') return PRESET_MEALS
    return PRESET_MEALS.filter((p) => p.category === presetCategory)
  }, [presetCategory])

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in duration-150">
      
      {/* 1. HEADER HOMOLOGADO */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer no-underline"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0 flex items-center gap-2">
              <span>Minutas</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-950/60 text-[#F2A957] border border-orange-900/60 font-bold">
                Almuerzos
              </span>
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium m-0">
              Planificación semanal para todos los días
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* 2. BARRA DE NAVEGACIÓN DE SEMANA */}
      <section className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-[#1a1a1a] rounded-[24px] border border-neutral-800/80 shadow-md">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={goToPreviousWeek}
            title="Semana anterior"
            className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex flex-col items-center sm:items-start px-2">
            <span className="text-xs font-semibold text-neutral-400">Semana</span>
            <span className="text-sm font-bold text-white capitalize">
              {formatWeekRange(selectedMonday)}
            </span>
          </div>

          <button
            type="button"
            onClick={goToNextWeek}
            title="Semana siguiente"
            className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {!isCurrentWeek && (
            <button
              type="button"
              onClick={goToCurrentWeek}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-orange-950/60 border border-orange-800/50 text-[#F2A957] hover:bg-orange-900/60 active:scale-95 transition-all cursor-pointer"
            >
              Semana Actual
            </button>
          )}
        </div>

        {/* ACCIONES RÁPIDAS DE CABECERA: COPIAR Y RECETAS */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsPresetModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all cursor-pointer"
          >
            <span>💡</span>
            <span>Ideas</span>
          </button>

          <button
            type="button"
            onClick={copyMinutaForWhatsApp}
            title="Copiar texto para compartir en WhatsApp familiar"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm active:scale-95 transition-all cursor-pointer"
            style={orangeGradient}
          >
            <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Copiar WhatsApp</span>
          </button>
        </div>
      </section>

      {/* 3. SWITCHER DE VISTA: DÍA A DÍA / SEMANA COMPLETA */}
      <nav className="flex p-1 bg-[#1a1a1a] border border-neutral-800/80 rounded-2xl relative z-10">
        <button
          type="button"
          onClick={() => setViewMode('day')}
          className={`flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
            viewMode === 'day'
              ? 'bg-[#F76911] text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Día a Día ({plannedCount}/7)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('week')}
          className={`flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
            viewMode === 'week'
              ? 'bg-[#F76911] text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Semana Completa
        </button>
      </nav>

      {/* 4. MODO DÍA A DÍA */}
      {viewMode === 'day' && (
        <div className="flex flex-col gap-4">
          {/* TABS DE LOS 7 DÍAS DE LA SEMANA */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {DAYS.map((d) => {
              const item = menuByDay.get(d.num)
              const isSelected = selectedDayNum === d.num
              const dayDate = addDaysStr(selectedMonday, d.num - 1)
              const isToday = dayDate === todayDateStr
              const hasMenu = Boolean(item && item.main_dish)

              return (
                <button
                  key={d.num}
                  type="button"
                  onClick={() => setSelectedDayNum(d.num)}
                  className={`flex flex-col items-center justify-between p-3 min-w-[70px] sm:flex-1 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#F76911] bg-gradient-to-b from-orange-950/40 to-neutral-900 shadow-md scale-[1.02]'
                      : 'border-neutral-800/80 bg-[#1a1a1a] hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span
                      className={`text-[11px] font-bold ${
                        isSelected ? 'text-[#F2A957]' : 'text-neutral-400'
                      }`}
                    >
                      {d.short}
                    </span>
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-[#F76911] shadow-[0_0_8px_#F76911]" title="Hoy" />
                    )}
                  </div>

                  <span className="text-base my-0.5">{d.emoji}</span>

                  <div className="flex items-center gap-1 mt-1">
                    {hasMenu ? (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item?.done ? 'bg-emerald-500' : 'bg-[#F76911]'
                        }`}
                      />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                    )}
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {new Date(dayDate + 'T12:00:00Z').getUTCDate()}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* CARD DETALLADA DEL DÍA ACTIVO */}
          <section className="rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 p-5 shadow-lg flex flex-col gap-4 relative overflow-hidden">
            {/* Header del día activo */}
            {(() => {
              const activeDayObj = DAYS.find((d) => d.num === selectedDayNum)
              const activeDateStr = addDaysStr(selectedMonday, selectedDayNum - 1)
              const isToday = activeDateStr === todayDateStr

              return (
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-md shrink-0"
                      style={orangeGradient}
                    >
                      {activeDayObj?.emoji || '🍽️'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-white m-0">
                          {activeDayObj?.name}
                        </h2>
                        {isToday && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#F76911] text-white text-[10px] font-black uppercase tracking-wide shadow-sm">
                            Hoy
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-400 capitalize">
                        {fmtDate(activeDateStr)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeMenu ? (
                      <button
                        type="button"
                        onClick={() => toggleDone(activeMenu)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeMenu.done
                            ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white'
                        }`}
                      >
                        <span>{activeMenu.done ? '✅' : '⚪'}</span>
                        <span>{activeMenu.done ? 'Listo' : 'Marcar listo'}</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={suggestRandom}
                          className="px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-[#F2A957] font-bold hover:text-white hover:border-neutral-700 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span>✨</span>
                          <span>Sugerir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(selectedDayNum)}
                          style={orangeGradient}
                          className="px-3 py-1.5 rounded-xl text-xs text-white font-bold shadow-sm hover:opacity-95 active:scale-95 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span>+</span>
                          <span>Añadir</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* CONTENIDO DEL ALMUERZO O ESTADO VACÍO (INMEDIATO, SIN SKELETON FREEZE) */}
            {activeMenu ? (
              <div className="flex flex-col gap-4">
                {/* Plato principal de fondo */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/30 to-neutral-900 border border-orange-900/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#F2A957]">
                    Plato de Fondo
                  </span>
                  <h3 className="text-xl font-black text-white mt-1 mb-0 leading-snug">
                    {activeMenu.main_dish}
                  </h3>
                </div>

                {/* Grid de detalles: Entrada, Postre, Bebida, Cocina */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Entrada / Ensalada */}
                  <div className="p-3.5 rounded-2xl bg-[#131313] border border-neutral-800/80 flex items-start gap-3">
                    <span className="text-xl shrink-0">🥗</span>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Entrada / Ensalada
                      </span>
                      <p className="text-xs font-bold text-neutral-200 mt-0.5 m-0">
                        {activeMenu.starter || 'Sin entrada específica'}
                      </p>
                    </div>
                  </div>

                  {/* Postre */}
                  <div className="p-3.5 rounded-2xl bg-[#131313] border border-neutral-800/80 flex items-start gap-3">
                    <span className="text-xl shrink-0">🍮</span>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Postre
                      </span>
                      <p className="text-xs font-bold text-neutral-200 mt-0.5 m-0">
                        {activeMenu.dessert || 'Fruta fresca o libre'}
                      </p>
                    </div>
                  </div>

                  {/* Bebida o Jugo */}
                  <div className="p-3.5 rounded-2xl bg-[#131313] border border-neutral-800/80 flex items-start gap-3">
                    <span className="text-xl shrink-0">🥤</span>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Jugo / Bebida
                      </span>
                      <p className="text-xs font-bold text-neutral-200 mt-0.5 m-0">
                        {activeMenu.drink || 'Agua fresca o jugo'}
                      </p>
                    </div>
                  </div>

                  {/* Quién Cocina */}
                  <div className="p-3.5 rounded-2xl bg-[#131313] border border-neutral-800/80 flex items-start gap-3">
                    <span className="text-xl shrink-0">👨‍🍳</span>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Quién Cocina
                      </span>
                      <p className="text-xs font-bold text-[#F2A957] mt-0.5 m-0">
                        {activeMenu.cook_name || 'Por definir'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ingredientes con botón rápido de envío a compras */}
                {activeMenu.ingredients && activeMenu.ingredients.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#131313] border border-neutral-800/80 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🛒</span>
                        <span>Ingredientes necesarios ({activeMenu.ingredients.length})</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => openShoppingModal(activeMenu)}
                        className="text-xs text-[#F76911] font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>+ Enviar a Compras</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {activeMenu.ingredients.map((ing, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 font-medium"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas o receta breve */}
                {activeMenu.notes && (
                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/60 text-xs text-neutral-300 flex items-start gap-2">
                    <span className="text-base shrink-0">📝</span>
                    <span className="italic leading-relaxed">{activeMenu.notes}</span>
                  </div>
                )}

                {/* Barra de acciones de la minuta activa */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteMenu(selectedDayNum)}
                    className="px-3.5 py-2 rounded-xl bg-red-950/30 border border-red-900/40 text-red-400 text-xs font-bold hover:bg-red-900/40 active:scale-95 transition-all cursor-pointer"
                  >
                    Borrar
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openShoppingModal(activeMenu)}
                      className="px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-bold hover:text-white hover:border-neutral-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🛒</span>
                      <span>Compras</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(selectedDayNum)}
                      style={orangeGradient}
                      className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Editar Almuerzo</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ESTADO VACÍO CLARO Y DIRECTO CON BOTÓN PLANIFICAR */
              <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-3">
                <span className="text-4xl">🍲</span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold text-white m-0">
                    Sin almuerzo planificado
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-[280px] m-0">
                    Añade un plato de fondo, ensalada y postre para organizar la comida de este día.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={suggestRandom}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-bold hover:text-white hover:border-neutral-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>✨</span>
                    <span>Sugerir plato</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(selectedDayNum)}
                    style={orangeGradient}
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span>Planificar almuerzo</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 5. MODO SEMANA COMPLETA (TODOS LOS DÍAS) */}
      {viewMode === 'week' && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Resumen semanal de almuerzos
            </span>
            <span className="text-xs font-bold text-[#F2A957]">
              {plannedCount} de 7 días planificados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {DAYS.map((d) => {
              const item = menuByDay.get(d.num)
              const dayDate = addDaysStr(selectedMonday, d.num - 1)
              const isToday = dayDate === todayDateStr

              return (
                <article
                  key={d.num}
                  onClick={() => {
                    setSelectedDayNum(d.num)
                    setViewMode('day')
                  }}
                  className={`p-4 rounded-[24px] border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isToday
                      ? 'bg-gradient-to-br from-orange-950/30 to-[#1a1a1a] border-[#F76911]/60 shadow-md'
                      : 'bg-[#1a1a1a] border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{d.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white m-0">
                            {d.name}
                          </h3>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full bg-[#F76911] text-white text-[9px] font-black uppercase tracking-wide">
                              Hoy
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400 capitalize">
                          {fmtDate(dayDate)}
                        </span>
                      </div>
                    </div>

                    {item?.done && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                        Listo
                      </span>
                    )}
                  </div>

                  {item ? (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <p className="text-sm font-bold text-neutral-200 m-0 line-clamp-1">
                        {item.main_dish}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 flex-wrap">
                        {item.starter && (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <span>🥗</span>
                            <span className="truncate">{item.starter}</span>
                          </span>
                        )}
                        {item.cook_name && (
                          <span className="flex items-center gap-1 text-[#F2A957]">
                            <span>👨‍🍳</span>
                            <span>{item.cook_name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 text-xs text-neutral-500 italic">
                      Sin almuerzo planificado
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                    <span className="text-[11px] text-neutral-500 font-medium">
                      {item?.ingredients && item.ingredients.length > 0
                        ? `${item.ingredients.length} ingredientes`
                        : ''}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(d.num)
                      }}
                      className="text-xs font-bold text-[#F76911] hover:underline cursor-pointer"
                    >
                      {item ? 'Editar' : '+ Planificar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* 6. BOTÓN FLOTANTE (FAB) PARA PLANIFICAR */}
      <button
        type="button"
        onClick={() => openEditModal(selectedDayNum)}
        aria-label="Planificar almuerzo del día"
        style={orangeGradient}
        className="fixed bottom-24 right-5 sm:bottom-24 sm:right-8 lg:right-12 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_24px_rgba(247,105,17,0.5)] hover:scale-105 active:scale-90 transition-transform cursor-pointer z-40 border-2 border-white/20"
      >
        <svg className="w-7 h-7 stroke-current stroke-2 fill-none pointer-events-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* 7. BOTTOM SHEET MODAL: CREAR / EDITAR ALMUERZO */}
      {isSheetOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSheetOpen(false)
          }}
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-[#161616] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-200"
          >
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍽️</span>
                <h3 className="text-lg font-black text-white m-0">
                  {menuByDay.get(editingDayNum) ? 'Editar Almuerzo' : 'Planificar Almuerzo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="flex flex-col gap-3.5">
              {/* Selector de Día */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Día de la semana
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {DAYS.map((d) => (
                    <button
                      key={d.num}
                      type="button"
                      onClick={() => {
                        setEditingDayNum(d.num)
                        const item = menuByDay.get(d.num)
                        if (item) {
                          setMainDish(item.main_dish || '')
                          setStarter(item.starter || '')
                          setDessert(item.dessert || '')
                          setDrink(item.drink || '')
                          setCookName(item.cook_name || '')
                          setNotes(item.notes || '')
                          setIngredientsText(
                            Array.isArray(item.ingredients) ? item.ingredients.join(', ') : ''
                          )
                        } else {
                          setMainDish('')
                          setStarter('')
                          setDessert('')
                          setDrink('')
                          setCookName('')
                          setNotes('')
                          setIngredientsText('')
                        }
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                        editingDayNum === d.num
                          ? 'bg-[#F76911] text-white shadow-sm'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
                      }`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plato Principal (Fondo) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">
                    Plato Principal / Fondo *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSheetOpen(false)
                      setIsPresetModalOpen(true)
                    }}
                    className="text-[11px] text-[#F2A957] font-semibold hover:underline cursor-pointer"
                  >
                    Ver sugerencias 💡
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="ej. Cazuela de vacuno, Lentejas con arroz..."
                  value={mainDish}
                  onChange={(e) => setMainDish(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-[#F76911] transition-colors"
                />
              </div>

              {/* Fila: Entrada y Postre */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-neutral-400">
                    🥗 Entrada / Ensalada
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Ensalada chilena, apio con palta..."
                    value={starter}
                    onChange={(e) => setStarter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-[#F76911]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-neutral-400">
                    🍮 Postre
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Fruta fresca, jalea, mote con huesillo..."
                    value={dessert}
                    onChange={(e) => setDessert(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-[#F76911]"
                  />
                </div>
              </div>

              {/* Fila: Jugo/Bebida y Quién Cocina */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-neutral-400">
                    🥤 Jugo / Bebida
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Limonada con menta, agua..."
                    value={drink}
                    onChange={(e) => setDrink(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-[#F76911]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-neutral-400">
                    👨‍🍳 Quién Cocina
                  </label>
                  {familyMembers.length > 0 ? (
                    <div className="flex gap-1.5">
                      <select
                        value={cookName}
                        onChange={(e) => setCookName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-[#F76911]"
                      >
                        <option value="">Seleccionar o escribir...</option>
                        {familyMembers.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="ej. Papá, Mamá..."
                      value={cookName}
                      onChange={(e) => setCookName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-[#F76911]"
                    />
                  )}
                </div>
              </div>

              {/* Ingredientes necesarios */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-400">
                  🛒 Ingredientes necesarios (separados por coma)
                </label>
                <input
                  type="text"
                  placeholder="ej. Carne cazuela, choclo, zapallo, cilantro, arroz..."
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-[#F76911]"
                />
              </div>

              {/* Notas adicionales */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-400">
                  📝 Notas / Preparación rápida
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Dejar remojando porotos la noche anterior..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-[#F76911] resize-none"
                />
              </div>

              {/* CHECKBOX: AGREGAR A LISTA DE COMPRAS */}
              {ingredientsText.trim().length > 0 && (
                <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 text-xs text-neutral-200 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addShoppingAuto}
                      onChange={(e) => setAddShoppingAuto(e.target.checked)}
                      className="w-4 h-4 rounded text-[#F76911] focus:ring-0 cursor-pointer accent-[#F76911]"
                    />
                    <span>Agregar estos ingredientes a Compras al guardar</span>
                  </label>

                  {addShoppingAuto && (
                    <div className="flex items-center gap-3 pl-6">
                      <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                        <input
                          type="radio"
                          name="targetList"
                          value="super"
                          checked={autoTargetList === 'super'}
                          onChange={() => setAutoTargetList('super')}
                          className="accent-[#F76911]"
                        />
                        <span>Supermercado (/super)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                        <input
                          type="radio"
                          name="targetList"
                          value="feria"
                          checked={autoTargetList === 'feria'}
                          onChange={() => setAutoTargetList('feria')}
                          className="accent-[#F76911]"
                        />
                        <span>Feria Libre (/feria)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white text-xs font-bold border border-neutral-800 cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={orangeGradient}
                  className="px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Almuerzo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL DE SUGERENCIAS / BANCO DE RECETAS */}
      {isPresetModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPresetModalOpen(false)
          }}
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl bg-[#161616] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] max-h-[85vh] overflow-y-auto p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <h3 className="text-lg font-black text-white m-0">
                  Sugerencias de Almuerzos Caseros
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filtros de categoría */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {['Todos', 'Legumbres', 'Caseros', 'Pollo y Carnes', 'Pastas', 'Pescados', 'Ligeros'].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPresetCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      presetCategory === cat
                        ? 'bg-[#F76911] text-white shadow-sm'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            {/* Listado de recetas predefinidas */}
            <div className="flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {filteredPresets.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => applyPreset(preset)}
                  className="p-3.5 rounded-2xl bg-[#1a1a1a] border border-neutral-800/80 hover:border-[#F76911] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white group-hover:text-[#F2A957] transition-colors truncate">
                        {preset.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-400 text-[10px] font-semibold shrink-0">
                        {preset.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                      <span>🥗 {preset.starter}</span>
                      <span>•</span>
                      <span>🍮 {preset.dessert}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-orange-950/60 border border-orange-800/60 text-[#F2A957] text-xs font-bold shrink-0 group-hover:bg-[#F76911] group-hover:text-white transition-all"
                  >
                    Usar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: ENVIAR INGREDIENTES A COMPRAS (SUPER O FERIA) */}
      {isShoppingModalOpen && shoppingTargetDay && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsShoppingModalOpen(false)
          }}
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#161616] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h3 className="text-lg font-black text-white m-0">
                  Enviar a Lista de Compras
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShoppingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-300 m-0">
              Selecciona los ingredientes para <strong className="text-white">{shoppingTargetDay.main_dish}</strong>:
            </p>

            {/* Selector de lista destino: Supermercado o Feria */}
            <div className="flex p-1 bg-[#131313] border border-neutral-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setShoppingTargetList('super')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  shoppingTargetList === 'super'
                    ? 'bg-[#F76911] text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Supermercado (/super)
              </button>
              <button
                type="button"
                onClick={() => setShoppingTargetList('feria')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  shoppingTargetList === 'feria'
                    ? 'bg-[#F76911] text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Feria Libre (/feria)
              </button>
            </div>

            {/* Checkboxes de ingredientes */}
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
              {(Array.isArray(shoppingTargetDay.ingredients) && shoppingTargetDay.ingredients.length > 0
                ? shoppingTargetDay.ingredients
                : [shoppingTargetDay.main_dish]
              ).map((ing, idx) => {
                const isChecked = selectedIngredients.includes(ing)
                return (
                  <label
                    key={idx}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIngredients((prev) => [...prev, ing])
                        } else {
                          setSelectedIngredients((prev) => prev.filter((i) => i !== ing))
                        }
                      }}
                      className="w-4 h-4 rounded text-[#F76911] accent-[#F76911]"
                    />
                    <span className="text-xs font-bold text-white">{ing}</span>
                  </label>
                )
              })}
            </div>

            {/* Botón confirmar */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsShoppingModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white text-xs font-bold border border-neutral-800"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={sendingToShopping || selectedIngredients.length === 0}
                onClick={handleSendShoppingFromModal}
                style={orangeGradient}
                className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {sendingToShopping
                  ? 'Agregando...'
                  : `Agregar (${selectedIngredients.length}) a ${
                      shoppingTargetList === 'feria' ? 'Feria' : 'Súper'
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. TOAST FLOTANTE */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[90] bg-[#161616] border border-[#F76911]/60 text-white px-4 py-2.5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <span className="text-[#F2A957]">✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  )
}
