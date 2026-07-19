import { useState } from 'react'
import {
  MAX_SERVICE_TAGS,
  addServiceTag,
  formatServiceTag,
  parseServiceTags,
  serviceTagKey,
} from './serviceTags'

const fallbackText = {
  title: 'SERVICES PROPOSÉS',
  help: 'Ajoutez jusqu’à 10 services pour recevoir des besoins ciblés.',
  placeholder: 'Ex : Peinture, Jardinage, Comptabilité...',
  add: 'Ajouter',
  limit: `Maximum ${MAX_SERVICE_TAGS} services`,
}

export function ServiceTagsEditor({ value = [], onChange, text = fallbackText, compact = false }) {
  const tags = parseServiceTags(value)
  const [input, setInput] = useState('')
  const copy = { ...fallbackText, ...(text || {}) }
  const isFull = tags.length >= MAX_SERVICE_TAGS

  const add = () => {
    const next = addServiceTag(tags, input)
    if (next.length === tags.length) return
    onChange?.(next)
    setInput('')
  }

  const remove = tag => {
    const key = serviceTagKey(tag)
    onChange?.(tags.filter(item => serviceTagKey(item) !== key))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p style={{ fontSize: compact ? 11 : 12, color: '#E24B4A', fontWeight: 800, margin: 0 }}>{copy.title}</p>
        <span style={{ fontSize: 11, color: isFull ? '#E24B4A' : '#94A3B8', fontWeight: 800 }}>{tags.length}/{MAX_SERVICE_TAGS}</span>
      </div>
      <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.45, margin: 0 }}>{copy.help}</p>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => (
            <span key={serviceTagKey(tag)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FFF5F5', color: '#B4232A', border: '1px solid #F5B5B5', borderRadius: 7, padding: '5px 7px', fontSize: 11, fontWeight: 800 }}>
              {formatServiceTag(tag)}
              <button type="button" onClick={() => remove(tag)} aria-label={`Supprimer ${tag}`}
                style={{ width: 17, height: 17, border: 'none', borderRadius: 5, padding: 0, background: 'rgba(226,75,74,0.12)', color: '#B4232A', fontSize: 13, fontWeight: 900, lineHeight: 1, cursor: 'pointer' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 7 }}>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#E24B4A', fontWeight: 900, pointerEvents: 'none' }}>#</span>
          <input
            value={input}
            disabled={isFull}
            maxLength={MAX_SERVICE_TAGS * 4}
            onChange={event => setInput(event.target.value.replace(/^#+/, ''))}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                add()
              }
            }}
            placeholder={isFull ? copy.limit : copy.placeholder}
            style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: compact ? '10px 10px 10px 27px' : '12px 12px 12px 29px', border: '1px solid #D1D5DB', borderRadius: 9, background: isFull ? '#F8FAFC' : 'white', color: '#111827', fontSize: compact ? 12 : 14, outline: 'none', fontFamily: 'Plus Jakarta Sans' }}
          />
        </div>
        <button type="button" onClick={add} disabled={isFull || !input.trim()}
          style={{ padding: compact ? '9px 10px' : '11px 13px', border: 'none', borderRadius: 9, background: isFull || !input.trim() ? '#E5E7EB' : '#E24B4A', color: isFull || !input.trim() ? '#9CA3AF' : 'white', fontSize: 12, fontWeight: 800, cursor: isFull || !input.trim() ? 'default' : 'pointer', fontFamily: 'Plus Jakarta Sans' }}>
          {copy.add}
        </button>
      </div>
    </div>
  )
}

export function ServiceTagsPills({ value = [], maxVisible = 4, color = '#E24B4A', align = 'flex-start' }) {
  const tags = parseServiceTags(value)
  if (!tags.length) return null
  const visible = tags.slice(0, maxVisible)
  const hidden = Math.max(0, tags.length - visible.length)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align, gap: 5 }}>
      {visible.map(tag => (
        <span key={serviceTagKey(tag)}
          style={{ background: `${color}10`, color, border: `1px solid ${color}45`, borderRadius: 7, padding: '4px 7px', fontSize: 10, fontWeight: 800, lineHeight: 1.2 }}>
          {formatServiceTag(tag)}
        </span>
      ))}
      {hidden > 0 && (
        <span style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 7, padding: '4px 7px', fontSize: 10, fontWeight: 900, lineHeight: 1.2 }}>
          +{hidden}
        </span>
      )}
    </div>
  )
}

