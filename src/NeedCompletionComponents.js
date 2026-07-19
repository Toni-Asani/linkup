import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { HubbingIcon } from './icons'
import {
  confirmNeedCompletion,
  createNeedCompletion,
  declineNeedCompletion,
  searchCompletionProviderCompanies,
  validateCompletionPhoto,
} from './needCompletions'

const getText = ui => ui?.needCompletions || {
  closeNeed: 'Clôturer ce besoin',
  modalTitle: 'Clôturer le besoin',
  hubbingProvider: 'Entreprise sur Hubbing',
  externalProvider: 'Prestataire externe',
  searchPlaceholder: 'Rechercher une entreprise Hubbing...',
  externalName: 'Nom du prestataire externe *',
  externalCity: 'Ville (optionnel)',
  notePlaceholder: 'Note courte sur la réalisation (optionnel)',
  finalPhotos: 'Photos de la réalisation finale',
  beforePhotos: 'Avant',
  afterPhotos: 'Après travaux',
  addPhotos: 'Ajouter des photos',
  confirmClose: 'Clôturer',
  closing: 'Clôture...',
  providerRequired: 'Sélectionnez une entreprise ou indiquez un prestataire externe.',
  created: 'Besoin clôturé.',
  pendingTitle: 'Réalisations à confirmer',
  pendingSubtitle: 'Une entreprise indique que vous avez réalisé ce besoin.',
  confirmShow: 'Confirmer et afficher',
  confirmHide: 'Confirmer sans afficher',
  decline: 'Refuser',
  closedNeeds: 'Besoins clôturés',
  providerWorks: 'Réalisations confirmées',
  doneBy: 'Réalisé par',
  doneWithExternal: 'Réalisé avec un prestataire externe',
  declaredBy: 'Déclaré par',
  confirmedBadge: 'Confirmé',
  declaredBadge: 'Déclaré',
  pendingBadge: 'En attente',
  hiddenOnProvider: 'Non affiché sur le profil prestataire',
  noResults: 'Aucune entreprise trouvée.',
}

const panelStyle = {
  background: 'white',
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: '1rem',
}

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  borderRadius: 999,
  padding: '4px 9px',
  fontSize: 11,
  fontWeight: 800,
}

const buttonBase = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'Plus Jakarta Sans',
}

let bodyScrollLocks = 0
let previousBodyOverflow = ''
let previousHtmlOverflow = ''

const lockBodyScroll = () => {
  if (typeof document === 'undefined') return () => {}
  if (bodyScrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  bodyScrollLocks += 1
  return () => {
    bodyScrollLocks = Math.max(0, bodyScrollLocks - 1)
    if (bodyScrollLocks === 0) {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }
}

export function NeedCompletionCloseButton({ need, onClick, ui }) {
  const text = getText(ui)
  return (
    <button type="button" onClick={() => onClick?.(need)}
      style={{ ...buttonBase, background: '#FFF5F5', color: '#E24B4A', border: '1px solid #FECACA', padding: '8px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <HubbingIcon name="check" size={14} color="#E24B4A" />
      {text.closeNeed}
    </button>
  )
}

export function NeedCompletionCloseModal({ company, need, ui, onClose, onCreated }) {
  const text = getText(ui)
  const [mode, setMode] = useState('hubbing')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [externalName, setExternalName] = useState('')
  const [externalCity, setExternalCity] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'hubbing' || selectedCompany) {
      setResults([])
      return undefined
    }
    const timer = window.setTimeout(async () => {
      try {
        setResults(await searchCompletionProviderCompanies({ query, excludeCompanyId: company?.id }))
      } catch (searchError) {
        console.warn('Company search failed:', searchError?.message || searchError)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, mode, selectedCompany, company?.id])

  const handleFiles = async event => {
    const files = [...(event.target.files || [])].slice(0, 6)
    event.target.value = ''
    if (!files.length) return
    setError('')
    try {
      for (const file of files) await validateCompletionPhoto(file, ui)
      setPhotos(current => [...current, ...files].slice(0, 6))
    } catch (photoError) {
      setError(photoError?.message || text.photoTypeError)
    }
  }

  const submit = async () => {
    if (saving) return
    setError('')
    if (mode === 'hubbing' && !selectedCompany) {
      setError(text.providerRequired)
      return
    }
    if (mode === 'external' && !externalName.trim()) {
      setError(text.providerRequired)
      return
    }
    setSaving(true)
    try {
      await createNeedCompletion({
        clientCompany: company,
        needKey: need?.needKey,
        needLabel: need?.needLabel,
        needTitle: need?.needTitle || need?.needLabel,
        clientNote: note,
        providerCompany: mode === 'hubbing' ? selectedCompany : null,
        externalProviderName: mode === 'external' ? externalName : '',
        externalProviderCity: mode === 'external' ? externalCity : '',
        photos,
        ui,
      })
      onCreated?.()
      onClose?.()
    } catch (submitError) {
      setError(submitError?.message || text.createError || 'Clôture impossible.')
    } finally {
      setSaving(false)
    }
  }

  const photoPreviews = useMemo(() => photos.map((file, index) => ({
    file,
    index,
    url: URL.createObjectURL(file),
  })), [photos])

  useEffect(() => () => {
    photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url))
  }, [photoPreviews])

  useEffect(() => {
    const unlock = lockBodyScroll()
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unlock()
    }
  }, [onClose])

  const dialog = (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(15,23,42,0.62)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 12px)' }}>
      <div onClick={event => event.stopPropagation()}
        style={{ width: '100%', maxWidth: 430, background: 'white', borderRadius: 18, padding: '1rem 1rem 0', maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', boxShadow: '0 -20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 12, color: '#E24B4A', fontWeight: 800, margin: 0 }}>{text.modalTitle}</p>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0' }}>{need?.needTitle || need?.needLabel}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"
            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HubbingIcon name="x" size={18} color="#4B5563" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { id: 'hubbing', label: text.hubbingProvider },
            { id: 'external', label: text.externalProvider },
          ].map(option => (
            <button key={option.id} type="button" onClick={() => { setMode(option.id); setSelectedCompany(null); setError('') }}
              style={{ ...buttonBase, background: mode === option.id ? '#E24B4A' : '#F9FAFB', color: mode === option.id ? 'white' : '#374151', border: `1px solid ${mode === option.id ? '#E24B4A' : '#E5E7EB'}` }}>
              {option.label}
            </button>
          ))}
        </div>

        {mode === 'hubbing' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedCompany ? (
              <SelectedCompany company={selectedCompany} onClear={() => setSelectedCompany(null)} />
            ) : (
              <>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder={text.searchPlaceholder}
                  style={{ padding: '13px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 15, outline: 'none', fontFamily: 'Plus Jakarta Sans' }} />
                {query.trim().length >= 2 && (
                  <div style={{ border: '1px solid #F1F5F9', borderRadius: 12, overflow: 'hidden' }}>
                    {results.length > 0 ? results.map(result => (
                      <button key={result.id} type="button" onClick={() => setSelectedCompany(result)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: 'none', borderBottom: '1px solid #F1F5F9', background: 'white', cursor: 'pointer', textAlign: 'left' }}>
                        <CompanyAvatar company={result} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#111827' }}>{result.name}</p>
                          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{[result.sector, result.city].filter(Boolean).join(' · ')}</p>
                        </div>
                      </button>
                    )) : (
                      <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, padding: 12 }}>{text.noResults}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={externalName} onChange={event => setExternalName(event.target.value)} placeholder={text.externalName}
              style={{ padding: '13px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 15, outline: 'none', fontFamily: 'Plus Jakarta Sans' }} />
            <input value={externalCity} onChange={event => setExternalCity(event.target.value)} placeholder={text.externalCity}
              style={{ padding: '13px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 15, outline: 'none', fontFamily: 'Plus Jakarta Sans' }} />
          </div>
        )}

        <textarea value={note} onChange={event => setNote(event.target.value)} placeholder={text.notePlaceholder}
          rows={3}
          style={{ width: '100%', marginTop: 12, padding: '12px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 14, outline: 'none', fontFamily: 'Plus Jakarta Sans', resize: 'vertical' }} />

        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, margin: '0 0 8px' }}>{text.finalPhotos}</p>
          <label style={{ ...buttonBase, display: 'inline-flex', background: '#F3F4F6', color: '#374151', alignItems: 'center', gap: 6 }}>
            <HubbingIcon name="camera" size={15} color="#374151" />
            {text.addPhotos}
            <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
          </label>
          {photoPreviews.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
              {photoPreviews.map(({ file, index, url }) => (
                <div key={`${file.name}-${index}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#F3F4F6' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => setPhotos(current => current.filter((_, i) => i !== index))}
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: 'white', cursor: 'pointer' }}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 0, margin: '14px -1rem 0', padding: '12px 1rem calc(env(safe-area-inset-bottom) + 12px)', background: 'white', borderTop: '1px solid #F1F5F9', boxShadow: '0 -10px 24px rgba(15,23,42,0.06)' }}>
          {error && <p style={{ fontSize: 13, color: '#E24B4A', fontWeight: 700, margin: '0 0 10px' }}>{error}</p>}
          <button type="button" onClick={submit} disabled={saving}
            style={{ ...buttonBase, width: '100%', padding: '13px', background: saving ? '#F3F4F6' : '#E24B4A', color: saving ? '#9CA3AF' : 'white' }}>
            {saving ? text.closing : text.confirmClose}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body)
}

function SelectedCompany({ company, onClear }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid #BBF7D0', background: '#F0FDF4', borderRadius: 12 }}>
      <CompanyAvatar company={company} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{company.name}</p>
        <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{[company.sector, company.city].filter(Boolean).join(' · ')}</p>
      </div>
      <button type="button" onClick={onClear}
        style={{ border: 'none', background: 'transparent', color: '#E24B4A', fontWeight: 900, cursor: 'pointer' }}>
        x
      </button>
    </div>
  )
}

function CompanyAvatar({ company }) {
  const initials = String(company?.name || '?').slice(0, 2).toUpperCase()
  if (company?.logo_url) {
    return <img src={company.logo_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#E24B4A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export function NeedCompletionsPanel({
  companyId,
  completions = [],
  ui,
  onChanged,
  showPendingActions = false,
  canViewClosed = true,
  onUpgrade,
  lang = 'fr',
}) {
  const text = getText(ui)
  const closedAccess = {
    fr: {
      title: 'Besoins clôturés',
      description: 'Pour voir les collaborations clôturées, passez au forfait Basic ou Premium.',
      button: 'Changer d’offre',
    },
    de: {
      title: 'Abgeschlossene Bedürfnisse',
      description: 'Wechseln Sie zu Basic oder Premium, um abgeschlossene Zusammenarbeiten zu sehen.',
      button: 'Abo wechseln',
    },
    it: {
      title: 'Bisogni conclusi',
      description: 'Passa a Basic o Premium per vedere le collaborazioni concluse.',
      button: 'Cambia piano',
    },
    en: {
      title: 'Closed needs',
      description: 'Upgrade to Basic or Premium to view completed collaborations.',
      button: 'Change plan',
    },
  }[lang] || {}
  const [busyId, setBusyId] = useState(null)

  const pending = useMemo(() => completions.filter(item => (
    showPendingActions && item.provider_company_id === companyId && item.status === 'pending'
  )), [completions, companyId, showPendingActions])

  const clientVisible = useMemo(() => completions.filter(item => (
    item.client_company_id === companyId && ['confirmed', 'external_declared', 'pending'].includes(item.status)
  )), [completions, companyId])

  const providerVisible = useMemo(() => completions.filter(item => (
    item.provider_company_id === companyId && item.status === 'confirmed' && item.show_on_provider_profile
  )), [completions, companyId])

  const handleConfirm = async (completion, showOnProviderProfile) => {
    setBusyId(completion.id)
    try {
      await confirmNeedCompletion({ completionId: completion.id, showOnProviderProfile })
      onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  const handleDecline = async completion => {
    setBusyId(completion.id)
    try {
      await declineNeedCompletion(completion.id)
      onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  if (canViewClosed && pending.length === 0 && clientVisible.length === 0 && providerVisible.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pending.length > 0 && (
        <section style={{ ...panelStyle, borderColor: '#FECACA', background: '#FFF5F5' }}>
          <p style={{ fontSize: 12, color: '#E24B4A', fontWeight: 900, margin: '0 0 4px' }}>{text.pendingTitle}</p>
          <p style={{ fontSize: 12, color: '#7F1D1D', margin: '0 0 10px' }}>{text.pendingSubtitle}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(item => (
              <CompletionCard key={item.id} completion={item} ui={ui} perspective="provider" actionSlot={(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => handleConfirm(item, true)} disabled={busyId === item.id}
                    style={{ ...buttonBase, background: '#E24B4A', color: 'white' }}>
                    {text.confirmShow}
                  </button>
                  <button type="button" onClick={() => handleConfirm(item, false)} disabled={busyId === item.id}
                    style={{ ...buttonBase, background: '#F3F4F6', color: '#374151' }}>
                    {text.confirmHide}
                  </button>
                  <button type="button" onClick={() => handleDecline(item)} disabled={busyId === item.id}
                    style={{ ...buttonBase, background: 'white', color: '#991B1B', border: '1px solid #FECACA' }}>
                    {text.decline}
                  </button>
                </div>
              )} />
            ))}
          </div>
        </section>
      )}

      {!canViewClosed && (
        <section style={{ ...panelStyle, borderColor: '#FED7AA', background: '#FFF7ED', textAlign: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 9px' }}>
            <HubbingIcon name="lock" size={19} color="#C2410C" />
          </div>
          <p style={{ fontSize: 12, color: '#C2410C', fontWeight: 900, margin: '0 0 5px' }}>{closedAccess.title || text.closedNeeds}</p>
          <p style={{ fontSize: 13, color: '#7C2D12', lineHeight: 1.5, margin: '0 0 11px' }}>
            {text.closedNeedsUpgrade || closedAccess.description}
          </p>
          <button type="button" onClick={onUpgrade}
            style={{ ...buttonBase, width: '100%', background: '#E24B4A', color: 'white' }}>
            {text.changePlan || closedAccess.button || ui?.common?.viewPlans}
          </button>
        </section>
      )}

      {canViewClosed && clientVisible.length > 0 && (
        <section style={panelStyle}>
          <p style={{ fontSize: 12, color: '#E67E22', fontWeight: 900, margin: '0 0 10px' }}>{text.closedNeeds}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clientVisible.map(item => <CompletionCard key={item.id} completion={item} ui={ui} perspective="client" />)}
          </div>
        </section>
      )}

      {canViewClosed && providerVisible.length > 0 && (
        <section style={panelStyle}>
          <p style={{ fontSize: 12, color: '#166534', fontWeight: 900, margin: '0 0 10px' }}>{text.providerWorks}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {providerVisible.map(item => <CompletionCard key={item.id} completion={item} ui={ui} perspective="provider" />)}
          </div>
        </section>
      )}
    </div>
  )
}

function CompletionCard({ completion, ui, perspective, actionSlot }) {
  const text = getText(ui)
  const providerName = completion.providerCompany?.name || completion.provider_name
  const clientName = completion.clientCompany?.name
  const beforePhotos = completion.beforeAttachments || []
  const afterPhotos = completion.photos || []
  const isPending = completion.status === 'pending'
  const isExternal = completion.provider_external
  const badge = isPending
    ? { label: text.pendingBadge, color: '#B45309', bg: '#FEF3C7' }
    : isExternal
      ? { label: text.declaredBadge, color: '#047857', bg: '#D1FAE5' }
      : { label: text.confirmedBadge, color: '#047857', bg: '#D1FAE5' }

  return (
    <article style={{ background: '#FAFAFA', border: '1px solid #F1F5F9', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: '#111827' }}>{completion.need_title}</h4>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0', lineHeight: 1.4 }}>
            {perspective === 'provider'
              ? `${text.declaredBy} ${clientName || 'une entreprise'}`
              : isExternal
                ? `${text.doneWithExternal}${providerName ? ` : ${providerName}` : ''}`
                : `${text.doneBy} ${providerName || 'une entreprise'}`}
          </p>
          {completion.client_note && (
            <p style={{ fontSize: 13, color: '#374151', margin: '8px 0 0', lineHeight: 1.45 }}>{completion.client_note}</p>
          )}
        </div>
        <span style={{ ...pillStyle, background: badge.bg, color: badge.color }}>{badge.label}</span>
      </div>

      <CompletionPhotoStrip title={text.beforePhotos || 'Avant'} photos={beforePhotos} />
      <CompletionPhotoStrip title={text.afterPhotos || 'Après travaux'} photos={afterPhotos} />

      {completion.status === 'confirmed' && !completion.show_on_provider_profile && perspective === 'client' && !completion.provider_external && (
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>{text.hiddenOnProvider}</p>
      )}

      {actionSlot}
    </article>
  )
}

function CompletionPhotoStrip({ title, photos = [] }) {
  const [viewerIndex, setViewerIndex] = useState(null)
  const availablePhotos = photos.filter(photo => photo.signedUrl)

  if (!photos.length) return null

  return (
    <>
      <div style={{ marginTop: 10 }}>
        <p style={{ fontSize: 11, color: '#6B7280', fontWeight: 900, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0 }}>
          {title}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
          {photos.slice(0, 6).map(photo => {
            const photoIndex = availablePhotos.findIndex(item => item.id === photo.id)
            return (
              <button key={photo.id} type="button" disabled={!photo.signedUrl}
                onClick={() => photoIndex >= 0 && setViewerIndex(photoIndex)}
                aria-label={photo.signedUrl ? `Agrandir la photo ${photoIndex + 1}` : undefined}
                style={{ aspectRatio: '1', border: 'none', padding: 0, borderRadius: 9, overflow: 'hidden', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 11, fontWeight: 900, cursor: photo.signedUrl ? 'zoom-in' : 'default' }}>
                {photo.signedUrl ? (
                  <img src={photo.signedUrl} alt="" draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  'IMG'
                )}
              </button>
            )
          })}
        </div>
      </div>
      {viewerIndex !== null && availablePhotos[viewerIndex] && (
        <CompletionPhotoViewer
          photos={availablePhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  )
}

function CompletionPhotoViewer({ photos, initialIndex = 0, onClose }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const activePhoto = photos[activeIndex]
  const hasMultiple = photos.length > 1

  useEffect(() => {
    const unlock = lockBodyScroll()
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
      if (event.key === 'ArrowLeft') setActiveIndex(current => (current - 1 + photos.length) % photos.length)
      if (event.key === 'ArrowRight') setActiveIndex(current => (current + 1) % photos.length)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unlock()
    }
  }, [onClose, photos.length])

  const viewer = (
    <div role="dialog" aria-modal="true" aria-label="Photo agrandie" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(3,7,18,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top) + 58px) 14px calc(env(safe-area-inset-bottom) + 54px)' }}>
      <button type="button" onClick={onClose} aria-label="Fermer"
        style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', right: 14, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.14)', color: 'white', fontSize: 24, lineHeight: 1, cursor: 'pointer', zIndex: 2 }}>
        ×
      </button>

      {hasMultiple && (
        <button type="button" onClick={event => {
          event.stopPropagation()
          setActiveIndex(current => (current - 1 + photos.length) % photos.length)
        }} aria-label="Photo précédente"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 42, height: 52, borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.38)', color: 'white', fontSize: 34, cursor: 'pointer', zIndex: 2 }}>
          ‹
        </button>
      )}

      <img src={activePhoto.signedUrl} alt="" draggable={false}
        onClick={event => event.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: 10 }} />

      {hasMultiple && (
        <>
          <button type="button" onClick={event => {
            event.stopPropagation()
            setActiveIndex(current => (current + 1) % photos.length)
          }} aria-label="Photo suivante"
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 42, height: 52, borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.38)', color: 'white', fontSize: 34, cursor: 'pointer', zIndex: 2 }}>
            ›
          </button>
          <span style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 18px)', left: '50%', transform: 'translateX(-50%)', color: 'white', fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,0.45)', borderRadius: 999, padding: '5px 10px' }}>
            {activeIndex + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  )

  return typeof document === 'undefined' ? viewer : createPortal(viewer, document.body)
}
