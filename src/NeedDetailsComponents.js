import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HubbingIcon } from './icons'
import { NeedAttachmentGallery } from './NeedAttachmentComponents'

const fallbackText = {
  title: 'Détails du besoin',
  publishedOn: 'Publié le',
  startsOn: 'Date de début',
  endsOn: 'Échéance',
  photos: 'PHOTOS ET DOCUMENTS',
  noPhotos: 'Aucune photo jointe à ce besoin.',
  loadingPhotos: 'Chargement des photos...',
  contact: 'Contacter par message',
  contacting: 'Ouverture...',
  ownNeed: 'Ceci est votre propre besoin.',
  information: 'Informations sur le besoin',
}

const textFor = ui => ({ ...fallbackText, ...(ui?.needDetails || {}) })

const rawLabel = need => String(need?.label || need?.description || '').trim()

export const needFromGeneral = company => {
  const label = String(company?.needs_description || '').trim()
  if (!label) return null
  return {
    key: 'general',
    label,
    description: label,
    publishedAt: company?.needs_updated_at || company?.updated_at || company?.created_at || null,
  }
}

export const needFromTag = (tag, key) => {
  const label = String(typeof tag === 'string' ? tag : tag?.label || '').trim()
  if (!label) return null
  return {
    key,
    label,
    description: String(typeof tag === 'string' ? tag : tag?.description || label).trim(),
    starts: typeof tag === 'string' ? null : tag?.starts || null,
    expires: typeof tag === 'string' ? null : tag?.expires || null,
  }
}

export function NeedSummaryButton({ need, onClick, compact = false, color = '#E67E22' }) {
  if (!need || !rawLabel(need)) return null
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={event => event.stopPropagation()}
      onTouchStart={event => event.stopPropagation()}
      aria-label={`${fallbackText.information} : ${rawLabel(need)}`}
      style={{
        width: '100%',
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 28px',
        alignItems: 'center',
        gap: 8,
        background: 'white',
        border: `1px solid ${color}42`,
        borderRadius: compact ? 9 : 11,
        padding: compact ? '6px 7px 6px 9px' : '9px 9px 9px 11px',
        color: '#334155',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'Plus Jakarta Sans',
      }}>
      <span style={{ minWidth: 0, fontSize: compact ? 11 : 13, fontWeight: 650, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: 'vertical' }}>
        {rawLabel(need)}
      </span>
      <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}16`, color, border: `1px solid ${color}52`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 900, fontStyle: 'italic' }}>
        i
      </span>
    </button>
  )
}

export function NeedDetailsModal({
  need,
  company,
  attachments = [],
  loadingAttachments = false,
  ui,
  lang = 'fr',
  onClose,
  onContact,
  contacting = false,
  ownNeed = false,
  onReportAttachment,
}) {
  const text = textFor(ui)

  useEffect(() => {
    if (!need || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [need, onClose])

  if (!need || typeof document === 'undefined') return null

  const locale = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-CH' }[lang] || 'fr-CH'
  const formatDate = value => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const dates = [
    need.publishedAt && { label: text.publishedOn, value: formatDate(need.publishedAt) },
    need.starts && { label: text.startsOn, value: formatDate(need.starts) },
    need.expires && { label: text.endsOn, value: formatDate(need.expires) },
  ].filter(item => item?.value)

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={text.title}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 50000, background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top) + 12px) 10px calc(env(safe-area-inset-bottom) + 12px)' }}>
      <section
        onMouseDown={event => event.stopPropagation()}
        style={{ width: '100%', maxWidth: 430, maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)', minHeight: 0, background: 'white', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,0.34)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 15px', borderBottom: '1px solid #F1F5F9', background: 'rgba(255,255,255,0.96)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, color: '#111827', fontWeight: 900 }}>{text.title}</p>
            {company?.name && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company.name}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={ui?.common?.close || 'Fermer'}
            style={{ minWidth: 40, height: 40, borderRadius: 999, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 11px', fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
            <HubbingIcon name="x" size={17} color="#475569" />
            {ui?.common?.close || 'Fermer'}
          </button>
        </header>

        <div className="need-details-scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '16px 15px 18px' }}>
          <div style={{ background: '#FFF9F0', border: '1px solid #FDE8C0', borderRadius: 14, padding: '13px 14px' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#334155', fontWeight: 750, lineHeight: 1.55, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
              {need.description || need.label}
            </p>
          </div>

          {dates.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: dates.length > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 8, marginTop: 12 }}>
              {dates.map(item => (
                <div key={item.label} style={{ minWidth: 0, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 11, padding: '9px 10px' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 10, color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#334155', fontWeight: 800 }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#E67E22', fontWeight: 900 }}>{text.photos}</p>
            {loadingAttachments ? (
              <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 12, padding: 16, textAlign: 'center', color: '#64748B', fontSize: 12, fontWeight: 700 }}>{text.loadingPhotos}</div>
            ) : attachments.length > 0 ? (
              <NeedAttachmentGallery attachments={attachments} ui={ui} onReport={onReportAttachment} />
            ) : (
              <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 12, padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>{text.noPhotos}</div>
            )}
          </div>
        </div>

        <footer style={{ flexShrink: 0, padding: '12px 15px', borderTop: '1px solid #F1F5F9', background: 'white', boxShadow: '0 -10px 24px rgba(15,23,42,0.05)' }}>
          {ownNeed ? (
            <p style={{ margin: 0, textAlign: 'center', color: '#64748B', fontSize: 12, fontWeight: 750 }}>{text.ownNeed}</p>
          ) : (
            <button type="button" onClick={onContact} disabled={contacting}
              style={{ width: '100%', padding: '13px 14px', border: 'none', borderRadius: 11, background: '#E24B4A', color: 'white', fontSize: 14, fontWeight: 900, cursor: contacting ? 'default' : 'pointer', opacity: contacting ? 0.7 : 1, fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <HubbingIcon name="messages" size={18} color="white" />
              {contacting ? text.contacting : text.contact}
            </button>
          )}
        </footer>
      </section>
    </div>
  )

  return createPortal(dialog, document.body)
}
