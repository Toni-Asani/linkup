import { useEffect, useMemo, useState } from 'react'
import { HubbingIcon } from './icons'
import {
  createNeedAttachmentSignedUrl,
  deleteNeedAttachment,
  formatFileSize,
  getNeedAttachmentPolicy,
  uploadNeedAttachment,
} from './needAttachments'

const fallbackNeedAttachmentText = {
  attachmentsTitle: 'Pièces jointes du besoin',
  cloudTitle: 'Cloud Hubbing privé',
  cloudDescription: plan => plan === 'Premium'
    ? 'Votre espace privé : retrouvez tous vos fichiers attachés aux besoins. Personne d’autre ne peut consulter ce cloud.'
    : 'Votre espace privé : retrouvez vos fichiers attachés aux besoins. Personne d’autre ne peut consulter ce cloud. Le téléchargement complet des documents est réservé au plan Premium.',
  emptyCloud: 'Aucun fichier ajouté pour le moment.',
  openCloud: 'Ouvrir le cloud',
  cloudHint: 'Galerie privée de vos pièces jointes',
  allFiles: 'Tous les fichiers',
  close: 'Fermer',
  previewUnavailable: 'Aperçu indisponible',
  fileCount: count => `${count} fichier${count > 1 ? 's' : ''}`,
  policyLine: plan => plan === 'Premium'
    ? 'Premium : jusqu’à 15 fichiers par besoin, photos ou PDF. Photos 10 MB, PDF 50 MB.'
    : plan === 'Basic'
      ? 'Basic : jusqu’à 5 photos par besoin, 10 MB par photo.'
      : 'Starter : 1 photo par besoin, 10 MB max.',
  takePhoto: 'Prendre une photo',
  importFile: 'Importer',
  uploading: 'Envoi...',
  open: 'Ouvrir',
  download: 'Télécharger',
  report: 'Signaler',
  delete: 'Supprimer',
  deleting: 'Suppression...',
  confirmDelete: 'Supprimer cette pièce jointe ?',
  deleteError: 'Suppression impossible.',
  uploadError: "Erreur lors de l'envoi du fichier.",
}

const getNeedAttachmentText = ui => ui?.needAttachments || fallbackNeedAttachmentText

const cardStyle = {
  background: 'white',
  border: '1px solid #eee',
  borderRadius: 12,
  padding: '0.75rem',
}

const buttonBase = {
  border: 'none',
  borderRadius: 9,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'Plus Jakarta Sans',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

export function NeedAttachmentUploader({ company, plan, needKey, needLabel, attachments = [], onChange, ui }) {
  const [uploading, setUploading] = useState(false)
  const policy = useMemo(() => getNeedAttachmentPolicy(plan), [plan])
  const text = getNeedAttachmentText(ui)
  const isFull = attachments.length >= policy.maxFiles

  const handleFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading) return
    setUploading(true)
    try {
      await uploadNeedAttachment({
        file,
        company,
        plan,
        needKey,
        needLabel,
        currentCount: attachments.length,
        ui,
      })
      await onChange?.()
    } catch (error) {
      alert(error?.message || text.uploadError)
    }
    setUploading(false)
  }

  return (
    <div style={{ ...cardStyle, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <HubbingIcon name="paperclip" size={16} color="#E24B4A" />
          <p style={{ fontSize: 13, fontWeight: 800, color: '#333', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {text.attachmentsTitle}
          </p>
        </div>
        <span style={{ fontSize: 11, color: isFull ? '#E24B4A' : '#777', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {attachments.length}/{policy.maxFiles}
        </span>
      </div>
      <p style={{ fontSize: 11, color: '#777', lineHeight: 1.45, margin: '0 0 10px' }}>
        {text.policyLine(policy.plan)}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: attachments.length ? 10 : 0 }}>
        <label style={{ ...buttonBase, background: isFull ? '#f1f1f1' : '#FFF5F5', color: isFull ? '#999' : '#E24B4A', border: '1px solid #FECACA', cursor: isFull ? 'default' : 'pointer' }}>
          <HubbingIcon name="camera" size={15} color={isFull ? '#999' : '#E24B4A'} />
          {uploading ? text.uploading : text.takePhoto}
          <input type="file" accept="image/*" capture="environment" disabled={isFull || uploading} onChange={handleFile} style={{ display: 'none' }} />
        </label>
        <label style={{ ...buttonBase, background: isFull ? '#f1f1f1' : '#f8fafc', color: isFull ? '#999' : '#4B5563', border: '1px solid #e5e7eb', cursor: isFull ? 'default' : 'pointer' }}>
          <HubbingIcon name="paperclip" size={15} color={isFull ? '#999' : '#4B5563'} />
          {text.importFile}
          <input type="file" accept={policy.accept} disabled={isFull || uploading} onChange={handleFile} style={{ display: 'none' }} />
        </label>
      </div>
      {attachments.length > 0 && (
        <NeedAttachmentList
          attachments={attachments}
          ui={ui}
          canDelete
          canDownload={policy.plan === 'Premium'}
          onDelete={async attachment => {
            await deleteNeedAttachment(attachment)
            await onChange?.()
          }}
        />
      )}
    </div>
  )
}

export function NeedAttachmentCloud({ plan, attachments = [], onChange, ui }) {
  const policy = useMemo(() => getNeedAttachmentPolicy(plan), [plan])
  const text = getNeedAttachmentText(ui)
  const [isOpen, setIsOpen] = useState(false)
  const canDownload = policy.plan === 'Premium'
  const countLabel = text.fileCount ? text.fileCount(attachments.length) : `${attachments.length} fichier${attachments.length > 1 ? 's' : ''}`

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}
        style={{
          width: '100%',
          border: '1px solid #F5B5B5',
          background: 'linear-gradient(135deg, #fff 0%, #fff7f5 100%)',
          borderRadius: 14,
          padding: '0.95rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans',
          textAlign: 'left',
          boxShadow: '0 8px 24px rgba(226,75,74,0.10)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: '#E24B4A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HubbingIcon name="paperclip" size={20} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, color: '#222', fontWeight: 900, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {text.cloudTitle}
            </p>
            <p style={{ fontSize: 11, color: '#777', fontWeight: 600, margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {text.cloudHint || text.cloudDescription(policy.plan)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#E24B4A', fontWeight: 900, background: '#FFF1F1', border: '1px solid #FECACA', borderRadius: 999, padding: '5px 8px' }}>
            {attachments.length}
          </span>
          <span style={{ fontSize: 12, color: '#E24B4A', fontWeight: 900 }}>{text.openCloud}</span>
        </div>
      </button>
      {isOpen && (
        <NeedAttachmentCloudPage
          plan={policy.plan}
          attachments={attachments}
          ui={ui}
          countLabel={countLabel}
          canDownload={canDownload}
          onClose={() => setIsOpen(false)}
          onDelete={async attachment => {
            await deleteNeedAttachment(attachment)
            await onChange?.()
          }}
        />
      )}
    </>
  )
}

export function NeedAttachmentGallery({ attachments = [], ui, canDownload = false, onReport }) {
  if (!attachments.length) return null
  return (
    <div style={{ marginTop: 8 }}>
      <NeedAttachmentList
        attachments={attachments}
        ui={ui}
        canDownload={canDownload}
        onReport={onReport}
        compact
      />
    </div>
  )
}

function NeedAttachmentCloudPage({ plan, attachments, ui, countLabel, canDownload, onClose, onDelete }) {
  const text = getNeedAttachmentText(ui)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleDelete = async attachment => {
    await onDelete?.(attachment)
    setPreview(null)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={text.cloudTitle}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 460,
        background: '#fffaf7',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        fontFamily: 'Plus Jakarta Sans',
      }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(226,75,74,0.16)',
        padding: 'calc(env(safe-area-inset-top) + 12px) 18px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" onClick={onClose} aria-label={text.close}
            style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <HubbingIcon name="x" size={18} color="#4B5563" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 900, color: '#222', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {text.cloudTitle}
            </p>
            <p style={{ fontSize: 11, color: '#777', fontWeight: 700, margin: '3px 0 0' }}>
              {text.allFiles || 'Tous les fichiers'} · {countLabel}
            </p>
          </div>
          <span style={{ background: '#E24B4A', color: '#fff', fontWeight: 900, fontSize: 12, borderRadius: 999, padding: '7px 10px', whiteSpace: 'nowrap' }}>
            {plan}
          </span>
        </div>
      </div>

      <div style={{ padding: '18px 18px calc(env(safe-area-inset-bottom) + 28px)', maxWidth: 980, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(226,75,74,0.12), rgba(245,141,91,0.16))',
          border: '1px solid rgba(226,75,74,0.14)',
          borderRadius: 20,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <HubbingIcon name="lock" size={18} color="#E24B4A" />
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: '#6b4c4c', fontWeight: 700 }}>
            {text.cloudDescription(plan)}
          </p>
        </div>

        {attachments.length ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 14,
          }}>
            {attachments.map(attachment => (
              <NeedAttachmentCloudTile
                key={attachment.id}
                attachment={attachment}
                ui={ui}
                onOpen={setPreview}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div style={{ minHeight: 320, borderRadius: 24, border: '1px dashed #F3B8B8', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#999', fontSize: 14, fontWeight: 700 }}>{text.emptyCloud}</p>
          </div>
        )}
      </div>

      {preview && (
        <NeedAttachmentPreview
          item={preview}
          ui={ui}
          canDownload={canDownload}
          onClose={() => setPreview(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function NeedAttachmentCloudTile({ attachment, ui, onOpen, onDelete }) {
  const text = getNeedAttachmentText(ui)
  const [signedUrl, setSignedUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const isImage = attachment.file_type === 'image'

  useEffect(() => {
    let mounted = true
    createNeedAttachmentSignedUrl(attachment.storage_path)
      .then(url => { if (mounted) setSignedUrl(url) })
      .catch(() => { if (mounted) setSignedUrl(null) })
    return () => { mounted = false }
  }, [attachment.storage_path])

  const deleteFile = async event => {
    event.stopPropagation()
    if (!window.confirm(text.confirmDelete)) return
    setBusy(true)
    try {
      await onDelete?.(attachment)
    } catch (error) {
      alert(error?.message || text.deleteError)
      setBusy(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(226,75,74,0.14)', borderRadius: 18, padding: 8, boxShadow: '0 10px 24px rgba(31,41,55,0.08)', minWidth: 0 }}>
      <button type="button" onClick={() => signedUrl && onOpen({ attachment, signedUrl })}
        disabled={!signedUrl}
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 15,
          border: 'none',
          background: isImage ? '#f3f4f6' : 'linear-gradient(135deg, #FFF5F5, #F8FAFC)',
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          cursor: signedUrl ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {isImage && signedUrl ? (
          <img src={signedUrl} alt={attachment.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: attachment.file_type === 'pdf' ? '#E24B4A' : '#4B5563', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, margin: '0 auto 10px' }}>
              {attachment.file_type === 'pdf' ? 'PDF' : 'FILE'}
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#777' }}>{signedUrl ? text.open : text.previewUnavailable}</span>
          </div>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.56)', color: '#fff', borderRadius: 999, padding: '4px 7px', fontSize: 9, fontWeight: 900 }}>
          {attachment.file_type === 'pdf' ? 'PDF' : 'PHOTO'}
        </span>
      </button>
      <div style={{ padding: '8px 2px 2px', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#222', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {attachment.file_name}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 10, color: '#999', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatFileSize(attachment.file_size)}
          {attachment.need_label ? ` · ${attachment.need_label}` : ''}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 7 }}>
          <button type="button" onClick={deleteFile} disabled={busy}
            style={{ ...buttonBase, padding: '6px 8px', fontSize: 10, background: '#FFF5F5', color: '#E24B4A', border: '1px solid #FECACA' }}>
            {busy ? text.deleting : text.delete}
          </button>
        </div>
      </div>
    </div>
  )
}

function NeedAttachmentPreview({ item, ui, canDownload, onClose, onDelete }) {
  const text = getNeedAttachmentText(ui)
  const { attachment, signedUrl } = item
  const [busy, setBusy] = useState(false)
  const isImage = attachment.file_type === 'image'
  const isPdf = attachment.file_type === 'pdf'

  const deleteFile = async () => {
    if (!window.confirm(text.confirmDelete)) return
    setBusy(true)
    try {
      await onDelete?.(attachment)
    } catch (error) {
      alert(error?.message || text.deleteError)
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={attachment.file_name}
      style={{ position: 'fixed', inset: 0, zIndex: 520, background: 'rgba(17,24,39,0.88)', display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 14px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attachment.file_name}</p>
          <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 700 }}>{formatFileSize(attachment.file_size)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={text.close}
          style={{ width: 40, height: 40, borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <HubbingIcon name="x" size={20} color="#fff" />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 20, background: 'rgba(255,255,255,0.06)' }}>
        {isImage ? (
          <img src={signedUrl} alt={attachment.file_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : isPdf ? (
          <iframe src={signedUrl} title={attachment.file_name} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#fff', padding: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: '#fff', color: '#E24B4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, margin: '0 auto 12px' }}>FILE</div>
            <p style={{ margin: 0, fontWeight: 800 }}>{text.previewUnavailable}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 12 }}>
        <button type="button" onClick={() => window.open(signedUrl, '_blank', 'noopener,noreferrer')}
          style={{ ...buttonBase, background: '#fff', color: '#222', border: '1px solid rgba(255,255,255,0.18)', padding: '10px 14px', fontSize: 12 }}>
          {text.open}
        </button>
        {canDownload && (
          <a href={signedUrl} download={attachment.file_name}
            style={{ ...buttonBase, background: '#ECFDF5', color: '#047857', border: '1px solid #BBF7D0', textDecoration: 'none', padding: '10px 14px', fontSize: 12 }}>
            {text.download}
          </a>
        )}
        <button type="button" onClick={deleteFile} disabled={busy}
          style={{ ...buttonBase, background: '#FFF5F5', color: '#E24B4A', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 12 }}>
          {busy ? text.deleting : text.delete}
        </button>
      </div>
    </div>
  )
}

function NeedAttachmentList({ attachments, ui, canDelete = false, canDownload = false, onDelete, onReport, compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {attachments.map(attachment => (
        <NeedAttachmentItem
          key={attachment.id}
          attachment={attachment}
          ui={ui}
          canDelete={canDelete}
          canDownload={canDownload}
          onDelete={onDelete}
          onReport={onReport}
          compact={compact}
        />
      ))}
    </div>
  )
}

function NeedAttachmentItem({ attachment, ui, canDelete, canDownload, onDelete, onReport, compact }) {
  const text = getNeedAttachmentText(ui)
  const [signedUrl, setSignedUrl] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    createNeedAttachmentSignedUrl(attachment.storage_path)
      .then(url => { if (mounted) setSignedUrl(url) })
      .catch(() => { if (mounted) setSignedUrl(null) })
    return () => { mounted = false }
  }, [attachment.storage_path])

  const openFile = () => {
    if (signedUrl) window.open(signedUrl, '_blank', 'noopener,noreferrer')
  }

  const deleteFile = async () => {
    if (!window.confirm(text.confirmDelete)) return
    setBusy(true)
    try {
      await onDelete?.(attachment)
    } catch (error) {
      alert(error?.message || text.deleteError)
      setBusy(false)
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '42px minmax(0, 1fr)' : '48px minmax(0, 1fr)',
      gap: 10,
      alignItems: 'center',
      background: compact ? 'rgba(255,255,255,0.72)' : '#fff',
      border: '1px solid #eee',
      borderRadius: 10,
      padding: compact ? '7px 8px' : '8px',
    }}>
      <button onClick={openFile} disabled={!signedUrl}
        style={{ width: compact ? 42 : 48, height: compact ? 42 : 48, borderRadius: 9, border: 'none', background: '#f3f4f6', padding: 0, overflow: 'hidden', cursor: signedUrl ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {attachment.file_type === 'image' && signedUrl ? (
          <img src={signedUrl} alt={attachment.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 11, fontWeight: 800, color: attachment.file_type === 'pdf' ? '#E24B4A' : '#4B5563' }}>
            {attachment.file_type === 'pdf' ? 'PDF' : 'IMG'}
          </span>
        )}
      </button>
      <div style={{ minWidth: 0 }}>
        <button onClick={openFile} disabled={!signedUrl}
          style={{ background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#333', cursor: signedUrl ? 'pointer' : 'default', fontFamily: 'Plus Jakarta Sans', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {attachment.file_name}
        </button>
        <p style={{ fontSize: 10, color: '#999', margin: '2px 0 0' }}>
          {formatFileSize(attachment.file_size)}
          {attachment.need_label ? ` · ${attachment.need_label}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 5 }}>
          <button onClick={openFile} disabled={!signedUrl}
            style={{ ...buttonBase, padding: '5px 8px', fontSize: 10, background: '#f8fafc', color: '#4B5563', border: '1px solid #e5e7eb', cursor: signedUrl ? 'pointer' : 'default' }}>
            {text.open}
          </button>
          {canDownload && signedUrl && (
            <a href={signedUrl} download={attachment.file_name}
              style={{ ...buttonBase, padding: '5px 8px', fontSize: 10, background: '#ECFDF5', color: '#047857', border: '1px solid #BBF7D0', textDecoration: 'none' }}>
              {text.download}
            </a>
          )}
          {onReport && (
            <button onClick={() => onReport(attachment)}
              style={{ ...buttonBase, padding: '5px 8px', fontSize: 10, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
              {text.report}
            </button>
          )}
          {canDelete && (
            <button onClick={deleteFile} disabled={busy}
              style={{ ...buttonBase, padding: '5px 8px', fontSize: 10, background: '#FFF5F5', color: '#E24B4A', border: '1px solid #FECACA' }}>
              {busy ? text.deleting : text.delete}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
