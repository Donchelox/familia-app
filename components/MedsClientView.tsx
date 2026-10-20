'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import { recordActivity } from '@/lib/audit'
import { useActionParam } from '@/lib/useActionParam'
import { offlineDB } from '@/lib/offline/db'
import { useOfflineMutation } from '@/lib/offline/useOfflineMutation'
import { getOfflineFamilyId, saveOfflineFamilyId } from '@/lib/offline/familyContext'
import { safeUUID } from '@/lib/uuid'

export interface Medication {
  id: string
  name: string
  dose: string
  times: string[]
  person: string
  frequency?: string
  end_date?: string | null
  stock?: number | null
  stock_alert_threshold?: number | null
  icon_type?: string
  instructions?: string | null
}

interface Member {
  id: string
  name: string
}

interface Props {
  familyId: string
  meds: Medication[]
  members: Member[]
  takenKeys: string[]
  todayStr: string
  currentHM: string
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'L', name: 'Lun' },
  { id: 2, label: 'M', name: 'Mar' },
  { id: 3, label: 'X', name: 'Mié' },
  { id: 4, label: 'J', name: 'Jue' },
  { id: 5, label: 'V', name: 'Vie' },
  { id: 6, label: 'S', name: 'Sáb' },
  { id: 7, label: 'D', name: 'Dom' },
]

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Todos los días' },
  { value: 'custom_days', label: 'Días específicos de la semana' },
  { value: 'every_8h', label: 'Cada 8 horas' },
  { value: 'every_12h', label: 'Cada 12 horas' },
  { value: 'weekdays', label: 'Lunes a Viernes' },
  { value: 'weekends', label: 'Fines de semana' },
  { value: 'as_needed', label: 'Según necesidad (SOS)' },
]

export const PRESENTATION_TYPES = [
  { id: 'pill', label: 'Comprimido / Cápsula', shortLabel: 'Comprimido', icon: '💊' },
  { id: 'syrup', label: 'Jarabe / Líquido', shortLabel: 'Jarabe', icon: '🧴' },
  { id: 'drops', label: 'Gotas oftálmicas/orales', shortLabel: 'Gotas', icon: '💧' },
  { id: 'inhaler', label: 'Inhalador / Aerosol', shortLabel: 'Inhalador', icon: '💨' },
  { id: 'injection', label: 'Inyectable / Insulina', shortLabel: 'Inyección', icon: '💉' },
  { id: 'cream', label: 'Pomada / Gel / Crema', shortLabel: 'Crema', icon: '🩹' },
  { id: 'other', label: 'Otro formato', shortLabel: 'Otro', icon: '🌿' },
] as const

const INSTRUCTION_PRESETS = [
  { label: 'En ayunas', icon: '🍽️' },
  { label: 'Con comida', icon: '🥗' },
  { label: 'Antes de dormir', icon: '🌙' },
  { label: 'Con agua', icon: '💧' },
  { label: 'Refrigerar', icon: '❄️' },
]

function MedTypeIcon({ type, className = 'w-5 h-5' }: { type?: string; className?: string }) {
  switch (type) {
    case 'syrup':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6v3H9z" />
          <path d="M10 6v3" />
          <path d="M14 6v3" />
          <rect x="6" y="9" width="12" height="12" rx="3" />
          <path d="M6 14h12" />
        </svg>
      )
    case 'drops':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      )
    case 'inhaler':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="3" width="7" height="9" rx="2" />
          <path d="M7 10h10a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H7" />
          <path d="M19 14h2" />
        </svg>
      )
    case 'injection':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 2 4 4" />
          <path d="m17 7 3-3" />
          <path d="M19 9 8.7 19.3c-.4.4-1 .6-1.6.6H3v-4.1c0-.6.2-1.2.6-1.6L14 3.9" />
          <path d="m9 11 4 4" />
          <path d="m5 19-3 3" />
        </svg>
      )
    case 'cream':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 21h10a2 2 0 0 0 2-2V8l-7-5-7 5v11a2 2 0 0 0 2 2z" />
          <path d="M9 12h6" />
        </svg>
      )
    case 'other':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      )
    case 'pill':
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
          <path d="m8.5 8.5 7 7" />
        </svg>
      )
  }
}

export default function MedsClientView({
  familyId,
  meds: initialMeds,
  members,
  takenKeys: initialTakenKeys,
  todayStr,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { mutate } = useOfflineMutation()

  const [meds, setMeds] = useState<Medication[]>(initialMeds)
  const [takenKeys, setTakenKeys] = useState<Set<string>>(new Set(initialTakenKeys))
  const [selectedPerson, setSelectedPerson] = useState<string>('todos')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [refillMed, setRefillMed] = useState<Medication | null>(null)
  const [refillAmount, setRefillAmount] = useState<number>(30)
  const [filterLowStockOnly, setFilterLowStockOnly] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  // Sincronizar con Dexie para disponibilidad offline sin alterar el estado inicial autoritativo
  useEffect(() => {
    async function loadLocalMeds() {
      try {
        const activeFamilyId = familyId || (await getOfflineFamilyId())
        if (familyId) {
          saveOfflineFamilyId(familyId)
        }

        if (!activeFamilyId) return

        // 1. Si ya recibimos datos autoritativos del servidor (initialMeds), NO los sobreescribimos
        // para evitar saltos o reordenamientos en pantalla. Guardamos en Dexie para caché offline.
        if (initialMeds && initialMeds.length > 0) {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            await offlineDB.medicines.bulkPut(
              initialMeds.map((m) => ({
                id: m.id,
                family_id: activeFamilyId,
                name: m.name,
                person: m.person,
                dose: m.dose,
                times: m.times,
                frequency: m.frequency,
                end_date: m.end_date || undefined,
                stock: m.stock !== undefined ? m.stock : null,
                stock_alert_threshold: m.stock_alert_threshold ?? 5,
                icon_type: m.icon_type || 'pill',
                instructions: m.instructions || undefined,
                _synced: true,
              }))
            )
          }

          // Incorporar únicamente elementos creados offline aún pendientes de sincronizar
          const unsynced = await offlineDB.medicines
            .where('family_id')
            .equals(activeFamilyId)
            .filter((m) => m._synced === false)
            .toArray()

          if (unsynced.length > 0) {
            setMeds((prev) => {
              const map = new Map<string, Medication>()
              prev.forEach((m) => map.set(m.id, m))
              let hasNew = false
              unsynced.forEach((m) => {
                if (!map.has(m.id)) {
                  hasNew = true
                  map.set(m.id, {
                    id: m.id,
                    name: m.name,
                    dose: m.dose,
                    times: m.times,
                    person: m.person,
                    frequency: m.frequency,
                    end_date: m.end_date,
                    stock: m.stock !== undefined ? m.stock : null,
                    stock_alert_threshold: m.stock_alert_threshold ?? 5,
                    icon_type: m.icon_type || 'pill',
                    instructions: m.instructions || null,
                  })
                }
              })
              return hasNew ? Array.from(map.values()) : prev
            })
          }
          return
        }

        // 2. Si initialMeds vino vacío (ej. sin conexión al servidor / PWA offline):
        const local = await offlineDB.medicines.where('family_id').equals(activeFamilyId).toArray()
        if (local && local.length > 0) {
          const activeLocal = local.filter((m) => {
            if (!m.end_date) return true
            return m.end_date >= todayStr
          })

          setMeds(
            activeLocal.map((m) => ({
              id: m.id,
              name: m.name,
              dose: m.dose,
              times: m.times,
              person: m.person,
              frequency: m.frequency,
              end_date: m.end_date,
              stock: m.stock !== undefined ? m.stock : null,
              stock_alert_threshold: m.stock_alert_threshold ?? 5,
              icon_type: m.icon_type || 'pill',
              instructions: m.instructions || null,
            }))
          )
        }
      } catch (e) {
        console.warn('[Offline] Error sincronizando medicinas con Dexie:', e)
      }
    }

    loadLocalMeds()

    function handleSyncComplete() {
      loadLocalMeds()
    }
    window.addEventListener('casa-sync-complete', handleSyncComplete)
    return () => {
      window.removeEventListener('casa-sync-complete', handleSyncComplete)
    }
  }, [familyId, initialMeds, todayStr])

  // Formulario Crear / Editar
  const [membersList, setMembersList] = useState<Member[]>(members || [])

  useEffect(() => {
    try {
      const cached = localStorage.getItem('casa_family_members')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMembersList((prev) => {
            const map = new Map<string, Member>()
            prev.forEach((m) => map.set(m.name.toLowerCase(), m))
            parsed.forEach((m: any, idx: number) => {
              const mName = typeof m === 'string' ? m : m?.name
              if (mName && !map.has(mName.toLowerCase())) {
                map.set(mName.toLowerCase(), { id: m?.id || `cached-${idx}`, name: mName })
              }
            })
            return Array.from(map.values())
          })
        }
      }
    } catch { }
  }, [])

  const defaultMemberName = membersList[0]?.name || members[0]?.name || ''
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [person, setPerson] = useState(defaultMemberName)
  const [times, setTimes] = useState<string[]>(['08:00'])
  const [frequency, setFrequency] = useState('daily')
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5])
  const [endDate, setEndDate] = useState('')
  const [iconType, setIconType] = useState<string>('pill')
  const [instructions, setInstructions] = useState<string>('')
  const [enableStock, setEnableStock] = useState<boolean>(false)
  const [stock, setStock] = useState<string | number>('')
  const [stockAlertThreshold, setStockAlertThreshold] = useState<number>(5)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  const currentIsoDay = (() => {
    const d = new Date().getDay()
    return d === 0 ? 7 : d
  })()

  function toggleDay(dayId: number) {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    )
  }

  function addTimeSlot() {
    const last = times[times.length - 1] || '08:00'
    const [h, m] = last.split(':').map(Number)
    const nextH = (h + 4) % 24
    const nextTime = `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
    setTimes((prev) => [...prev, nextTime].sort())
  }

  function updateTimeSlot(idx: number, val: string) {
    setTimes((prev) => {
      const copy = [...prev]
      copy[idx] = val
      return copy
    })
  }

  function removeTimeSlot(idx: number) {
    if (times.length <= 1) return
    setTimes((prev) => prev.filter((_, i) => i !== idx))
  }

  function applyPresetTimes(preset: string[]) {
    setTimes([...preset])
  }

  function openCreateModal() {
    setEditingId(null)
    setName('')
    setDose('')
    setPerson(defaultMemberName)
    setTimes(['08:00'])
    setFrequency('daily')
    setSelectedDays([1, 3, 5])
    setEndDate('')
    setIconType('pill')
    setInstructions('')
    setEnableStock(false)
    setStock('')
    setStockAlertThreshold(5)
    setIsModalOpen(true)
  }

  useActionParam({ new: openCreateModal })

  function openEditModal(med: Medication) {
    if (!med) return
    setEditingId(med.id)
    setName(med.name || '')
    setDose(med.dose || '')
    setPerson(med.person || defaultMemberName)
    setTimes(Array.isArray(med.times) && med.times.length > 0 ? [...med.times].sort() : ['08:00'])
    setEndDate(med.end_date || '')
    setIconType(med.icon_type || 'pill')
    setInstructions(med.instructions || '')

    const hasStock = med.stock !== null && med.stock !== undefined
    setEnableStock(hasStock)
    setStock(hasStock ? med.stock! : '')
    setStockAlertThreshold(med.stock_alert_threshold ?? 5)

    if (med.frequency?.startsWith('days:')) {
      setFrequency('custom_days')
      const days = med.frequency.replace('days:', '').split(',').map(Number).filter(Boolean)
      setSelectedDays(days.length > 0 ? days : [1, 3, 5])
    } else {
      setFrequency(med.frequency || 'daily')
      setSelectedDays([1, 3, 5])
    }

    setIsModalOpen(true)
  }

  // Agregar al Supermercado
  async function handleAddToSuper(med: Medication) {
    try {
      const targetFamilyId = familyId || (await getOfflineFamilyId())
      const tempId = safeUUID()
      const itemName = `${med.name}${med.dose ? ` (${med.dose})` : ''}`

      await mutate({
        familyId: targetFamilyId,
        entity: 'shopping_lists',
        action: 'INSERT',
        entityId: tempId,
        payload: {
          id: tempId,
          family_id: targetFamilyId,
          name: itemName,
          list: 'super',
          category: 'Farmacia',
          done: false,
          created_at: new Date().toISOString(),
        },
      })
      showToast(`¡"${med.name}" añadido a la lista del Super!`)
    } catch (err) {
      console.warn('[Meds] Error agregando a compras:', err)
      showToast(`Error al agregar a compras`)
    }
  }

  // Recarga rápida de stock
  async function handleQuickRefillSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!refillMed) return
    const current = refillMed.stock ?? 0
    const newStock = Math.max(0, current + Number(refillAmount))

    setMeds((prev) =>
      prev.map((m) => (m.id === refillMed.id ? { ...m, stock: newStock } : m))
    )

    try {
      const targetFamilyId = familyId || (await getOfflineFamilyId())
      await offlineDB.medicines.update(refillMed.id, { stock: newStock })
      await mutate({
        familyId: targetFamilyId,
        entity: 'medicines',
        action: 'UPDATE',
        entityId: refillMed.id,
        payload: {
          family_id: targetFamilyId,
          ...refillMed,
          stock: newStock,
        },
      })
      showToast(`Stock de "${refillMed.name}" actualizado a ${newStock} unidades`)
    } catch (err) {
      console.warn('[Meds] Error actualizando stock:', err)
    }
    setRefillMed(null)
  }

  // Todas las dosis programadas para hoy
  const allDoses = meds
    .filter((med) => {
      const freq = med.frequency || 'daily'
      if (freq === 'daily' || freq === 'every_8h' || freq === 'every_12h' || freq === 'as_needed') return true
      if (freq === 'weekdays') return currentIsoDay >= 1 && currentIsoDay <= 5
      if (freq === 'weekends') return currentIsoDay === 6 || currentIsoDay === 7
      if (freq.startsWith('days:')) {
        const days = freq.replace('days:', '').split(',').map(Number)
        return days.includes(currentIsoDay)
      }
      return true
    })
    .flatMap((med) =>
      (med.times || ['08:00']).map((t) => {
        const doseKey = `${med.id}_${t}`
        return {
          key: doseKey,
          medId: med.id,
          med,
          name: med.name,
          dose: med.dose,
          person: med.person || 'General',
          time: t,
          frequency: med.frequency || 'daily',
          endDate: med.end_date,
          stock: med.stock,
          stockAlertThreshold: med.stock_alert_threshold ?? 5,
          iconType: med.icon_type || 'pill',
          instructions: med.instructions,
          isTaken: takenKeys.has(doseKey),
        }
      })
    )
    .sort((a, b) => {
      // 1. Horario cronológico (08:00, 12:00, 20:00)
      const timeDiff = a.time.localeCompare(b.time)
      if (timeDiff !== 0) return timeDiff
      // 2. Nombre del medicamento
      const nameDiff = (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
      if (nameDiff !== 0) return nameDiff
      // 3. Integrante asignado
      const personDiff = (a.person || '').localeCompare(b.person || '', 'es', { sensitivity: 'base' })
      if (personDiff !== 0) return personDiff
      // 4. Tie-breaker inmutable por id de medicamento
      return a.medId.localeCompare(b.medId)
    })

  const countLowStock = meds.filter(
    (m) => m.stock !== null && m.stock !== undefined && m.stock <= (m.stock_alert_threshold ?? 5)
  ).length

  // Filtrado por persona, stock y búsqueda
  const filteredDoses = allDoses.filter((d) => {
    if (selectedPerson !== 'todos' && d.person.toLowerCase() !== selectedPerson.toLowerCase()) {
      return false
    }
    if (filterLowStockOnly) {
      const hasStock = d.stock !== null && d.stock !== undefined
      if (!hasStock || d.stock! > (d.stockAlertThreshold ?? 5)) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchName = d.name.toLowerCase().includes(q)
      const matchDose = d.dose?.toLowerCase().includes(q)
      const matchPerson = d.person?.toLowerCase().includes(q)
      const matchInst = d.instructions?.toLowerCase().includes(q)
      if (!matchName && !matchDose && !matchPerson && !matchInst) return false
    }
    return true
  })

  const totalDoses = filteredDoses.length
  const completedDoses = filteredDoses.filter((d) => d.isTaken).length

  const availableFilterPersons = useMemo(() => {
    const list = Array.from(
      new Set([
        ...membersList.map((m) => m.name),
        ...meds.map((m) => m.person).filter(Boolean),
      ])
    )
    return list.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [membersList, meds])

  const allSelectableMembers = Array.from(
    new Set([
      ...membersList.map((m) => m.name),
      person,
      defaultMemberName,
    ].filter(Boolean))
  )

  // Marcar / desmarcar toma con ajuste automático de stock
  async function toggleDose(medId: string, doseTime: string, currentTaken: boolean) {
    const key = `${medId}_${doseTime}`
    setLoadingAction(key)

    const nextTaken = !currentTaken
    const updated = new Set(takenKeys)

    // 1. Optimistic UI de la dosis en React
    if (nextTaken) {
      updated.add(key)
    } else {
      updated.delete(key)
    }
    setTakenKeys(updated)

    // 2. Descontar / devolver stock automáticamente si tiene stock configurado
    const targetMed = meds.find((m) => m.id === medId)
    if (targetMed && targetMed.stock !== null && targetMed.stock !== undefined) {
      const curStock = targetMed.stock
      const newStock = nextTaken ? Math.max(0, curStock - 1) : curStock + 1

      setMeds((prev) =>
        prev.map((m) => (m.id === medId ? { ...m, stock: newStock } : m))
      )

      try {
        const targetFamilyId = familyId || (await getOfflineFamilyId())
        await offlineDB.medicines.update(medId, { stock: newStock })
        await mutate({
          familyId: targetFamilyId,
          entity: 'medicines',
          action: 'UPDATE',
          entityId: medId,
          payload: {
            family_id: targetFamilyId,
            ...targetMed,
            stock: newStock,
          },
        })
      } catch (e) {
        console.warn('[Meds] Error actualizando stock:', e)
      }
    }

    // 3. Quitar notificación de la bandeja si ya se tomó
    if (nextTaken && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.getNotifications({ tag: `med-${medId}-${todayStr}-${doseTime}` }))
        .then((list) => list.forEach((n) => n.close()))
        .catch(() => { })
    }

    // 4. Sincronizar en remoto si estamos online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const targetFamilyId = familyId || (await getOfflineFamilyId())
        if (!nextTaken) {
          await supabase
            .from('dose_logs')
            .delete()
            .eq('family_id', targetFamilyId)
            .eq('medication_id', medId)
            .eq('time', doseTime)
            .eq('day', todayStr)
        } else {
          await supabase.from('dose_logs').insert({
            family_id: targetFamilyId,
            medication_id: medId,
            time: doseTime,
            day: todayStr,
          })
        }
      } catch (err) {
        console.warn('[Offline] Error registrando dosis en servidor:', err)
      }
    }

    setLoadingAction(null)
  }

  // Guardar (Crear o Actualizar)
  async function handleSaveMed(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)

    const finalFrequency =
      frequency === 'custom_days'
        ? `days:${selectedDays.join(',')}`
        : frequency

    const tempId = editingId || safeUUID()
    const cleanTimes = times.filter(Boolean).length > 0 ? times.filter(Boolean).sort() : ['08:00']

    const parsedStock = enableStock && stock !== '' ? Number(stock) : null

    const medPayload: Medication = {
      id: tempId,
      name: name.trim(),
      dose: dose.trim(),
      person: person.trim() || defaultMemberName,
      times: cleanTimes,
      frequency: finalFrequency,
      end_date: endDate ? endDate : null,
      stock: parsedStock,
      stock_alert_threshold: enableStock ? Number(stockAlertThreshold) || 5 : null,
      icon_type: iconType,
      instructions: instructions.trim() || null,
    }

    // 1. Actualización optimista inmediata
    setMeds((prev) => {
      if (editingId) {
        return prev.map((m) => (m.id === editingId ? medPayload : m))
      } else {
        return [...prev, medPayload]
      }
    })

    // 2. Persistencia en Dexie y encolado en sync_queue
    try {
      const targetFamilyId = familyId || (await getOfflineFamilyId())
      await mutate({
        familyId: targetFamilyId,
        entity: 'medicines',
        action: editingId ? 'UPDATE' : 'INSERT',
        entityId: tempId,
        payload: {
          family_id: targetFamilyId,
          ...medPayload,
        },
      })
    } catch (err) {
      console.warn('[Offline] Mutación encolada localmente:', err)
    }

    setIsSaving(false)
    setIsModalOpen(false)
  }

  async function handleDeleteMed() {
    if (!editingId) return
    if (!confirm(`¿Deseas eliminar el recordatorio de "${name}"?`)) return
    setIsDeleting(true)

    const targetId = editingId

    setMeds((prev) => prev.filter((m) => m.id !== targetId))

    try {
      const targetFamilyId = familyId || (await getOfflineFamilyId())
      await mutate({
        familyId: targetFamilyId,
        entity: 'medicines',
        action: 'DELETE',
        entityId: targetId,
      })
    } catch (err) {
      console.warn('[Offline] Eliminación encolada localmente:', err)
    }

    setIsDeleting(false)
    setIsModalOpen(false)
  }

  return (
    <div className="w-full flex flex-col gap-5 select-none pb-12">
      {/* Toast flotante */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <span>✨</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0 leading-tight">
              Medicamentos
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium m-0">
              Botiquín y tomas diarias de la familia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* Barra de Búsqueda y Alerta de Stock Bajo */}
      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar medicamento, integrante o indicación..."
            className="w-full bg-[#181818] border border-neutral-800/80 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
          />
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-500">
            <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-white cursor-pointer text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Resumen de Dosis y Chip de Stock Bajo */}
        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#1a1a1a] border border-neutral-800 text-[11px] font-bold text-neutral-300">
              {completedDoses}/{totalDoses} tomadas hoy
            </span>

            {countLowStock > 0 && (
              <button
                type="button"
                onClick={() => setFilterLowStockOnly((prev) => !prev)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${filterLowStockOnly
                  ? 'bg-amber-500 text-neutral-950 font-black shadow-md'
                  : 'bg-amber-950/60 border border-amber-800/80 text-amber-300 hover:bg-amber-900/60'
                  }`}
              >
                <span>⚠️</span>
                <span>{countLowStock} con stock bajo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros por Integrante */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedPerson('todos')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${selectedPerson === 'todos'
            ? 'bg-[#F76911] text-white shadow-[0_4px_12px_rgba(247,105,17,0.3)]'
            : 'bg-[#1a1a1a] text-neutral-400 border border-neutral-800/80 hover:text-white'
            }`}
        >
          Todos
        </button>

        {availableFilterPersons.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSelectedPerson(p)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${selectedPerson.toLowerCase() === p.toLowerCase()
              ? 'bg-[#F76911] text-white shadow-[0_4px_12px_rgba(247,105,17,0.3)]'
              : 'bg-[#1a1a1a] text-neutral-400 border border-neutral-800/80 hover:text-white'
              }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Lista de Dosis */}
      <main className="flex flex-col gap-3">
        {filteredDoses.length === 0 ? (
          <div className="p-8 text-center bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
              <svg className="w-6 h-6 stroke-current fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-300 m-0">
                {filterLowStockOnly
                  ? 'No hay medicamentos con stock bajo'
                  : searchQuery
                    ? 'No se encontraron medicamentos para esta búsqueda'
                    : 'No hay dosis registradas o pendientes para hoy'}
              </p>
              <p className="text-xs text-neutral-500 mt-1 m-0">
                {filterLowStockOnly
                  ? 'El inventario de todos los remedios se encuentra al día.'
                  : 'Añade medicamentos para programar horarios y controlar el stock del botiquín.'}
              </p>
            </div>
            {!filterLowStockOnly && (
              <button
                type="button"
                onClick={openCreateModal}
                style={orangeGradient}
                className="mt-2 px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                + Añadir medicamento
              </button>
            )}
          </div>
        ) : (
          filteredDoses.map((dose) => {
            const hasStock = dose.stock !== null && dose.stock !== undefined
            const isOutOfStock = hasStock && dose.stock! <= 0
            const isLowStock = hasStock && !isOutOfStock && dose.stock! <= (dose.stockAlertThreshold ?? 5)

            return (
              <article
                key={dose.key}
                className={`p-4 rounded-[26px] border transition-all flex flex-col gap-2.5 ${dose.isTaken
                  ? 'bg-[#151515] border-neutral-800/50 opacity-60'
                  : 'bg-[#1a1a1a] border-neutral-800/80 shadow-md'
                  }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* CHECK A LA IZQUIERDA DEL TODO (SQUIRCLE NARANJA CON CÍRCULO BLANCO / CHECK) */}
                  <button
                    type="button"
                    disabled={loadingAction === dose.key}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDose(dose.medId, dose.time, dose.isTaken)
                    }}
                    style={dose.isTaken ? undefined : orangeGradient}
                    className={`w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md ${dose.isTaken
                      ? 'bg-neutral-800 text-neutral-400 border border-neutral-700/60'
                      : 'text-white shadow-[0_4px_14px_rgba(247,105,17,0.35)]'
                      }`}
                    title={dose.isTaken ? 'Marcar como pendiente' : 'Marcar como tomada'}
                  >
                    {loadingAction === dose.key ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : dose.isTaken ? (
                      <svg className="w-5 h-5 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-[2.5px] border-white" />
                    )}
                  </button>

                  {/* INFORMACIÓN DEL MEDICAMENTO (LÍNEA 1: HORA - NOMBRE - DOSIS | LÍNEA 2: PERSONA - FRECUENCIA) */}
                  <div
                    onClick={() => openEditModal(dose.med)}
                    className="flex-1 min-w-0 cursor-pointer flex flex-col justify-center"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`text-sm font-bold shrink-0 ${dose.isTaken ? 'text-neutral-400' : 'text-[#F76911]'}`}>
                        {dose.time}
                      </span>
                      <span className="text-neutral-500 font-bold text-xs">-</span>
                      <h2
                        className={`text-sm font-bold truncate m-0 ${dose.isTaken ? 'line-through text-neutral-400' : 'text-white'
                          }`}
                      >
                        {dose.name}
                      </h2>
                      {dose.dose && (
                        <>
                          <span className="text-neutral-500 font-bold text-xs">-</span>
                          <span className="text-xs text-neutral-300 font-medium truncate">
                            {dose.dose}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5 truncate">
                      <span className="text-neutral-300 font-medium truncate">{dose.person}</span>
                      <span className="text-neutral-600">-</span>
                      <span className="text-neutral-500 text-[11px] truncate">
                        {dose.endDate ? `Hasta ${dose.endDate}` : 'Permanente'}
                      </span>
                      {dose.instructions && (
                        <>
                          <span className="text-neutral-600">•</span>
                          <span className="px-1.5 py-0.2 rounded-md bg-neutral-800 text-[10px] text-neutral-300 font-medium truncate">
                            {dose.instructions}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* BOTÓN EDITAR A LA DERECHA */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditModal(dose.med)
                    }}
                    className="text-sm font-bold text-[#F76911] hover:text-[#ff8133] hover:underline px-2 py-1 cursor-pointer transition-colors shrink-0"
                    title="Editar medicamento"
                  >
                    Editar
                  </button>
                </div>

                {/* Barra de Stock e Integración con Supermercado */}
                {hasStock && (
                  <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRefillMed(dose.med)
                          setRefillAmount(30)
                        }}
                        className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer ${isOutOfStock
                          ? 'bg-red-950/80 border border-red-800 text-red-300'
                          : isLowStock
                            ? 'bg-amber-950/80 border border-amber-700 text-amber-300'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-300'
                          }`}
                        title="Toca para recargar o ajustar stock"
                      >
                        <span className="text-[11px]">
                          {isOutOfStock ? '🔴 Agotado' : isLowStock ? '⚠️ Quedan' : '📦 Stock:'}
                        </span>
                        <span className="font-black underline decoration-dashed">
                          {dose.stock} {dose.stock === 1 ? 'dosis' : 'dosis'}
                        </span>
                        <span className="text-[10px] text-neutral-400">✎</span>
                      </button>

                      {isOutOfStock && (
                        <span className="text-[11px] text-red-400 font-semibold">
                          ¡Comprar urgente!
                        </span>
                      )}
                    </div>

                    {(isOutOfStock || isLowStock) && (
                      <button
                        type="button"
                        onClick={() => handleAddToSuper(dose.med)}
                        className="px-2.5 py-1 rounded-xl bg-orange-950/60 hover:bg-orange-900/60 border border-orange-800 text-[#F76911] font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        title="Agregar directamente a la lista de compras del Supermercado"
                      >
                        <span>🛒</span>
                        <span>Pedir al Súper</span>
                      </button>
                    )}
                  </div>
                )}
              </article>
            )
          })
        )}
      </main>

      {/* Botón Flotante Agregar */}
      <button
        type="button"
        onClick={openCreateModal}
        aria-label="Añadir medicamento"
        style={orangeGradient}
        className="fixed bottom-24 right-5 sm:bottom-24 sm:right-8 lg:right-12 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_24px_rgba(247,105,17,0.5)] hover:scale-105 active:scale-90 transition-transform cursor-pointer z-40 border-2 border-white/20"
      >
        <svg className="w-7 h-7 stroke-current stroke-2 fill-none pointer-events-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal Recarga Rápida de Stock */}
      {refillMed && (
        <div
          onClick={() => setRefillMed(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1a1a1a] border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-sm font-black text-white m-0">
                Ajustar stock de {refillMed.name}
              </h3>
              <button
                type="button"
                onClick={() => setRefillMed(null)}
                className="w-7 h-7 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 m-0">
              Stock actual registrado:{' '}
              <strong className="text-white">{refillMed.stock ?? 0} unidades</strong>
            </p>

            <form onSubmit={handleQuickRefillSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">
                  ¿Cuántas unidades deseas sumar o recargar?
                </label>
                <div className="flex items-center gap-2">
                  {[10, 20, 30, 60].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRefillAmount(num)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${refillAmount === num
                        ? 'bg-[#F76911] text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                    >
                      +{num}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  required
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(Number(e.target.value))}
                  className="w-full mt-1 bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#F76911]"
                  placeholder="Cantidad manual..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefillMed(null)}
                  className="w-1/2 py-2.5 rounded-2xl bg-neutral-800 text-neutral-300 text-xs font-bold hover:bg-neutral-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={orangeGradient}
                  className="w-1/2 py-2.5 rounded-2xl text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirmar recarga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Medicamento */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false)
          }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#1a1a1a] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-6 pb-10 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto mb-0"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-black text-white m-0">
                {editingId ? 'Editar medicamento' : 'Nuevo medicamento'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMed} className="flex flex-col gap-4">
              {/* Nombre y Dosis */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">Medicamento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Paracetamol, Eutirox, Amoxicilina"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-300">Dosis / Presentación</label>
                  <input
                    type="text"
                    placeholder="Ej. 500mg, 1 comp, 5ml"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-300">¿Para quién es?</label>
                  <div className="relative">
                    <select
                      value={person}
                      onChange={(e) => setPerson(e.target.value)}
                      className="w-full appearance-none bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                    >
                      {allSelectableMembers.map((mName) => (
                        <option key={mName} value={mName} className="bg-[#1a1a1a] text-white">
                          {mName}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-neutral-400">
                      <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formato / Icono Visual */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-neutral-300">Tipo de formato / Presentación</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {PRESENTATION_TYPES.map((pt) => {
                    const isSelected = iconType === pt.id
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setIconType(pt.id)}
                        className={`p-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${isSelected
                          ? 'bg-[#F76911]/20 border-[#F76911] text-white shadow-sm'
                          : 'bg-[#141414] border-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                          }`}
                      >
                        <span className="text-base">{pt.icon}</span>
                        <span className="text-[10px] truncate max-w-full">{pt.shortLabel}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Múltiples Horarios de Toma */}
              <div className="flex flex-col gap-2 p-3.5 bg-[#141414] border border-neutral-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                    <span>⏰</span>
                    <span>Horarios de toma ({times.length} al día)</span>
                  </label>
                  <button
                    type="button"
                    onClick={addTimeSlot}
                    className="text-[11px] text-[#F76911] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>+ Añadir hora</span>
                  </button>
                </div>

                {/* Presets Rápidos */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  <button
                    type="button"
                    onClick={() => applyPresetTimes(['08:00'])}
                    className="px-2.5 py-1 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-[10px] text-neutral-300 font-bold whitespace-nowrap cursor-pointer"
                  >
                    1x (08:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTimes(['08:00', '20:00'])}
                    className="px-2.5 py-1 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-[10px] text-neutral-300 font-bold whitespace-nowrap cursor-pointer"
                  >
                    2x (08:00, 20:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTimes(['08:00', '14:00', '21:00'])}
                    className="px-2.5 py-1 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-[10px] text-neutral-300 font-bold whitespace-nowrap cursor-pointer"
                  >
                    3x (8:00, 14:00, 21:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTimes(['08:00', '16:00', '00:00'])}
                    className="px-2.5 py-1 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-[10px] text-neutral-300 font-bold whitespace-nowrap cursor-pointer"
                  >
                    Cada 8h
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {times.map((slotTime, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 bg-[#1d1d1d] border border-neutral-700/80 rounded-xl px-2 py-1"
                    >
                      <input
                        type="time"
                        required
                        value={slotTime}
                        onChange={(e) => updateTimeSlot(idx, e.target.value)}
                        className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(idx)}
                          className="w-4 h-4 rounded-full text-neutral-400 hover:text-red-400 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                          title="Eliminar este horario"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Control de Stock */}
              <div className="flex flex-col gap-2 p-3.5 bg-[#141414] border border-neutral-800 rounded-2xl">
                <label className="flex items-center gap-2.5 text-[11px] font-bold text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableStock}
                    onChange={(e) => setEnableStock(e.target.checked)}
                    className="w-4 h-4 accent-[#F76911] cursor-pointer rounded"
                  />
                  <span>📦</span>
                  <span>Control de Stock / Inventario en casa</span>
                </label>

                {enableStock ? (
                  <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-400">
                        Cantidad disponible
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Ej. 30"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F76911]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-400">
                        Avisar cuando queden menos de
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Ej. 5"
                        value={stockAlertThreshold}
                        onChange={(e) => setStockAlertThreshold(Number(e.target.value))}
                        className="w-full bg-[#1c1c1c] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F76911]"
                      />
                    </div>
                    <p className="col-span-2 text-[10px] text-neutral-500 m-0">
                      Con cada toma marcada se descontará 1 unidad automáticamente y avisará cuando toque comprar.
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-500 m-0">
                    Activa esta casilla para registrar cuántas pastillas tienes y recibir avisos de compra.
                  </p>
                )}
              </div>

              {/* Indicaciones / Instrucciones especiales */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-neutral-300">
                  Instrucciones o condición de toma (opcional)
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {INSTRUCTION_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setInstructions(p.label)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${instructions === p.label
                        ? 'bg-[#F76911] text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                    >
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Ej. En ayunas con un vaso de agua, tomar antes de dormir..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#F76911]"
                />
              </div>

              {/* Frecuencia y Fechas */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-neutral-300">Frecuencia / Recurrencia</label>
                <div className="relative">
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full appearance-none bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-neutral-400">
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {frequency === 'custom_days' && (
                  <div className="mt-1 p-3 bg-[#131313] border border-neutral-800 rounded-2xl flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-neutral-400">
                      Selecciona los días de la toma:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = selectedDays.includes(day.id)
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            style={isSelected ? orangeGradient : undefined}
                            className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${isSelected
                              ? 'text-white shadow-md'
                              : 'bg-neutral-800/60 text-neutral-400 hover:text-white border border-neutral-700/40'
                              }`}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Fecha de Término */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-300">¿Hasta cuándo tomar?</label>
                  {endDate && (
                    <button
                      type="button"
                      onClick={() => setEndDate('')}
                      className="text-[10px] text-[#F76911] font-bold hover:underline cursor-pointer"
                    >
                      Dejar indefinido
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#F76911]"
                />
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-1/2 py-3.5 rounded-2xl bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer hover:bg-neutral-700 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    style={orangeGradient}
                    className="w-1/2 py-3.5 rounded-2xl text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear medicamento'}
                  </button>
                </div>

                {editingId && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteMed}
                    className="w-full py-2.5 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-900/40 font-bold text-xs cursor-pointer transition-colors mt-1"
                  >
                    {isDeleting ? 'Eliminando...' : 'Eliminar este recordatorio'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}