import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { HubbingIcon } from './icons'
import {
  deleteCompanyRealization,
  getCompanyRealizationLimit,
  uploadCompanyRealization,
} from './companyRealizations'

const getText = ui => ui?.realizations || {
  title: 'Réalisations',
  subtitle: 'Ajoutez les photos de vos travaux et projets terminés.',
  open: 'Voir les réalisations',
  addPhotos: 'Ajouter des photos',
  takePhoto: 'Prendre une photo',
  importPhoto: 'Importer',
  replace: 'Remplacer',
  delete: 'Supprimer',
  uploading: 'Envoi...',
  replacing: 'Remplacement...',
  empty: 'Aucune réalisation ajoutée pour le moment.',
  emptyPublic: 'Rien à afficher pour le moment.',
  count: (count, max) => `${count}/${max} photos`,
  limitReached: max => `Limite atteinte : ${max} photos.`,
  uploaded: 'Photo ajoutée.',
  confirmDelete: 'Supprimer cette réalisation ?',
  uploadError: "Erreur lors de l'envoi de l'image.",
  deleteError: 'Suppression impossible.',
  close: 'Fermer',
  previous: 'Précédente',
  next: 'Suivante',
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

const stopSwipeGesture = event => {
  event.stopPropagation()
}

const imageFor = item => item?.signedUrl || item?.url || item?.publicUrl || ''

export function CompanyRealizationsManager({ company, plan, realizations = [], onChange, ui }) {
  const text = getText(ui)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [notice, setNotice] = useState(null)
  const limit = getCompanyRealizationLimit(plan)
  const count = realizations.length
  const canAdd = count < limit

  const refresh = async () => {
    await onChange?.()
  }

  const refreshAfterUpload = async () => {
    await refresh()
    window.setTimeout(() => refresh(), 700)
  }

  const uploadFiles = async files => {
    const selectedFiles = Array.from(files || []).filter(Boolean)
    if (!selectedFiles.length || busy) return
    setNotice(null)
    const availableSlots = Math.max(0, limit - count)
    if (availableSlots <= 0) {
      window.alert(text.limitReached(limit))
      return
    }
    const filesToUpload = selectedFiles.slice(0, availableSlots)
    if (selectedFiles.length > filesToUpload.length) {
      window.alert(text.limitReached(limit))
    }
    setBusy(true)
    setNotice({ type: 'info', message: text.uploading })
    try {
      for (let index = 0; index < filesToUpload.length; index += 1) {
        await uploadCompanyRealization({
          company,
          file: filesToUpload[index],
          position: count + index,
          ui,
        })
      }
      await refreshAfterUpload()
      setNotice({
        type: 'success',
        message: filesToUpload.length > 1
          ? `${filesToUpload.length} photos ajoutées.`
          : text.uploaded,
      })
    } catch (error) {
      const message = error?.message || text.uploadError
      setNotice({ type: 'error', message })
      window.alert(message)
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async event => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    await uploadFiles(files)
  }

  const handleReplace = async (event, item, index) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busyId) return
    setNotice(null)
    setBusyId(item.id)
    try {
      await uploadCompanyRealization({
        company,
        file,
        position: Number.isFinite(item.position) ? item.position : index,
        ui,
      })
      await deleteCompanyRealization(item)
      await refreshAfterUpload()
      setNotice({ type: 'success', message: text.uploaded })
    } catch (error) {
      const message = error?.message || text.uploadError
      setNotice({ type: 'error', message })
      window.alert(message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async item => {
    if (busyId || !window.confirm(text.confirmDelete)) return
    setNotice(null)
    setBusyId(item.id)
    try {
      await deleteCompanyRealization(item)
      await refresh()
    } catch (error) {
      const message = error?.message || text.deleteError
      setNotice({ type: 'error', message })
      window.alert(message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 900, color: '#111827', margin: 0 }}>{text.title}</p>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0', lineHeight: 1.45 }}>{text.subtitle}</p>
        </div>
        <span style={{ background: canAdd ? '#ECFDF5' : '#FFF5F5', color: canAdd ? '#047857' : '#E24B4A', border: `1px solid ${canAdd ? '#A7F3D0' : '#FECACA'}`, borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
          {text.count(count, limit)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <label style={{ ...buttonBase, background: canAdd && !busy ? '#FFF5F5' : '#F3F4F6', color: canAdd && !busy ? '#E24B4A' : '#9CA3AF', border: `1px solid ${canAdd && !busy ? '#FECACA' : '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: canAdd && !busy ? 'pointer' : 'default' }}>
          <HubbingIcon name="camera" size={16} color={canAdd && !busy ? '#E24B4A' : '#9CA3AF'} />
          {busy ? text.uploading : text.takePhoto}
          <input type="file" accept="image/*,.heic,.heif" capture="environment" onChange={handleAdd} disabled={!canAdd || busy}
            style={{ display: 'none' }} />
        </label>
        <label style={{ ...buttonBase, background: canAdd && !busy ? 'white' : '#F3F4F6', color: canAdd && !busy ? '#374151' : '#9CA3AF', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: canAdd && !busy ? 'pointer' : 'default' }}>
          <HubbingIcon name="paperclip" size={16} color={canAdd && !busy ? '#374151' : '#9CA3AF'} />
          {text.importPhoto}
          <input type="file" accept="image/*,.heic,.heif" multiple onChange={handleAdd} disabled={!canAdd || busy}
            style={{ display: 'none' }} />
        </label>
      </div>

      {notice && (
        <p style={{ fontSize: 12, fontWeight: 800, margin: 0, color: notice.type === 'error' ? '#E24B4A' : notice.type === 'success' ? '#047857' : '#6B7280' }}>
          {notice.message}
        </p>
      )}

      {count === 0 ? (
        <div style={{ border: '1px dashed #D1D5DB', borderRadius: 12, padding: '1rem', textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontWeight: 700 }}>
          {text.empty}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {realizations.map((item, index) => {
            const src = imageFor(item)
            const itemBusy = busyId === item.id
            return (
              <article key={item.id} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" onClick={() => setViewerIndex(index)}
                  style={{ width: '100%', aspectRatio: '1', border: 'none', borderRadius: 9, overflow: 'hidden', padding: 0, background: '#E5E7EB', cursor: 'zoom-in' }}>
                  {src ? (
                    <img src={src} alt="" draggable={false} onContextMenu={event => event.preventDefault()}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <span style={{ color: '#6B7280', fontSize: 12, fontWeight: 900 }}>IMG</span>
                  )}
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <label style={{ ...buttonBase, position: 'relative', overflow: 'hidden', padding: '8px 6px', fontSize: 11, textAlign: 'center', background: '#F8FAFC', color: '#334155', border: '1px solid #E2E8F0', pointerEvents: itemBusy ? 'none' : 'auto' }}>
                    {itemBusy ? text.replacing : text.replace}
                    <input type="file" accept="image/*,.heic,.heif" onChange={event => handleReplace(event, item, index)} disabled={itemBusy}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: itemBusy ? 'default' : 'pointer' }} />
                  </label>
                  <button type="button" onClick={() => handleDelete(item)} disabled={itemBusy}
                    style={{ ...buttonBase, padding: '8px 6px', fontSize: 11, background: '#FFF5F5', color: '#E24B4A', border: '1px solid #FECACA', opacity: itemBusy ? 0.65 : 1 }}>
                    {text.delete}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {viewerIndex !== null && (
        <CompanyRealizationsModal
          realizations={realizations}
          initialIndex={viewerIndex}
          ui={ui}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </section>
  )
}

export function CompanyRealizationsGallery({ realizations = [], ui, compact = false, previewCount = 6, showEmpty = false, style }) {
  const text = getText(ui)
  const [viewerIndex, setViewerIndex] = useState(null)
  const photos = useMemo(() => realizations.filter(item => imageFor(item)), [realizations])
  if (!photos.length && !showEmpty) return null

  const openViewer = (index, event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!photos.length) return
    setViewerIndex(index)
  }

  const wrapperStyle = compact
    ? { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 10, marginBottom: '0.5rem' }
    : { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '1rem', boxShadow: '0 1px 8px rgba(15,23,42,0.04)' }

  return (
    <section onPointerDown={stopSwipeGesture} onTouchStart={stopSwipeGesture} style={{ ...wrapperStyle, ...style }}>
      <button type="button" onClick={event => openViewer(0, event)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: 'none', background: 'transparent', padding: 0, cursor: photos.length ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'Plus Jakarta Sans' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: compact ? 12 : 14, color: compact ? '#334155' : '#111827', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HubbingIcon name="sparkles" size={compact ? 14 : 16} color="#E24B4A" />
            {text.title}
          </p>
          <p style={{ fontSize: compact ? 10 : 12, color: '#6B7280', margin: '3px 0 0' }}>
            {photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} · ${text.open}` : (text.emptyPublic || 'Rien à afficher pour le moment.')}
          </p>
        </div>
        {photos.length > 0 && <span aria-hidden="true" style={{ color: '#E24B4A', fontSize: 18, fontWeight: 900 }}>›</span>}
      </button>
      {photos.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: compact ? 5 : 7, marginTop: compact ? 8 : 12 }}>
        {photos.slice(0, previewCount).map((item, index) => (
          <button key={item.id} type="button" onClick={event => openViewer(index, event)}
            style={{ position: 'relative', aspectRatio: '1', border: 'none', borderRadius: compact ? 8 : 10, overflow: 'hidden', background: '#E5E7EB', padding: 0, cursor: 'zoom-in' }}>
            <img src={imageFor(item)} alt="" draggable={false} onContextMenu={event => event.preventDefault()}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {index === previewCount - 1 && photos.length > previewCount && (
              <span style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.62)', color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                +{photos.length - previewCount}
              </span>
            )}
          </button>
        ))}
      </div>}
      {viewerIndex !== null && (
        <CompanyRealizationsModal
          realizations={photos}
          initialIndex={viewerIndex}
          ui={ui}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </section>
  )
}

export function CompanyRealizationsModal({ realizations = [], initialIndex = 0, onClose, ui }) {
  const text = getText(ui)
  const [index, setIndex] = useState(initialIndex)
  const count = realizations.length
  const current = realizations[index] || realizations[0]
  const src = imageFor(current)

  useEffect(() => {
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(0, count - 1)))
  }, [initialIndex, count])

  useEffect(() => {
    const unlock = lockBodyScroll()
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
      if (event.key === 'ArrowLeft') setIndex(currentIndex => Math.max(0, currentIndex - 1))
      if (event.key === 'ArrowRight') setIndex(currentIndex => Math.min(count - 1, currentIndex + 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unlock()
    }
  }, [count, onClose])

  if (typeof document === 'undefined' || !current) return null

  return createPortal((
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(2,6,23,0.94)', display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 12px)' }}>
      <div onClick={event => event.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'white', flexShrink: 0, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{text.title}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', margin: '2px 0 0' }}>{index + 1} / {count}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={text.close}
          style={{ minWidth: 42, height: 42, borderRadius: 999, border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 12px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 900 }}>
          <HubbingIcon name="x" size={18} color="white" />
          {text.close}
        </button>
      </div>

      <div onClick={event => event.stopPropagation()}
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {count > 1 && (
          <button type="button" onClick={() => setIndex(currentIndex => Math.max(0, currentIndex - 1))} disabled={index === 0} aria-label={text.previous}
            style={{ position: 'absolute', left: 0, width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 24, fontWeight: 900, cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.35 : 1, zIndex: 2 }}>
            ‹
          </button>
        )}
        {src ? (
          <img src={src} alt="" draggable={false} onContextMenu={event => event.preventDefault()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 18px 70px rgba(0,0,0,0.5)', userSelect: 'none' }} />
        ) : (
          <div style={{ color: 'white', fontSize: 14, fontWeight: 900 }}>IMG</div>
        )}
        {count > 1 && (
          <button type="button" onClick={() => setIndex(currentIndex => Math.min(count - 1, currentIndex + 1))} disabled={index >= count - 1} aria-label={text.next}
            style={{ position: 'absolute', right: 0, width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 24, fontWeight: 900, cursor: index >= count - 1 ? 'default' : 'pointer', opacity: index >= count - 1 ? 0.35 : 1, zIndex: 2 }}>
            ›
          </button>
        )}
      </div>

      {count > 1 && (
        <div onClick={event => event.stopPropagation()}
          style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 10, flexShrink: 0, WebkitOverflowScrolling: 'touch' }}>
          {realizations.map((item, itemIndex) => (
            <button key={item.id || itemIndex} type="button" onClick={() => setIndex(itemIndex)}
              style={{ width: 58, height: 58, borderRadius: 10, border: itemIndex === index ? '2px solid white' : '1px solid rgba(255,255,255,0.25)', padding: 0, overflow: 'hidden', background: '#111827', flex: '0 0 auto', cursor: 'pointer' }}>
              {imageFor(item) && (
                <img src={imageFor(item)} alt="" draggable={false} onContextMenu={event => event.preventDefault()}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: itemIndex === index ? 1 : 0.65 }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  ), document.body)
}
