'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import NotificationBell from '@/components/NotificationBell'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import { createClient } from '@/lib/supabase/client'
import { getOfflineFamilyId, saveOfflineFamilyId } from '@/lib/offline/familyContext'
import { safeUUID } from '@/lib/uuid'
import { getCategoryTheme } from '@/lib/categoryColors'

// Interfaces de datos
interface WishlistRecipient {
  id: string
  family_id?: string
  name: string
  relationship?: string
  notes?: string
  avatar_color?: string
  created_at?: string
  updated_at?: string
}

interface WishlistGift {
  id: string
  family_id?: string
  recipient_id: string
  title: string
  notes?: string
  price?: string
  url?: string
  is_bought: boolean
  buyer_name?: string
  created_at?: string
  updated_at?: string
}

const RECIPIENT_COLORS = [
  { id: 'rose', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { id: 'amber', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'sky', bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/40', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { id: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'orange', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
]

const LOCAL_RECIPIENTS_KEY = 'casa_wishlist_recipients_v1'
const LOCAL_GIFTS_KEY = 'casa_wishlist_gifts_v1'

export default function WishlistPage() {
  const searchParams = useSearchParams()
  const [supabase] = useState(() => createClient())

  const [familyId, setFamilyId] = useState<string>('')
  const [familyName, setFamilyName] = useState<string>('Familia')
  const [recipients, setRecipients] = useState<WishlistRecipient[]>([])
  const [gifts, setGifts] = useState<WishlistGift[]>([])
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'bought'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [familyMembers, setFamilyMembers] = useState<{ id: string; name: string }[]>([])

  // Modales
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false)
  const [editingRecipient, setEditingRecipient] = useState<WishlistRecipient | null>(null)
  const [recipientForm, setRecipientForm] = useState({
    name: '',
    relationship: '',
    notes: '',
    avatar_color: 'rose',
  })

  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [editingGift, setEditingGift] = useState<WishlistGift | null>(null)
  const [giftForm, setGiftForm] = useState({
    recipient_id: '',
    title: '',
    notes: '',
    price: '',
    url: '',
    is_bought: false,
    buyer_name: '',
  })

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur))
    }, 3200)
  }, [])

  // Cargar datos locales iniciales
  useEffect(() => {
    try {
      const storedRec = localStorage.getItem(LOCAL_RECIPIENTS_KEY)
      if (storedRec) {
        setRecipients(JSON.parse(storedRec))
      }
      const storedGifts = localStorage.getItem(LOCAL_GIFTS_KEY)
      if (storedGifts) {
        setGifts(JSON.parse(storedGifts))
      }
    } catch (e) {
      console.warn('[Wishlist] Error cargando caché local:', e)
    }

    // Inicializar familia y miembros
    async function loadMetaAndRemote() {
      try {
        let famId = (await getOfflineFamilyId()) || ''
        if (!famId) {
          const { data: mData } = await supabase.from('members').select('family_id').limit(1).maybeSingle()
          if (mData?.family_id) {
            famId = mData.family_id
            saveOfflineFamilyId(mData.family_id)
          }
        }

        if (famId) {
          setFamilyId(famId)

          // Cargar nombre de familia
          try {
            const { data: fData } = await supabase.from('families').select('name').eq('id', famId).maybeSingle()
            if (fData?.name) setFamilyName(fData.name)
          } catch {}

          // Cargar miembros de la familia para el selector de comprador
          try {
            const { data: memData } = await supabase
              .from('family_members')
              .select('id, name')
              .eq('family_id', famId)
            if (memData) {
              setFamilyMembers(memData)
            }
          } catch {}

          // Cargar datos remotos de destinatarios y regalos
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
              const [recRes, giftsRes] = await Promise.all([
                supabase.from('wishlist_recipients').select('*').eq('family_id', famId).order('name', { ascending: true }),
                supabase.from('wishlist_gifts').select('*').eq('family_id', famId).order('created_at', { ascending: false }),
              ])

              if (recRes.data && recRes.data.length > 0) {
                setRecipients(recRes.data)
                try {
                  localStorage.setItem(LOCAL_RECIPIENTS_KEY, JSON.stringify(recRes.data))
                } catch {}
              }

              if (giftsRes.data) {
                setGifts(giftsRes.data)
                try {
                  localStorage.setItem(LOCAL_GIFTS_KEY, JSON.stringify(giftsRes.data))
                } catch {}
              }
            } catch (err) {
              console.warn('[Wishlist] Tabla remota aún no configurada o error de red:', err)
            }
          }
        }
      } catch (err) {
        console.warn('[Wishlist] Error inicializando:', err)
      }
    }

    loadMetaAndRemote()
  }, [supabase])

  // Manejar query actions (?action=new-gift o ?action=new-recipient)
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'new-gift') {
      openCreateGiftModal()
    } else if (action === 'new-person' || action === 'new-recipient') {
      openCreateRecipientModal()
    }
  }, [searchParams])

  // Guardar en local y sincronizar con Supabase
  const persistRecipients = (updated: WishlistRecipient[]) => {
    setRecipients(updated)
    try {
      localStorage.setItem(LOCAL_RECIPIENTS_KEY, JSON.stringify(updated))
    } catch {}
  }

  const persistGifts = (updated: WishlistGift[]) => {
    setGifts(updated)
    try {
      localStorage.setItem(LOCAL_GIFTS_KEY, JSON.stringify(updated))
    } catch {}
  }

  // --- MODAL RECIPIENTS ---
  const openCreateRecipientModal = () => {
    setEditingRecipient(null)
    setRecipientForm({
      name: '',
      relationship: '',
      notes: '',
      avatar_color: 'rose',
    })
    setIsRecipientModalOpen(true)
  }

  const openEditRecipientModal = (rec: WishlistRecipient) => {
    setEditingRecipient(rec)
    setRecipientForm({
      name: rec.name,
      relationship: rec.relationship || '',
      notes: rec.notes || '',
      avatar_color: rec.avatar_color || 'rose',
    })
    setIsRecipientModalOpen(true)
  }

  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = recipientForm.name.trim()
    if (!trimmedName) {
      showToast('Por favor ingresa un nombre')
      return
    }

    if (editingRecipient) {
      // Editar
      const updated = recipients.map((r) =>
        r.id === editingRecipient.id
          ? {
              ...r,
              name: trimmedName,
              relationship: recipientForm.relationship.trim(),
              notes: recipientForm.notes.trim(),
              avatar_color: recipientForm.avatar_color,
              updated_at: new Date().toISOString(),
            }
          : r
      )
      persistRecipients(updated)
      setIsRecipientModalOpen(false)
      showToast(`Persona "${trimmedName}" actualizada`)

      // Sync Supabase
      if (familyId && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await supabase
            .from('wishlist_recipients')
            .update({
              name: trimmedName,
              relationship: recipientForm.relationship.trim(),
              notes: recipientForm.notes.trim(),
              avatar_color: recipientForm.avatar_color,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingRecipient.id)
            .eq('family_id', familyId)
        } catch {}
      }
    } else {
      // Crear
      const newRec: WishlistRecipient = {
        id: safeUUID(),
        family_id: familyId,
        name: trimmedName,
        relationship: recipientForm.relationship.trim(),
        notes: recipientForm.notes.trim(),
        avatar_color: recipientForm.avatar_color,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const updated = [...recipients, newRec]
      persistRecipients(updated)
      setSelectedRecipientId(newRec.id)
      setIsRecipientModalOpen(false)
      showToast(`¡"${trimmedName}" añadido a la lista!`)

      // Sync Supabase
      if (familyId && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await supabase.from('wishlist_recipients').insert([newRec])
        } catch {}
      }
    }
  }

  const handleDeleteRecipient = async (rec: WishlistRecipient) => {
    const giftCount = gifts.filter((g) => g.recipient_id === rec.id).length
    const confirmMsg = giftCount > 0
      ? `¿Eliminar a ${rec.name} y sus ${giftCount} idea(s) de regalo?`
      : `¿Eliminar a ${rec.name}?`

    if (!window.confirm(confirmMsg)) return

    const updatedRecs = recipients.filter((r) => r.id !== rec.id)
    const updatedGifts = gifts.filter((g) => g.recipient_id !== rec.id)

    persistRecipients(updatedRecs)
    persistGifts(updatedGifts)
    if (selectedRecipientId === rec.id) {
      setSelectedRecipientId('all')
    }
    showToast(`Persona "${rec.name}" eliminada`)

    // Sync Supabase
    if (familyId && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('wishlist_recipients').delete().eq('id', rec.id).eq('family_id', familyId)
      } catch {}
    }
  }

  // --- MODAL GIFTS ---
  const openCreateGiftModal = (preselectedRecipientId?: string) => {
    if (recipients.length === 0) {
      showToast('Primero añade a una persona para asignarle ideas de regalos')
      openCreateRecipientModal()
      return
    }

    setEditingGift(null)
    const targetRecipientId =
      preselectedRecipientId ||
      (selectedRecipientId !== 'all' ? selectedRecipientId : recipients[0]?.id || '')

    setGiftForm({
      recipient_id: targetRecipientId,
      title: '',
      notes: '',
      price: '',
      url: '',
      is_bought: false,
      buyer_name: '',
    })
    setIsGiftModalOpen(true)
  }

  const openEditGiftModal = (gift: WishlistGift) => {
    setEditingGift(gift)
    setGiftForm({
      recipient_id: gift.recipient_id,
      title: gift.title,
      notes: gift.notes || '',
      price: gift.price || '',
      url: gift.url || '',
      is_bought: gift.is_bought,
      buyer_name: gift.buyer_name || '',
    })
    setIsGiftModalOpen(true)
  }

  const handleSaveGift = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = giftForm.title.trim()
    if (!trimmedTitle) {
      showToast('Por favor escribe el nombre de la idea de regalo')
      return
    }
    if (!giftForm.recipient_id) {
      showToast('Por favor selecciona para quién es el regalo')
      return
    }

    if (editingGift) {
      // Editar regalo
      const updated = gifts.map((g) =>
        g.id === editingGift.id
          ? {
              ...g,
              recipient_id: giftForm.recipient_id,
              title: trimmedTitle,
              notes: giftForm.notes.trim(),
              price: giftForm.price.trim(),
              url: giftForm.url.trim(),
              is_bought: giftForm.is_bought,
              buyer_name: giftForm.buyer_name.trim(),
              updated_at: new Date().toISOString(),
            }
          : g
      )
      persistGifts(updated)
      setIsGiftModalOpen(false)
      showToast(`Idea de regalo "${trimmedTitle}" actualizada`)

      // Sync Supabase
      if (familyId && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await supabase
            .from('wishlist_gifts')
            .update({
              recipient_id: giftForm.recipient_id,
              title: trimmedTitle,
              notes: giftForm.notes.trim(),
              price: giftForm.price.trim(),
              url: giftForm.url.trim(),
              is_bought: giftForm.is_bought,
              buyer_name: giftForm.buyer_name.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingGift.id)
            .eq('family_id', familyId)
        } catch {}
      }
    } else {
      // Crear regalo
      const newGift: WishlistGift = {
        id: safeUUID(),
        family_id: familyId,
        recipient_id: giftForm.recipient_id,
        title: trimmedTitle,
        notes: giftForm.notes.trim(),
        price: giftForm.price.trim(),
        url: giftForm.url.trim(),
        is_bought: giftForm.is_bought,
        buyer_name: giftForm.buyer_name.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const updated = [newGift, ...gifts]
      persistGifts(updated)
      setIsGiftModalOpen(false)
      showToast(`¡Regalo "${trimmedTitle}" agregado!`)

      // Sync Supabase
      if (familyId && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await supabase.from('wishlist_gifts').insert([newGift])
        } catch {}
      }
    }
  }

  const handleToggleBought = async (gift: WishlistGift) => {
    const nextBought = !gift.is_bought
    const updated = gifts.map((g) =>
      g.id === gift.id
        ? {
            ...g,
            is_bought: nextBought,
            updated_at: new Date().toISOString(),
          }
        : g
    )
    persistGifts(updated)
    showToast(nextBought ? '¡Regalo marcado como comprado! 🎉' : 'Regalo marcado como idea pendiente')

    // Sync Supabase
    if (familyId && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase
          .from('wishlist_gifts')
          .update({
            is_bought: nextBought,
            updated_at: new Date().toISOString(),
          })
          .eq('id', gift.id)
          .eq('family_id', familyId)
      } catch {}
    }
  }

  const handleDeleteGift = async (gift: WishlistGift) => {
    if (!window.confirm(`¿Eliminar la idea de regalo "${gift.title}"?`)) return

    const updated = gifts.filter((g) => g.id !== gift.id)
    persistGifts(updated)
    showToast('Regalo eliminado')

    // Sync Supabase
    if (familyId && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('wishlist_gifts').delete().eq('id', gift.id).eq('family_id', familyId)
      } catch {}
    }
  }

  // Filtrado de regalos
  const filteredGifts = useMemo(() => {
    return gifts.filter((g) => {
      // Filtro por persona
      if (selectedRecipientId !== 'all' && g.recipient_id !== selectedRecipientId) {
        return false
      }

      // Filtro por estado
      if (statusFilter === 'pending' && g.is_bought) return false
      if (statusFilter === 'bought' && !g.is_bought) return false

      // Filtro por búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const rec = recipients.find((r) => r.id === g.recipient_id)
        const matchTitle = g.title.toLowerCase().includes(q)
        const matchNotes = (g.notes || '').toLowerCase().includes(q)
        const matchPrice = (g.price || '').toLowerCase().includes(q)
        const matchPerson = rec ? rec.name.toLowerCase().includes(q) : false
        if (!matchTitle && !matchNotes && !matchPrice && !matchPerson) {
          return false
        }
      }

      return true
    })
  }, [gifts, selectedRecipientId, statusFilter, searchQuery, recipients])

  const currentRecipient = useMemo(() => {
    if (selectedRecipientId === 'all') return null
    return recipients.find((r) => r.id === selectedRecipientId) || null
  }, [recipients, selectedRecipientId])

  // Contadores
  const totalPending = gifts.filter((g) => !g.is_bought).length
  const totalBought = gifts.filter((g) => g.is_bought).length

  const roseGradient = {
    background: 'linear-gradient(134.95deg, #BE123C 0%, #E11D48 50%, #FB7185 100%)',
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* TOAST FLOTANTE */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-rose-500/50 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-[0_8px_30px_rgba(225,29,72,0.4)] flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER: Volver al Dashboard, Saludo y Campana */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 text-rose-400 flex items-center justify-center font-bold text-lg shadow-md shrink-0 transition-all duration-200 hover:scale-105 active:scale-90 no-underline hover:border-rose-500/40"
          >
            <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="leading-tight flex flex-col">
            <span className="text-xs font-bold text-rose-400 tracking-wide">{familyName}</span>
            <h1 className="text-2xl font-black tracking-tight text-white m-0 flex items-center gap-2">
              <span>🎁 Wishlist & Regalos</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* SUBTÍTULO DESCRIPTIVO & ACCIONES PRINCIPALES */}
      <section className="p-4 rounded-3xl bg-[#181818] border border-neutral-800/80 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-neutral-300 font-medium m-0 leading-relaxed">
            Registra ideas de regalos para personas externas (amigos, familiares o compañeros).
          </p>
          <div className="flex items-center gap-3 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <strong>{totalPending}</strong> {totalPending === 1 ? 'idea pendiente' : 'ideas pendientes'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <strong>{totalBought}</strong> {totalBought === 1 ? 'comprado' : 'comprados'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={openCreateRecipientModal}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-700/80 hover:border-rose-500/60 text-neutral-200 hover:text-white text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-sm"
          >
            <span className="text-rose-400 font-black">+</span>
            <span>Persona</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateGiftModal()}
            style={roseGradient}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-white text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 cursor-pointer shadow-[0_4px_16px_rgba(225,29,72,0.35)]"
          >
            <span>+ Regalo</span>
          </button>
        </div>
      </section>

      {/* CARRUSEL DE PERSONAS / DESTINATARIOS */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Destinatarios ({recipients.length})
          </span>
          {recipients.length > 0 && (
            <button
              type="button"
              onClick={openCreateRecipientModal}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              + Añadir otra persona
            </button>
          )}
        </div>

        {recipients.length === 0 ? (
          <div className="p-6 rounded-[28px] bg-[#161616] border border-dashed border-neutral-800 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center text-2xl">
              🎁
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="text-sm font-bold text-white m-0">¡Aún no tienes personas registradas!</h3>
              <p className="text-xs text-neutral-400 m-0">
                Añade a tu amigo Juan, a tu primo o a quien quieras regalarle para empezar a guardar ideas.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateRecipientModal}
              style={roseGradient}
              className="mt-1 px-4 py-2 rounded-2xl text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              + Añadir primera persona
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {/* Botón "Todos" */}
            <button
              type="button"
              onClick={() => setSelectedRecipientId('all')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer border ${
                selectedRecipientId === 'all'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-[0_2px_12px_rgba(225,29,72,0.35)]'
                  : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
              }`}
            >
              <span>🌟 Todos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedRecipientId === 'all' ? 'bg-white text-rose-600' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {gifts.length}
              </span>
            </button>

            {/* Chips de personas */}
            {recipients.map((rec) => {
              const isSelected = selectedRecipientId === rec.id
              const count = gifts.filter((g) => g.recipient_id === rec.id).length
              const colorTheme = RECIPIENT_COLORS.find((c) => c.id === rec.avatar_color) || RECIPIENT_COLORS[0]

              return (
                <div
                  key={rec.id}
                  className={`shrink-0 flex items-center rounded-2xl border transition-all duration-150 ${
                    isSelected
                      ? 'bg-rose-950/60 border-rose-500/80 shadow-[0_2px_12px_rgba(225,29,72,0.25)] text-white'
                      : 'bg-[#181818] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedRecipientId(rec.id)}
                    className="px-3 py-2 flex items-center gap-2 text-xs font-bold cursor-pointer"
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${colorTheme.bg} ${colorTheme.text}`}>
                      {rec.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate max-w-[120px]">{rec.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-rose-500 text-white' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {count}
                    </span>
                  </button>

                  <div className="flex items-center pr-1.5 gap-0.5">
                    <button
                      type="button"
                      title={`Editar a ${rec.name}`}
                      onClick={() => openEditRecipientModal(rec)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title={`Eliminar a ${rec.name}`}
                      onClick={() => handleDeleteRecipient(rec)}
                      className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800/80 transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* SI HAY UNA PERSONA SELECCIONADA: DETALLE DE PERFIL */}
      {currentRecipient && (
        <section className="p-4 rounded-3xl bg-[#1a1a1a] border border-neutral-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center font-black text-base shrink-0">
              {currentRecipient.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white m-0">{currentRecipient.name}</h2>
                {currentRecipient.relationship && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-rose-300 border border-neutral-700">
                    {currentRecipient.relationship}
                  </span>
                )}
              </div>
              {currentRecipient.notes && (
                <p className="text-xs text-neutral-400 m-0 mt-0.5 leading-snug">
                  💡 {currentRecipient.notes}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => openEditRecipientModal(currentRecipient)}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:text-white cursor-pointer hover:border-neutral-700 transition-all"
            >
              Editar datos
            </button>
            <button
              type="button"
              onClick={() => openCreateGiftModal(currentRecipient.id)}
              style={roseGradient}
              className="px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Idea para {currentRecipient.name.split(' ')[0]}</span>
            </button>
          </div>
        </section>
      )}

      {/* BUSCADOR Y FILTROS DE ESTADO */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Input de búsqueda */}
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por regalo, nota, tienda o persona..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181818] border border-neutral-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros de estado */}
        <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-2xl border border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todos ({gifts.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            💡 Ideas ({totalPending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('bought')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'bought'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            ✅ Comprados ({totalBought})
          </button>
        </div>
      </section>

      {/* LISTA / GRID DE REGALOS */}
      <section className="flex flex-col gap-3">
        {filteredGifts.length === 0 ? (
          <div className="p-8 rounded-[32px] bg-[#161616] border border-neutral-800 text-center flex flex-col items-center justify-center gap-3">
            <span className="text-3xl">🎀</span>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="text-sm font-bold text-white m-0">No hay ideas de regalos en esta vista</h3>
              <p className="text-xs text-neutral-400 m-0">
                {searchQuery
                  ? 'No se encontraron coincidencias con tu búsqueda.'
                  : currentRecipient
                  ? `Aún no has anotado ideas para ${currentRecipient.name}.`
                  : '¡Presiona el botón "+ Regalo" para agregar una nueva idea!'}
              </p>
            </div>
            {recipients.length > 0 && (
              <button
                type="button"
                onClick={() => openCreateGiftModal(currentRecipient?.id)}
                style={roseGradient}
                className="mt-2 px-4 py-2 rounded-2xl text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                + Añadir idea de regalo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredGifts.map((gift) => {
              const recipient = recipients.find((r) => r.id === gift.recipient_id)
              const recipientName = recipient?.name || 'Destinatario'
              const colorTheme = RECIPIENT_COLORS.find((c) => c.id === recipient?.avatar_color) || RECIPIENT_COLORS[0]

              return (
                <div
                  key={gift.id}
                  className={`relative p-4 rounded-3xl border transition-all duration-200 flex flex-col justify-between gap-3 group ${
                    gift.is_bought
                      ? 'bg-[#151a17] border-emerald-950/80 hover:border-emerald-800/60'
                      : 'bg-[#1a1a1a] border-neutral-800/90 hover:border-rose-500/40 hover:shadow-[0_8px_24px_rgba(225,29,72,0.15)]'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    {/* Header de la tarjeta: Destinatario y Menú de Acciones */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedRecipientId(gift.recipient_id)}
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all hover:scale-105 cursor-pointer flex items-center gap-1.5 ${colorTheme.badge}`}
                      >
                        <span>👤 Para:</span>
                        <strong>{recipientName}</strong>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Editar regalo"
                          onClick={() => openEditGiftModal(gift)}
                          className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Eliminar regalo"
                          onClick={() => handleDeleteGift(gift)}
                          className="p-1.5 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Título de la idea */}
                    <h3 className={`text-base font-bold leading-snug m-0 ${
                      gift.is_bought ? 'line-through text-neutral-400' : 'text-white'
                    }`}>
                      {gift.title}
                    </h3>

                    {/* Notas / Talla / Especificaciones */}
                    {gift.notes && (
                      <p className="text-xs text-neutral-400 font-normal m-0 leading-relaxed whitespace-pre-line">
                        {gift.notes}
                      </p>
                    )}

                    {/* Precios y Enlace */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {gift.price && (
                        <span className="text-[11px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span>🏷️</span>
                          <span>{gift.price}</span>
                        </span>
                      )}

                      {gift.url && (
                        <a
                          href={gift.url.startsWith('http') ? gift.url : `https://${gift.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 rounded-lg hover:bg-sky-500/25 transition-all no-underline flex items-center gap-1"
                        >
                          <span>Ver producto</span>
                          <svg className="w-3 h-3 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}

                      {gift.buyer_name && (
                        <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-lg">
                          🎁 Regala: {gift.buyer_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botón de estado: Comprado / Pendiente */}
                  <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500">
                      {gift.is_bought ? 'Comprado' : 'Idea pendiente de comprar'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleBought(gift)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                        gift.is_bought
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-neutral-900 text-neutral-300 border border-neutral-700 hover:border-emerald-500 hover:text-emerald-400'
                      }`}
                    >
                      {gift.is_bought ? (
                        <>
                          <span>✓ ¡Comprado!</span>
                        </>
                      ) : (
                        <>
                          <span className="text-neutral-500">○</span>
                          <span>Marcar comprado</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* MODAL: CREAR / EDITAR PERSONA */}
      {isRecipientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#161616] border border-neutral-800 rounded-[32px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">👤</span>
                <h2 className="text-lg font-black text-white m-0">
                  {editingRecipient ? 'Editar Persona' : 'Nueva Persona'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRecipientModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecipient} className="flex flex-col gap-4">
              {/* Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Nombre de la persona <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Amigo Juan, Tía Marta, Primo Lucas..."
                  value={recipientForm.name}
                  onChange={(e) => setRecipientForm({ ...recipientForm, name: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Vínculo o relación */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Vínculo o categoría (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Amigo, Compañero de trabajo, Primo, Vecina..."
                  value={recipientForm.relationship}
                  onChange={(e) => setRecipientForm({ ...recipientForm, relationship: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Notas de gustos o fecha de cumpleaños */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Gustos, tallas o fecha especial (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Le gustan los libros de fantasía y el café. Cumpleaños el 15 de Noviembre."
                  value={recipientForm.notes}
                  onChange={(e) => setRecipientForm({ ...recipientForm, notes: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors resize-none"
                />
              </div>

              {/* Selector de color */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-neutral-300">
                  Color de avatar
                </label>
                <div className="flex items-center gap-2">
                  {RECIPIENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setRecipientForm({ ...recipientForm, avatar_color: c.id })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${c.bg} ${
                        recipientForm.avatar_color === c.id ? 'scale-125 border-white ring-2 ring-rose-500/50' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecipientModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:text-white cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={roseGradient}
                  className="flex-1 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  {editingRecipient ? 'Guardar Cambios' : 'Añadir Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR REGALO */}
      {isGiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#161616] border border-neutral-800 rounded-[32px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🎁</span>
                <h2 className="text-lg font-black text-white m-0">
                  {editingGift ? 'Editar Idea de Regalo' : 'Nueva Idea de Regalo'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsGiftModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGift} className="flex flex-col gap-4">
              {/* Persona destinataria */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Para quién es el regalo <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={giftForm.recipient_id}
                  onChange={(e) => setGiftForm({ ...giftForm, recipient_id: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
                >
                  <option value="" disabled>Selecciona un destinatario...</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.relationship ? `(${r.relationship})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Título o nombre de la idea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  ¿Qué regalo tienes en mente? <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Auriculares Bluetooth, Libro de Stephen King, Chaqueta térmica..."
                  value={giftForm.title}
                  onChange={(e) => setGiftForm({ ...giftForm, title: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Precio estimado */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Precio estimado (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: $25.000, 30 USD, etc."
                  value={giftForm.price}
                  onChange={(e) => setGiftForm({ ...giftForm, price: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Enlace o link a tienda */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Enlace web o tienda (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: https://mercadolibre.cl/..., amazon.com, falabella.com..."
                  value={giftForm.url}
                  onChange={(e) => setGiftForm({ ...giftForm, url: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Notas, talla, color */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Detalles, talla, color o especificaciones (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Talla L, color negro o azul marino. Visto en la tienda del mall."
                  value={giftForm.notes}
                  onChange={(e) => setGiftForm({ ...giftForm, notes: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors resize-none"
                />
              </div>

              {/* Quién lo regala / Comprador */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  ¿Quién lo regala o lo comprará? (opcional)
                </label>
                <input
                  type="text"
                  list="family-members-datalist"
                  placeholder="Ej: Gonzalo, Mamá, Entre todos..."
                  value={giftForm.buyer_name}
                  onChange={(e) => setGiftForm({ ...giftForm, buyer_name: e.target.value })}
                  className="bg-[#1e1e1e] border border-neutral-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
                <datalist id="family-members-datalist">
                  {familyMembers.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                  <option value="Toda la familia" />
                </datalist>
              </div>

              {/* Checkbox: ¿Ya está comprado? */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#1e1e1e] border border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={giftForm.is_bought}
                  onChange={(e) => setGiftForm({ ...giftForm, is_bought: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-700 text-rose-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-bold text-neutral-200">
                  Marcar como ya comprado
                </span>
              </label>

              {/* Botones */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGiftModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:text-white cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={roseGradient}
                  className="flex-1 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  {editingGift ? 'Guardar Cambios' : 'Añadir Idea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
