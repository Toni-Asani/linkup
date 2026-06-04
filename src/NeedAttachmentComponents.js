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

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <HubbingIcon name="paperclip" size={16} color="#185FA5" />
          <p style={{ fontSize: 12, color: '#185FA5', fontWeight: 800, margin: 0 }}>{text.cloudTitle}</p>
        </div>
        <span style={{ fontSize: 11, color: '#777', fontWeight: 700 }}>{attachments.length}</span>
      </div>
      <p style={{ fontSize: 12, color: '#666', lineHeight: 1.5, margin: '0 0 10px' }}>
        {text.cloudDescription(policy.plan)}
      </p>
      {attachments.length ? (
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
      ) : (
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>{text.emptyCloud}</p>
      )}
    </div>
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
