import { useEffect, useState } from 'react'
import { Eye, X } from 'lucide-react'
import { VerifiedBadge, getCompanyBadgeVariant } from './VerifiedBadge'
import { HubbingIcon } from './icons'
import { sanitizeDirectContactInfo } from './moderation'
import { ServiceTagsPills } from './ServiceTagsComponents'
import { CompanyRealizationsGallery } from './CompanyRealizationsComponents'
import { groupNeedAttachments, needKeyForTag } from './needAttachments'
import { NeedDetailsModal, NeedSummaryButton, needFromGeneral, needFromTag } from './NeedDetailsComponents'

const getActiveNeeds = value => {
  try {
    const tags = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(tags)) return []
    return tags.filter(tag => !tag?.expires || new Date(tag.expires) > new Date())
  } catch {
    return []
  }
}

export default function CompanySwipeCardPreview({ company, realizations = [], needAttachments = [], color = '#E24B4A', ui, lang = 'fr', onClose }) {
  const activeNeeds = getActiveNeeds(company?.needs_tags)
  const hasNeeds = Boolean(company?.needs_description || activeNeeds.length)
  const groupedNeedAttachments = groupNeedAttachments(needAttachments)
  const [selectedNeed, setSelectedNeed] = useState(null)
  const badgeVariant = getCompanyBadgeVariant(company)
  const text = ui?.profile || {}
  const headerBackground = company?.background_url
    ? {
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.42)), url(${company.background_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: color }

  useEffect(() => {
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
  }, [onClose])

  if (!company) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={text.previewTitle || 'Aperçu de votre carte Swipe'}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
      style={{ position: 'fixed', top: 'calc(56px + env(safe-area-inset-top))', left: 0, right: 0, bottom: 'calc(60px + env(safe-area-inset-bottom))', zIndex: 3000, boxSizing: 'border-box', overflow: 'hidden', background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(5px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 14px 14px' }}>
      {selectedNeed && (
        <NeedDetailsModal
          need={selectedNeed}
          company={company}
          attachments={groupedNeedAttachments[selectedNeed.key] || []}
          ui={ui}
          lang={lang}
          ownNeed
          onClose={() => setSelectedNeed(null)}
        />
      )}
      <button type="button" onClick={onClose}
        style={{ position: 'absolute', top: 10, right: 14, zIndex: 5, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, background: 'white', color: '#334155', border: '1px solid #E2E8F0', borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 850, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans', boxShadow: '0 6px 18px rgba(15,23,42,0.18)' }}>
        <X size={15} strokeWidth={2.5} />
        {ui?.common?.close || 'Fermer'}
      </button>
      <div style={{ width: 'min(100%, 410px)', flex: '1 1 auto', maxHeight: 760, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'white', padding: '0 100px 0 2px', minHeight: 36 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>{text.previewTitle || 'Aperçu de votre carte Swipe'}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{text.previewHelp || 'Voici ce que les autres entreprises voient.'}</p>
          </div>
        </div>

        <article
          className="company-card-preview-scroll"
          style={{ flex: '1 1 0', minHeight: 0, overflowY: 'scroll', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y', scrollbarGutter: 'stable', background: 'white', borderRadius: 20, border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 24px 70px rgba(15,23,42,0.35)' }}>
          <div style={{ height: 112, ...headerBackground, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {company.logo_url ? (
              <img src={company.logo_url} alt="" style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: '3px solid white', boxShadow: '0 8px 24px rgba(15,23,42,0.22)' }} />
            ) : (
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(255,255,255,0.9)' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: 23 }}>{String(company.name || 'HU').slice(0, 2).toUpperCase()}</span>
              </div>
            )}
            <span style={{ position: 'absolute', left: 12, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(15,23,42,0.54)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: '5px 9px', fontSize: 10, fontWeight: 800 }}>
              <Eye size={12} /> {text.previewBadge || 'APERÇU'}
            </span>
          </div>

          <div style={{ padding: '0.9rem 1rem 1rem' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>{company.name}</span>
              {badgeVariant && <VerifiedBadge size={18} variant={badgeVariant} />}
            </h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: '0.65rem', flexWrap: 'wrap' }}>
              {company.sector && <span style={{ background: `${color}15`, color, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{company.sector}</span>}
              {(company.city || company.canton) && (
                <span style={{ background: '#F1F5F9', color: '#64748B', padding: '3px 8px', borderRadius: 20, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <HubbingIcon name="mapPin" size={12} color="#64748B" />
                  {[company.city, company.canton].filter(Boolean).join(', ')}
                </span>
              )}
            </div>

            <div style={{ marginBottom: company.description || hasNeeds ? '0.7rem' : 0 }}>
              <ServiceTagsPills value={company.service_tags} maxVisible={4} color={color} />
            </div>

            {company.description && (
              <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.5, margin: hasNeeds ? '0 0 0.7rem' : 0, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                {sanitizeDirectContactInfo(company.description)}
              </p>
            )}

            {hasNeeds && (
              <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:'0.7rem'}}>
                {company.needs_description && (
                  <div style={{background:'#F5F8FF',border:'1px solid #D9E5FF',borderRadius:10,padding:'9px 10px'}}>
                    <p style={{fontSize:10,color:'#2563EB',fontWeight:850,margin:'0 0 5px'}}>∞ {ui?.profile?.needs || 'RECHERCHE PERMANENTE'}</p>
                    <NeedSummaryButton
                      need={needFromGeneral(company)}
                      compact
                      color="#2563EB"
                      onClick={() => setSelectedNeed(needFromGeneral(company))}
                    />
                  </div>
                )}
                {activeNeeds.length > 0 && (
                  <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:10,padding:'9px 10px',display:'flex',flexDirection:'column',gap:5}}>
                    <p style={{fontSize:10,color:'#E67E22',fontWeight:850,margin:'0 0 1px'}}>{ui?.profile?.punctualNeeds || ui?.swipe?.needs || 'BESOINS PONCTUELS'}</p>
                    {activeNeeds.map((tag, index) => (
                      <NeedSummaryButton
                        key={`${needKeyForTag(tag)}-${index}`}
                        need={needFromTag(tag, needKeyForTag(tag))}
                        compact
                        color="#E67E22"
                        onClick={() => setSelectedNeed(needFromTag(tag, needKeyForTag(tag)))}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <CompanyRealizationsGallery
              realizations={realizations}
              ui={ui}
              compact
              previewCount={3}
              showEmpty
              style={{ margin: 0 }}
            />
          </div>
        </article>
      </div>
    </div>
  )
}
