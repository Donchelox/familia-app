'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActionParam } from '@/lib/useActionParam'
import { translateErrorMessage } from '@/lib/formatErrors'
import { isSchoolTestActive } from '@/lib/dates'
import { offlineDB } from '@/lib/offline/db'
import { useOfflineMutation } from '@/lib/offline/useOfflineMutation'
import { getOfflineFamilyId, saveOfflineFamilyId } from '@/lib/offline/familyContext'
import { safeUUID } from '@/lib/uuid'

interface SchoolScheduleBlock {
  id: string
  day: string
  time_start: string
  time_end: string
  subject: string
  teacher_initials?: string
  order_index?: number
  valid_until?: string
  family_id?: string
}

interface SchoolTest {
  id: string
  subject: string
  topic?: string
  test_date: string
  family_id?: string
}

interface SchoolHomework {
  id: string
  subject: string
  task: string
  due?: string | null
  due_date?: string | null
  done?: boolean
  done_at?: string | null
  family_id?: string
}

const SCHEDULE_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']



const COMMON_SUBJECTS = [
  'Lenguaje y Comunicación',
  'Matemática',
  'Historia, Geografía y C...',
  'Ciencias Naturales',
  'Educación Física y Salud',
  'Taller de Inglés',
  'Artes Visuales',
  'Música',
  'Tecnología',
  'Religión',
  'Orientación',
  'Formación Ciudadana',
  'Cálculo Mental',
  'Dominio Lector',
  'Otro',
]

export default function ColegioPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tests, setTests] = useState<SchoolTest[]>([])
  const [homework, setHomework] = useState<SchoolHomework[]>([])
  const [schedule, setSchedule] = useState<SchoolScheduleBlock[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const dayIdx = new Date().getDay()
    if (dayIdx >= 1 && dayIdx <= 5) return SCHEDULE_DAYS[dayIdx - 1]
    return 'Lunes'
  })

  // Bottom Sheet Estados
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [modalType, setModalType] = useState<'test' | 'homework' | 'schedule'>('homework')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Campos para Pruebas / Tareas
  const [subject, setSubject] = useState('Lenguaje y Comunicación')
  const [taskOrTopic, setTaskOrTopic] = useState('')
  const [dateVal, setDateVal] = useState('')

  // Campos para Bloque de Horario
  const [schedDay, setSchedDay] = useState('Lunes')
  const [timeStart, setTimeStart] = useState('08:00')
  const [timeEnd, setTimeEnd] = useState('09:30')
  const [teacherInitials, setTeacherInitials] = useState('')

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { mutate } = useOfflineMutation()

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  // Carga de datos
  async function loadData() {
    setLoading(true)

    try {
      // 1. CARGA INMEDIATA DESDE DEXIE (OFFLINE-FIRST)
      let currentFamId = familyId
      try {
        if (!currentFamId) {
          currentFamId = await getOfflineFamilyId()
          if (currentFamId) setFamilyId(currentFamId)
        }

        const [localTasks, localExams] = currentFamId
          ? await Promise.all([
              offlineDB.school_tasks.where('family_id').equals(currentFamId).toArray(),
              offlineDB.exams.where('family_id').equals(currentFamId).toArray(),
            ])
          : await Promise.all([
              offlineDB.school_tasks.toArray(),
              offlineDB.exams.toArray(),
            ])

        if (localTasks && localTasks.length > 0) {
          setHomework(
            localTasks.map((t) => ({
              id: t.id,
              family_id: t.family_id,
              subject: t.subject,
              task: t.task,
              due: t.due,
              due_date: t.due_date || t.due,
              done: t.done,
              done_at: t.done_at,
            }))
          )
        }

        if (localExams && localExams.length > 0) {
          setTests(
            localExams
              .filter((e) => isSchoolTestActive(e.test_date))
              .map((e) => ({
                id: e.id,
                family_id: e.family_id,
                subject: e.subject,
                topic: e.topic,
                test_date: e.test_date,
              }))
          )
        }

        if (localTasks.length > 0 || localExams.length > 0) {
          setLoading(false)
        }
      } catch (e) {
        console.warn('[Offline] Error leyendo colegio local:', e)
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      // 2. Obtener family_id remoto si aún no se tiene
      try {
        if (!currentFamId) {
          const { data: memberData } = await supabase
            .from('members')
            .select('family_id')
            .limit(1)
            .maybeSingle()

          if (memberData?.family_id) {
            currentFamId = memberData.family_id
            setFamilyId(memberData.family_id)
            saveOfflineFamilyId(memberData.family_id)
          }
        }
      } catch {}

      // 3. Sincronizar horario, pruebas y tareas escolares desde Supabase (con timeout)
      try {
        let schedQuery = supabase
          .from('school_schedule')
          .select('*')
          .order('time_start', { ascending: true })

        let testsQuery = supabase
          .from('school_tests')
          .select('*')
          .order('test_date', { ascending: true })

        let hwQuery = supabase
          .from('school_homework')
          .select('*')
          .order('created_at', { ascending: false })

        if (currentFamId) {
          schedQuery = schedQuery.eq('family_id', currentFamId)
          testsQuery = testsQuery.eq('family_id', currentFamId)
          hwQuery = hwQuery.eq('family_id', currentFamId)
        }

        const timeoutPromise = new Promise<{ data: any[]; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de consulta escolar')), 6000)
        )

        const [schedRes, testsRes, hwRes] = await Promise.race([
          Promise.all([schedQuery, testsQuery, hwQuery]),
          timeoutPromise as any,
        ])

        setSchedule(schedRes?.data ?? [])

        // Manejo de pruebas remotas + pendientes locales
        const rawTests: SchoolTest[] = testsRes?.data ?? []
        const currentLocalExams = currentFamId
          ? await offlineDB.exams.where('family_id').equals(currentFamId).toArray()
          : await offlineDB.exams.toArray()
        const unsyncedExams = currentLocalExams.filter((e) => !e._synced)
        const unsyncedExamsMap = new Map(unsyncedExams.map((e) => [e.id, e]))

        const mergedTestsMap = new Map<string, SchoolTest>()
        unsyncedExams.forEach((e) => {
          if (isSchoolTestActive(e.test_date)) {
            mergedTestsMap.set(e.id, {
              id: e.id,
              family_id: e.family_id,
              subject: e.subject,
              topic: e.topic,
              test_date: e.test_date,
            })
          }
        })

        rawTests.forEach((t) => {
          if (isSchoolTestActive(t.test_date) && !unsyncedExamsMap.has(t.id)) {
            mergedTestsMap.set(t.id, t)
          }
        })
        setTests(Array.from(mergedTestsMap.values()))

        // Limpiar en Dexie exámenes sincronizados eliminados remotamente
        const remoteExamIds = new Set(rawTests.map((t) => t.id))
        const examsToDelete = currentLocalExams
          .filter((e) => e._synced && !remoteExamIds.has(e.id))
          .map((e) => e.id)
        if (examsToDelete.length > 0) {
          await offlineDB.exams.bulkDelete(examsToDelete)
        }

        // Guardar pruebas limpias en Dexie
        const validExamsToStore = rawTests
          .filter((t) => !unsyncedExamsMap.has(t.id))
          .map((t) => ({
            id: t.id,
            family_id: t.family_id || currentFamId || '',
            subject: t.subject,
            topic: t.topic,
            test_date: t.test_date,
            _synced: true,
          }))
        if (validExamsToStore.length > 0) {
          await offlineDB.exams.bulkPut(validExamsToStore)
        }

        // Manejo de tareas escolares remotas + pendientes locales
        const rawHw: SchoolHomework[] = hwRes?.data ?? []
        const currentLocalTasks = currentFamId
          ? await offlineDB.school_tasks.where('family_id').equals(currentFamId).toArray()
          : await offlineDB.school_tasks.toArray()
        const unsyncedTasks = currentLocalTasks.filter((t) => !t._synced)
        const unsyncedTasksMap = new Map(unsyncedTasks.map((t) => [t.id, t]))

        const mergedHwMap = new Map<string, SchoolHomework>()
        unsyncedTasks.forEach((t) => {
          mergedHwMap.set(t.id, {
            id: t.id,
            family_id: t.family_id,
            subject: t.subject,
            task: t.task,
            due: t.due,
            due_date: t.due_date || t.due,
            done: t.done,
            done_at: t.done_at,
          })
        })

        rawHw.forEach((h) => {
          if (!unsyncedTasksMap.has(h.id)) {
            mergedHwMap.set(h.id, h)
          }
        })
        setHomework(Array.from(mergedHwMap.values()))

        // Limpiar en Dexie tareas sincronizadas eliminadas remotamente
        const remoteTaskIds = new Set(rawHw.map((h) => h.id))
        const tasksToDelete = currentLocalTasks
          .filter((t) => t._synced && !remoteTaskIds.has(t.id))
          .map((t) => t.id)
        if (tasksToDelete.length > 0) {
          await offlineDB.school_tasks.bulkDelete(tasksToDelete)
        }

        // Guardar tareas escolares limpias en Dexie
        const validTasksToStore = rawHw
          .filter((h) => !unsyncedTasksMap.has(h.id))
          .map((h) => ({
            id: h.id,
            family_id: h.family_id || currentFamId || '',
            subject: h.subject,
            task: h.task,
            due: h.due || h.due_date || '',
            due_date: h.due_date || h.due,
            done: h.done || false,
            done_at: h.done_at,
            _synced: true,
          }))
        if (validTasksToStore.length > 0) {
          await offlineDB.school_tasks.bulkPut(validTasksToStore)
        }
      } catch (err) {
        console.warn('[Offline] Error actualizando datos escolares de Supabase:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    function handleSyncComplete() {
      loadData()
    }
    window.addEventListener('casa-sync-complete', handleSyncComplete)
    window.addEventListener('online', handleSyncComplete)

    return () => {
      window.removeEventListener('casa-sync-complete', handleSyncComplete)
      window.removeEventListener('online', handleSyncComplete)
    }
  }, [])

  // Abre el sheet si viene del botón + (?action=new | new-homework | new-test)
  useActionParam({ 'new': openCreate, 'new-homework': openCreate, 'new-test': openCreateTest })

  // Check / Uncheck tarea escolar
  async function toggleHw(hw: SchoolHomework) {
    const nextDone = !hw.done
    const nextDoneAt = nextDone ? new Date().toISOString() : null
    const targetFamId = hw.family_id || familyId || ''

    // Optimistic UI en React
    setHomework((prev) =>
      prev.map((item) =>
        item.id === hw.id ? { ...item, done: nextDone, done_at: nextDoneAt } : item
      )
    )

    // Persistencia offline inmediata en Dexie y encolado en sync_queue
    try {
      await mutate({
        familyId: targetFamId,
        entity: 'school_tasks',
        action: 'UPDATE',
        entityId: hw.id,
        payload: {
          id: hw.id,
          family_id: targetFamId,
          subject: hw.subject,
          task: hw.task,
          due: hw.due || hw.due_date,
          due_date: hw.due_date || hw.due,
          done: nextDone,
          done_at: nextDoneAt,
        },
      })
    } catch (e) {
      console.warn('[Offline] Error al actualizar estado de tarea escolar:', e)
    }
  }

  // Modos de apertura del modal
  function openCreate() {
    setEditingId(null)
    setModalType('homework')
    setSubject('Lenguaje y Comunicación')
    setTaskOrTopic('')
    setDateVal('')
    setIsSheetOpen(true)
  }

  const openCreateHw = openCreate

  function openCreateTest() {
    setEditingId(null)
    setModalType('test')
    setSubject('Lenguaje y Comunicación')
    setTaskOrTopic('')
    setDateVal('')
    setIsSheetOpen(true)
  }

  function openEditTest(test: SchoolTest) {
    setEditingId(test.id)
    setModalType('test')
    setSubject(test.subject)
    setTaskOrTopic(test.topic || '')
    setDateVal(test.test_date || '')
    setIsSheetOpen(true)
  }

  function openEditHw(hw: SchoolHomework) {
    setEditingId(hw.id)
    setModalType('homework')
    setSubject(hw.subject)
    setTaskOrTopic(hw.task)
    setDateVal(hw.due || hw.due_date || '')
    setIsSheetOpen(true)
  }

  function openEditSchedule(block: SchoolScheduleBlock) {
    setEditingId(block.id)
    setModalType('schedule')
    setSchedDay(block.day)
    setSubject(block.subject)
    setTimeStart(block.time_start)
    setTimeEnd(block.time_end)
    setTeacherInitials(block.teacher_initials || '')
    setIsSheetOpen(true)
  }

  function openCreateSchedule() {
    setEditingId(null)
    setModalType('schedule')
    setSchedDay(selectedDay)
    setSubject('Lenguaje y Comunicación')
    setTimeStart('08:00')
    setTimeEnd('08:45')
    setTeacherInitials('')
    setIsSheetOpen(true)
  }

  // Guardar (Crear o Editar)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    let targetFamilyId = familyId || (await getOfflineFamilyId())
    if (!familyId) setFamilyId(targetFamilyId)

    // A) HORARIO DE CLASES
    if (modalType === 'schedule') {
      const payload: any = {
        day: schedDay,
        subject,
        time_start: timeStart,
        time_end: timeEnd,
        teacher_initials: teacherInitials.trim().toUpperCase() || null,
        valid_until: '2026-12-31',
      }
      if (targetFamilyId) payload.family_id = targetFamilyId

      if (editingId && !editingId.startsWith('local-')) {
        const { error } = await supabase
          .from('school_schedule')
          .update(payload)
          .eq('id', editingId)
        if (error) {
          alert(`Error al actualizar horario: ${translateErrorMessage(error)}`)
          setSaving(false)
          return
        }
        setSchedule((prev) =>
          prev.map((b) => (b.id === editingId ? { ...b, ...payload } : b))
        )
      } else {
        const { data, error } = await supabase.from('school_schedule').insert(payload).select()
        if (error) {
          alert(`Error al guardar bloque de horario: ${translateErrorMessage(error)}`)
          setSaving(false)
          return
        }
        if (data && data[0]) {
          setSchedule((prev) => [...prev, data[0]])
        } else {
          setSchedule((prev) => [...prev, { id: safeUUID(), ...payload }])
        }
      }
    } 
    // B) PRUEBA ESCOLAR (usa 'topic')
    else if (modalType === 'test') {
      if (!taskOrTopic.trim()) {
        setSaving(false)
        return
      }
      const tempId = editingId || safeUUID()

      const payload: SchoolTest = {
        id: tempId,
        subject,
        topic: taskOrTopic.trim(),
        test_date: dateVal || new Date().toISOString().split('T')[0],
        family_id: targetFamilyId || undefined,
      }

      setTests((prev) => {
        if (editingId) return prev.map((t) => (t.id === editingId ? payload : t))
        return [...prev, payload]
      })

      try {
        await mutate({
          familyId: targetFamilyId || '',
          entity: 'exams',
          action: editingId ? 'UPDATE' : 'INSERT',
          entityId: tempId,
          payload,
        })
      } catch (err) {
        console.warn('[Offline] Error guardando prueba escolar localmente:', err)
      }
    }
    // C) TAREA ESCOLAR (usa 'task')
    else {
      if (!taskOrTopic.trim()) {
        setSaving(false)
        return
      }
      const tempId = editingId || safeUUID()

      const isDone = editingId ? (homework.find((h) => h.id === editingId)?.done ?? false) : false
      const payload: SchoolHomework = {
        id: tempId,
        subject,
        task: taskOrTopic.trim(),
        due: dateVal || null,
        due_date: dateVal || null,
        done: isDone,
        family_id: targetFamilyId || undefined,
      }

      setHomework((prev) => {
        if (editingId) return prev.map((h) => (h.id === editingId ? payload : h))
        return [payload, ...prev]
      })

      try {
        await mutate({
          familyId: targetFamilyId || '',
          entity: 'school_tasks',
          action: editingId ? 'UPDATE' : 'INSERT',
          entityId: tempId,
          payload,
        })
      } catch (err) {
        console.warn('[Offline] Error guardando tarea escolar localmente:', err)
      }
    }

    setSaving(false)
    setIsSheetOpen(false)
    setTaskOrTopic('')
    setDateVal('')
  }

  // Eliminar
  async function handleDelete() {
    if (!editingId) return
    const msg =
      modalType === 'schedule'
        ? '¿Eliminar este bloque de clases?'
        : modalType === 'test'
        ? '¿Eliminar esta evaluación?'
        : '¿Eliminar esta tarea escolar?'
    if (!confirm(msg)) return
    setDeleting(true)

    const targetFamId = familyId || (await getOfflineFamilyId())

    if (modalType === 'schedule') {
      if (!editingId.startsWith('local-')) {
        await supabase.from('school_schedule').delete().eq('id', editingId)
      }
      setSchedule((prev) => prev.filter((b) => b.id !== editingId))
    } else if (modalType === 'test') {
      setTests((prev) => prev.filter((t) => t.id !== editingId))
      try {
        await mutate({
          familyId: targetFamId,
          entity: 'exams',
          action: 'DELETE',
          entityId: editingId,
        })
      } catch (err) {
        console.warn('[Offline] Error eliminando prueba escolar:', err)
      }
    } else {
      setHomework((prev) => prev.filter((h) => h.id !== editingId))
      try {
        await mutate({
          familyId: targetFamId,
          entity: 'school_tasks',
          action: 'DELETE',
          entityId: editingId,
        })
      } catch (err) {
        console.warn('[Offline] Error eliminando tarea escolar:', err)
      }
    }

    setDeleting(false)
    setIsSheetOpen(false)
  }

  const currentDayBlocks = schedule
    .filter((b) => b.day === selectedDay)
    .sort((a, b) => a.time_start.localeCompare(b.time_start))

  const pendingHomework = homework.filter((h) => !h.done)
  const completedHomework = homework.filter((h) => h.done)

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      {/* HEADER ESTANDARIZADO */}
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
          <h1 className="text-2xl font-black tracking-tight text-white m-0">Colegio</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            style={orangeGradient}
            className="px-3.5 py-1.5 rounded-full text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="text-sm font-black">+</span>
            <span>Añadir</span>
          </button>
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* SECCIÓN 1: HORARIO ESCOLAR */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-[#F76911]">
              <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="text-base font-bold text-white m-0">Horario escolar</h2>
          </div>
          <div className="flex items-center gap-2">
            {schedule.length > 0 && (
              <span className="text-[11px] text-[#F76911] font-bold bg-[#F76911]/10 px-2 py-0.5 rounded-md border border-[#F76911]/20">
                Vigente hasta 31 Dic
              </span>
            )}
            <button
              type="button"
              onClick={openCreateSchedule}
              className="text-xs font-bold text-neutral-400 hover:text-white px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer"
            >
              + Bloque
            </button>
          </div>
        </div>

        {/* SELECTOR DE DÍAS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {SCHEDULE_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedDay === day
                  ? 'bg-[#F76911] text-white shadow-md'
                  : 'bg-[#1a1a1a] text-neutral-400 border border-neutral-800/80 hover:text-white'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* LISTADO DE BLOQUES DEL DÍA SELECCIONADO */}
        <div className="p-4 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-lg flex flex-col divide-y divide-neutral-800/80">
          {currentDayBlocks.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-500">
              No hay clases registradas para este día.
            </div>
          ) : (
            currentDayBlocks.map((block, idx) => (
              <div
                key={block.id || idx}
                onClick={() => openEditSchedule(block)}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 cursor-pointer group hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-xs text-[#F76911] shrink-0">
                    {idx + 1}°
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate m-0 group-hover:text-[#F2A957] transition-colors">
                      {block.subject}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {block.time_start} - {block.time_end}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {block.teacher_initials && (
                    <span className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700/80 text-[10px] font-black text-neutral-300 flex items-center justify-center">
                      {block.teacher_initials}
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-[#F76911] opacity-0 group-hover:opacity-100 transition-opacity">
                    Editar
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* SECCIÓN 2: GRID EVALUACIONES Y TAREAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* COLUMNA PRUEBAS */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[#F76911]">
                <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h2 className="text-base font-bold text-white m-0">Siguientes pruebas</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-bold">{tests.length}</span>
              <button
                type="button"
                onClick={openCreateTest}
                className="text-xs font-bold text-neutral-400 hover:text-white px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer active:scale-95 transition-all"
              >
                + Prueba
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                Cargando pruebas...
              </div>
            ) : tests.length === 0 ? (
              <div className="p-8 text-center bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80 flex flex-col items-center">
                <p className="text-sm font-bold text-neutral-300 m-0">No hay pruebas agendadas</p>
                <p className="text-xs text-neutral-500 mt-1">Registra las próximas evaluaciones escolares.</p>
                <button
                  type="button"
                  onClick={openCreateTest}
                  className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-[#F76911] text-xs font-bold border border-neutral-700/60 active:scale-95 transition-all cursor-pointer"
                >
                  + Agendar prueba
                </button>
              </div>
            ) : (
              tests.map((test) => (
                <article
                  key={test.id}
                  className="p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex items-center justify-between gap-3 hover:border-neutral-700 transition-all"
                >
                  <div onClick={() => openEditTest(test)} className="min-w-0 flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-[#F76911]">
                        {test.subject}
                      </span>
                      <span className="text-xs font-bold text-white">{test.test_date}</span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1.5 font-medium leading-relaxed">
                      {test.topic || 'Sin temario detallado'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditTest(test)
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-[#F76911] text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    Editar
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        {/* COLUMNA TAREAS (PENDIENTES + COMPLETADAS) */}
        <section className="flex flex-col gap-6">
          {/* TAREAS PENDIENTES */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[#F76911]">
                  <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </span>
                <h2 className="text-base font-bold text-white m-0">Tareas escolares</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-bold">{pendingHomework.length} pendientes</span>
                <button
                  type="button"
                  onClick={openCreateHw}
                  className="text-xs font-bold text-neutral-400 hover:text-white px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer active:scale-95 transition-all"
                >
                  + Tarea
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {loading ? (
                <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                  Cargando tareas escolares...
                </div>
              ) : pendingHomework.length === 0 ? (
                <div className="p-8 text-center bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80 flex flex-col items-center">
                  <p className="text-sm font-bold text-neutral-300 m-0">No hay tareas pendientes</p>
                  <p className="text-xs text-neutral-500 mt-1">¡Al día con las actividades escolares!</p>
                  <button
                    type="button"
                    onClick={openCreateHw}
                    className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-[#F76911] text-xs font-bold border border-neutral-700/60 active:scale-95 transition-all cursor-pointer"
                  >
                    + Añadir tarea
                  </button>
                </div>
              ) : (
                pendingHomework.map((hw) => {
                  const displayDate = hw.due || hw.due_date
                  return (
                    <article
                      key={hw.id}
                      className="p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md hover:border-neutral-700 transition-all flex items-center justify-between gap-3"
                    >
                      <div onClick={() => openEditHw(hw)} className="min-w-0 flex-1 cursor-pointer">
                        <span className="text-[10px] font-bold text-[#F76911]">{hw.subject}</span>
                        <h3 className="text-sm font-bold text-white m-0 truncate">{hw.task}</h3>
                        {displayDate && (
                          <p className="text-[11px] text-neutral-400 mt-0.5">Entrega: {displayDate}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditHw(hw)
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-[#F76911] text-xs font-bold transition-all active:scale-95 cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleHw(hw)
                          }}
                          className="w-10 h-10 rounded-2xl border border-neutral-700 hover:border-[#F76911] flex items-center justify-center cursor-pointer transition-all active:scale-95"
                          title="Marcar como completada"
                        />
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>

          {/* TAREAS COMPLETADAS */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-neutral-400 px-1 m-0">
              Tareas completadas ({completedHomework.length})
            </h2>

            <div className="flex flex-col gap-2.5">
              {completedHomework.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-600 bg-[#151515] rounded-[24px] border border-neutral-800/40">
                  Aún no has completado tareas.
                </div>
              ) : (
                completedHomework.map((hw) => {
                  const displayDate = hw.due || hw.due_date
                  return (
                    <article
                      key={hw.id}
                      className="p-4 rounded-[24px] bg-[#151515] border border-neutral-800/40 opacity-60 flex items-center justify-between gap-3"
                    >
                      <div onClick={() => openEditHw(hw)} className="min-w-0 flex-1 cursor-pointer">
                        <span className="text-[10px] font-bold text-neutral-500">{hw.subject}</span>
                        <h3 className="text-sm font-bold text-neutral-400 line-through m-0 truncate">{hw.task}</h3>
                        {displayDate && (
                          <p className="text-[11px] text-neutral-600 mt-0.5">Entrega: {displayDate}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditHw(hw)
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-700/30 text-neutral-400 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleHw(hw)
                          }}
                          style={orangeGradient}
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md cursor-pointer transition-all active:scale-95"
                          title="Marcar como pendiente"
                        >
                          <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {/* BOTÓN FLOTANTE (FAB) */}
      <button
        type="button"
        onClick={openCreate}
        style={orangeGradient}
        className="fixed bottom-24 right-5 sm:right-8 lg:right-12 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(247,105,17,0.4)] active:scale-90 transition-transform cursor-pointer z-40"
        title="Añadir prueba o tarea"
      >
        <svg className="w-7 h-7 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* BOTTOM SHEET CREAR / EDITAR */}
      {isSheetOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSheetOpen(false)
          }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#1a1a1a] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto mb-20 sm:mb-0"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-black text-white m-0">
                {editingId
                  ? modalType === 'schedule'
                    ? 'Editar bloque de clases'
                    : modalType === 'test'
                    ? 'Editar prueba'
                    : 'Editar tarea escolar'
                  : modalType === 'schedule'
                  ? 'Nuevo bloque de clases'
                  : 'Añadir al colegio'}
              </h2>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* SELECTOR SEGMENTADO DEL TIPO */}
            {!editingId && modalType !== 'schedule' && (
              <div className="flex p-1 bg-[#131313] border border-neutral-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setModalType('test')}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    modalType === 'test' ? 'bg-[#F76911] text-white shadow-md' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Nueva Prueba
                </button>
                <button
                  type="button"
                  onClick={() => setModalType('homework')}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    modalType === 'homework' ? 'bg-[#F76911] text-white shadow-md' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Nueva Tarea
                </button>
              </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-3.5">
              {/* BLOQUE DE HORARIO */}
              {modalType === 'schedule' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-neutral-300">Día de la semana</label>
                    <select
                      value={schedDay}
                      onChange={(e) => setSchedDay(e.target.value)}
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                    >
                      {SCHEDULE_DAYS.map((d) => (
                        <option key={d} value={d} className="bg-[#1a1a1a]">{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-neutral-300">Asignatura</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. MATEMÁTICA, LENGUAJE"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-300">Hora inicio</label>
                      <input
                        type="time"
                        required
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-300">Hora término</label>
                      <input
                        type="time"
                        required
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-neutral-300">Iniciales del profesor (ej. JJ, CN, BF)</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Ej. CN"
                      value={teacherInitials}
                      onChange={(e) => setTeacherInitials(e.target.value.toUpperCase())}
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                    />
                  </div>
                </>
              ) : (
                /* PRUEBAS O TAREAS */
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-neutral-300">Asignatura</label>
                    <div className="relative">
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full appearance-none bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                      >
                        {COMMON_SUBJECTS.map((sub) => (
                          <option key={sub} value={sub} className="bg-[#1a1a1a] text-white">
                            {sub}
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

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-neutral-300">
                      {modalType === 'test' ? 'Temas o contenidos evaluados' : 'Título o descripción de la tarea'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        modalType === 'test'
                          ? 'Ej. Fracciones, Comprensión lectora cap. 1-4'
                          : 'Ej. Resolver guía página 42, traer cartulina'
                      }
                      value={taskOrTopic}
                      onChange={(e) => setTaskOrTopic(e.target.value)}
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-neutral-300">
                        {modalType === 'test' ? 'Fecha de la prueba' : 'Fecha de entrega'}
                      </label>
                      {modalType === 'homework' && dateVal && (
                        <button
                          type="button"
                          onClick={() => setDateVal('')}
                          className="text-[10px] text-[#F76911] font-bold hover:underline cursor-pointer"
                        >
                          Sin fecha límite
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      required={modalType === 'test'}
                      value={dateVal}
                      onChange={(e) => setDateVal(e.target.value)}
                      className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                    />
                  </div>
                </>
              )}

              {/* BOTONES DE ACCIÓN */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSheetOpen(false)}
                    className="w-1/2 py-3.5 rounded-2xl bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer hover:bg-neutral-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={orangeGradient}
                    className="w-1/2 py-3.5 rounded-2xl text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center"
                  >
                    {saving
                      ? 'Guardando...'
                      : editingId
                      ? 'Guardar cambios'
                      : modalType === 'schedule'
                      ? 'Añadir bloque'
                      : modalType === 'test'
                      ? 'Añadir prueba'
                      : 'Añadir tarea'}
                  </button>
                </div>

                {editingId && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="w-full py-2.5 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-900/40 font-bold text-xs cursor-pointer transition-colors mt-1"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar registro'}
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