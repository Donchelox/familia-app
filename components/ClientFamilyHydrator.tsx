'use client'

import { useEffect } from 'react'
import { saveOfflineFamilyId } from '@/lib/offline/familyContext'
import { hydrateFamilyData } from '@/lib/offline/clientSync'

interface ClientFamilyHydratorProps {
  familyId: string
}

/**
 * Componente cliente ligero que hidrata de inmediato el familyId en localStorage
 * y desencadena la hidratación inicial de Dexie para que todas las páginas
 * dispongan de familyId sin latencia ni cuelgues.
 */
export default function ClientFamilyHydrator({ familyId }: ClientFamilyHydratorProps) {
  useEffect(() => {
    if (familyId && familyId.trim()) {
      saveOfflineFamilyId(familyId.trim())
      hydrateFamilyData(familyId.trim()).catch((err) => {
        console.debug('[ClientFamilyHydrator] Error en hidratación en segundo plano:', err)
      })
    }
  }, [familyId])

  return null
}
