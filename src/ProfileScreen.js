import { useState, useEffect, useRef } from 'react'
import { supabase, SUPABASE_URL } from './supabaseClient'
import { getUiText, localeForLang } from './i18n'
import { moderateImageFile } from './moderation'
import { geocodeSwissAddress } from './geo'
import { isNativeIOS } from './platform'
import { VerifiedBadge, attachCompanySubscriptions, getCompanyBadgeVariant } from './VerifiedBadge'
import { HubbingIcon } from './icons'
import { NeedAttachmentCloud, NeedAttachmentGallery, NeedAttachmentUploader } from './NeedAttachmentComponents'
import { fetchNeedAttachments, GENERAL_NEED_KEY, groupNeedAttachments, needKeyForTag } from './needAttachments'
import { NeedCompletionCloseButton, NeedCompletionCloseModal, NeedCompletionsPanel } from './NeedCompletionComponents'
import { countSuccessfulCollaborationsForCompany, fetchNeedCompletionsForCompany } from './needCompletions'
import { notifyNeedOpportunities } from './needOpportunityNotifications'
import { CompanyRealizationsGallery, CompanyRealizationsManager } from './CompanyRealizationsComponents'
import { fetchCompanyRealizations } from './companyRealizations'
import { shareCompanyProfileCard } from './profileShare'
import UsageGuideModal from './UsageGuideModal'
import LoadingIndicator from './LoadingIndicator'

const sectorColors = {
  'Fiduciaire & Comptabilité': '#3B6D11',
  'Design & Créatif': '#533AB7',
  'Informatique & Tech': '#185FA5',
  'BTP & Construction': '#854F0B',
  'Marketing & Publicité': '#993556',
  'Ressources Humaines': '#0F6E56',
  'Transport & Déménagement': '#444441',
  'Services aux entreprises': '#993C1D',
  'Architecture & Urbanisme': '#2D6A8F',
  'Assurance & Prévoyance': '#1A5276',
  'Automobile & Mobilité': '#6E2F1A',
  'Banque & Finance': '#1A3A5C',
  'Chimie & Pharmacie': '#4A235A',
  'Commerce de détail': '#784212',
  'Communication & PR': '#1D6A4A',
  'Conseil & Stratégie': '#2E4057',
  'Distribution & Logistique': '#4A4A4A',
  'Droit & Juridique': '#2C3E50',
  'E-commerce': '#1ABC9C',
  'Éducation & Formation': '#2980B9',
  'Energie & Environnement': '#27AE60',
  'Hôtellerie & Restauration': '#E67E22',
  'Immobilier': '#8E44AD',
  'Import & Export': '#16A085',
  'Imprimerie & Édition': '#D35400',
  'Industrie & Manufacturing': '#7F8C8D',
  'Luxe & Horlogerie': '#C0392B',
  'Médias & Presse': '#2C3E50',
  'Médical & Clinique': '#E74C3C',
  'Nettoyage & Facility': '#3498DB',
  'Optique & Lunetterie': '#9B59B6',
  'Santé & Bien-être': '#1ABC9C',
  'Sanitaire & Plomberie': '#2980B9',
  'Sécurité & Surveillance': '#E74C3C',
  'Sport & Loisirs': '#F39C12',
  'Telecommunications': '#2980B9',
  'Textile & Mode': '#8E44AD',
  'Tourisme & Voyages': '#16A085',
  'Agriculture & Viticulture': '#27AE60',
  'Arts & Culture': '#E91E63',
  'Autre': '#666',
}

const sectors = Object.keys(sectorColors)

const cantons = [
  'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR',
  'JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG',
  'TI','UR','VD','VS','ZG','ZH'
]

export default function ProfileScreen({ user, setActiveTab, plan = 'Starter', lang = 'fr', onPendingCompletionChange }) {
  const ui = getUiText(lang)
  const [uploadingContact, setUploadingContact] = useState(false)
  const [company, setCompany] = useState(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [stats, setStats] = useState({ matches: 0 })
  const [currentPlan, setCurrentPlan] = useState(plan)
  const [form, setForm] = useState({})
  const [success, setSuccess] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [tags, setTags] = useState([])
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState(null)
  const [showUsageGuide, setShowUsageGuide] = useState(false)
  const [needAttachments, setNeedAttachments] = useState([])
  const [needCompletions, setNeedCompletions] = useState([])
  const [realizations, setRealizations] = useState([])
  const [closingNeed, setClosingNeed] = useState(null)
  const [sharingProfile, setSharingProfile] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data } = await supabase
      .from('companies').select('*').eq('user_id', user.id).single()
    if (data) {
      const companyWithSubscription = await attachCompanySubscriptions(supabase, data)
      setCompany(companyWithSubscription)
      setForm(companyWithSubscription)
      loadStats(data.id)
      loadNeedAttachments(data.id)
      loadNeedCompletions(data.id)
      loadRealizations(data.id)
      const { data: sub } = await supabase.from('subscriptions').select('plan').eq('user_id', user.id).single()
      if (sub) setCurrentPlan(sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1))
      try {
        setTags(data.needs_tags ? JSON.parse(data.needs_tags) : [])
      } catch { setTags([]) }
    }
    setLoading(false)
  }

  const loadStats = async (companyId) => {
    const { count } = await supabase
      .from('matches').select('*', { count: 'exact', head: true })
      .or(`company_a.eq.${companyId},company_b.eq.${companyId}`)
    setStats({ matches: count || 0 })
  }

  const loadNeedAttachments = async (companyId = company?.id) => {
    if (!companyId) return
    try {
      const rows = await fetchNeedAttachments(companyId)
      setNeedAttachments(rows)
    } catch (error) {
      console.warn('Need attachments load failed:', error?.message || error)
    }
  }

  const loadNeedCompletions = async (companyId = company?.id) => {
    if (!companyId) return
    try {
      setNeedCompletions(await fetchNeedCompletionsForCompany(companyId))
    } catch (error) {
      console.warn('Need completions load failed:', error?.message || error)
    }
  }

  const loadRealizations = async (companyId = company?.id) => {
    if (!companyId) return
    try {
      setRealizations(await fetchCompanyRealizations(companyId))
    } catch (error) {
      console.warn('Company realizations load failed:', error?.message || error)
    }
  }

  const refreshNeedCompletions = async () => {
    await loadNeedCompletions(company?.id)
    onPendingCompletionChange?.()
  }

  const handleNeedCompletionCreated = async () => {
    const closedNeed = closingNeed
    const now = new Date().toISOString()
    try {
      if (closedNeed?.needKey === GENERAL_NEED_KEY) {
        await supabase
          .from('companies')
          .update({ needs_description: null, needs_updated_at: now })
          .eq('id', company.id)
        setForm(current => ({ ...current, needs_description: '' }))
        setCompany(current => ({ ...current, needs_description: '', needs_updated_at: now }))
      } else if (closedNeed?.needKey) {
        const nextTags = tags.filter(tag => needKeyForTag(tag) !== closedNeed.needKey)
        const serializedTags = JSON.stringify(nextTags)
        await supabase
          .from('companies')
          .update({ needs_tags: serializedTags, needs_updated_at: now })
          .eq('id', company.id)
        setTags(nextTags)
        setForm(current => ({ ...current, needs_tags: serializedTags }))
        setCompany(current => ({ ...current, needs_tags: serializedTags, needs_updated_at: now }))
      }
    } catch (error) {
      console.warn('Unable to remove closed need:', error?.message || error)
    }
    await refreshNeedCompletions()
  }

  const validateAndModerateProfileImage = async (file, context) => {
    if (!file.type?.startsWith('image/')) {
      alert(ui.profile.imageTypeError)
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(ui.profile.imageSizeError)
      return false
    }
    const moderation = await moderateImageFile(file, context)
    if (!moderation.allowed) {
      alert(ui.profile.imageBlocked)
      return false
    }
    return true
  }

  const handleBackgroundUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  try {
    const isAllowed = await validateAndModerateProfileImage(file, 'profile_background')
    if (!isAllowed) return
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}-background.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('logos').upload(fileName, file, { upsert: true })
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
    await supabase.from('companies').update({ background_url: urlData.publicUrl }).eq('user_id', user.id)
    setCompany({ ...company, background_url: urlData.publicUrl })
    setForm({ ...form, background_url: urlData.publicUrl })
  } catch (e) {
    alert(ui.profile.uploadError)
  } finally {
    e.target.value = ''
  }
}
const handleLogoUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  setUploadingLogo(true)
  try {
    const isAllowed = await validateAndModerateProfileImage(file, 'company_logo')
    if (!isAllowed) return
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}-logo.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('logos').upload(fileName, file, { upsert: true })
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
    await supabase.from('companies').update({ logo_url: urlData.publicUrl }).eq('user_id', user.id)
    setCompany({ ...company, logo_url: urlData.publicUrl })
    setForm({ ...form, logo_url: urlData.publicUrl })
  } catch (e) {
    alert(ui.profile.uploadError)
  } finally {
    e.target.value = ''
    setUploadingLogo(false)
  }
}

const handleContactPhotoUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  setUploadingContact(true)
  try {
    const isAllowed = await validateAndModerateProfileImage(file, 'contact_photo')
    if (!isAllowed) return
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}-contact.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('logos').upload(fileName, file, { upsert: true })
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
    setForm({ ...form, contact_photo_url: urlData.publicUrl })
  } catch (e) {
    alert(ui.profile.uploadError)
  } finally {
    e.target.value = ''
    setUploadingContact(false)
  }
}

  const tagText = tag => (typeof tag === 'string' ? tag : tag?.label || '').trim()
  const sameTag = (left, right) => tagText(left).toLowerCase() === tagText(right).toLowerCase()

  const addTag = () => {
    const label = newTag.trim()
    if (!label || tags.some(tag => sameTag(tag, label))) return
    setTags([...tags, label])
    setNewTag('')
  }

  const removeTag = (tag) => {
    setTags(tags.filter(t => !sameTag(t, tag)))
  }

  const notifyPasswordChange = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const supabaseUrl = SUPABASE_URL
    if (!token || !supabaseUrl) return false

    const response = await fetch(`${supabaseUrl}/functions/v1/password-change-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lang }),
    })

    return response.ok
  }

  const handlePasswordUpdate = async () => {
    if (passwordSaving) return
    setPasswordNotice(null)

    if (passwordForm.newPassword.length < 8) {
      setPasswordNotice({ type: 'error', message: ui.profile.passwordMinLength })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice({ type: 'error', message: ui.profile.passwordMismatch })
      return
    }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
    if (error) {
      setPasswordNotice({ type: 'error', message: ui.profile.passwordUpdateError(error.message) })
    } else {
      let emailSent = false
      try {
        emailSent = await notifyPasswordChange()
      } catch (notifyError) {
        console.warn('Password change notification email failed:', notifyError?.message || notifyError)
      }
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setPasswordNotice({
        type: emailSent ? 'success' : 'warning',
        message: emailSent ? ui.profile.passwordUpdated : ui.profile.passwordUpdatedEmailFailed,
      })
    }
    setPasswordSaving(false)
  }

  const handleShareProfile = async () => {
    if (sharingProfile) return
    setSharingProfile(true)
    try {
      await shareCompanyProfileCard(company, ui)
    } catch (error) {
      alert(error?.message || ui.profile.shareProfileError)
    }
    setSharingProfile(false)
  }

  const handleSave = async () => {
  if (!String(form.contact_phone || '').trim()) {
    alert(ui.profile.phoneRequired || 'Le téléphone direct du décideur est obligatoire.')
    return
  }
  setSaving(true)

  // Géocodage de l'adresse
  let lat = form.lat || null
  let lng = form.lng || null
  try {
    const coords = await geocodeSwissAddress({ address: form.address, city: form.city, canton: form.canton })
    if (coords) {
      lat = coords.lat
      lng = coords.lng
    }
  } catch (e) {
    console.log('Géocodage échoué', e)
  }

  const serializedNeedsTags = JSON.stringify(tags)
  const previousNeedsDescription = String(company?.needs_description || '').trim()
  const nextNeedsDescription = String(form.needs_description || '').trim()
  const previousNeedsTags = String(company?.needs_tags || '[]')
  const needsChanged = previousNeedsDescription !== nextNeedsDescription || previousNeedsTags !== serializedNeedsTags
  const needsUpdatedAt = needsChanged ? new Date().toISOString() : company?.needs_updated_at

  const updatePayload = {
    name: form.name,
    sector: form.sector,
    canton: form.canton,
    city: form.city,
    description: form.description,
    website: form.website,
    contact_linkedin: form.contact_linkedin,
    contact_photo_url: form.contact_photo_url,
    contact_name: form.contact_name,
    contact_title: form.contact_title,
    contact_phone: form.contact_phone,
    address: form.address,
    needs_description: form.needs_description,
    needs_tags: serializedNeedsTags,
    lat,
    lng,
    notif_app: form.notif_app ?? true,
notif_email: form.notif_email ?? true,
  }
  if (needsChanged) updatePayload.needs_updated_at = needsUpdatedAt

  const { error } = await supabase.from('companies').update(updatePayload).eq('user_id', user.id)

  if (!error) {
    setCompany({ ...company, ...form, needs_tags: serializedNeedsTags, lat, lng, needs_updated_at: needsUpdatedAt })
    setEditing(false)
    setSuccess(true)
    if (needsChanged && company?.id) {
      notifyNeedOpportunities({ companyId: company.id }).catch(notificationError => {
        console.warn('Unable to notify need opportunities:', notificationError?.message || notificationError)
      })
    }
    setTimeout(() => setSuccess(false), 3000)
  }
  setSaving(false)
}
  if (loading) return (
    <LoadingIndicator fill />
  )

  if (!company) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center'}}>
      <p style={{color:'#999'}}>{ui.common.companyNotFound}</p>
    </div>
  )

  const color = sectorColors[company.sector] || '#E24B4A'
  const initials = company.name?.substring(0, 2).toUpperCase()
  const companyBadgeVariant = getCompanyBadgeVariant(company, currentPlan)
  const groupedNeedAttachments = groupNeedAttachments(needAttachments)
  const verificationStatus = String(company.zefix_verification_status || 'manual_approved').toLowerCase()
  const verificationLabel = {
    verified: ui.profile.verificationVerified,
    manual_approved: ui.profile.verificationManualApproved,
    manual_pending: ui.profile.verificationPending,
    rejected: ui.profile.verificationRejected,
  }[verificationStatus] || ui.profile.verificationManualApproved

  const getTagStatus = (expires) => {
    if (!expires) return 'active'
    const diff = new Date(expires) - new Date()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return 'expired'
    if (days <= 7) return 'soon'
    return 'active'
  }

  const getTagColor = (expires) => {
    const status = getTagStatus(expires)
    if (status === 'expired') return '#E24B4A'
    if (status === 'soon') return '#F39C12'
    return '#22c55e'
  }

  const getTagLabel = (expires) => {
    if (!expires) return ''
    const diff = new Date(expires) - new Date()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return ui.profile.expired
    if (days === 0) return ui.profile.expiresToday
    if (days <= 7) return ui.profile.daysLeft(days)
    return ui.profile.until(new Date(expires).toLocaleDateString(localeForLang(lang)))
  }

  const selectFieldStyle = {
    height: 58,
    minHeight: 58,
    padding: '0 42px 0 16px',
    border: '1px solid #ddd',
    borderRadius: 10,
    fontSize: 16,
    lineHeight: 'normal',
    outline: 'none',
    background: 'white',
    color: '#1a1a1a',
    fontFamily: 'Plus Jakarta Sans',
    width: '100%',
    boxSizing: 'border-box',
    WebkitAppearance: 'menulist',
    appearance: 'menulist',
  }

  if (editing) return (
    <div style={{flex:1,overflowY:'auto',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h2 style={{fontSize:20,fontWeight:700}}>{ui.profile.editTitle}</h2>
        <button onClick={() => setEditing(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:14}}>{ui.common.cancel}</button>
      </div>

      <Label>{ui.profile.company}</Label>
      <Input value={form.name||''} onChange={e => setForm({...form,name:e.target.value})} placeholder={ui.profile.companyName} />
      <div style={{position:'relative',height:58,minHeight:58,border:'1px solid #ddd',borderRadius:10,background:'white',display:'flex',alignItems:'center',padding:'0 42px 0 16px',overflow:'hidden'}}>
        <span style={{fontSize:16,color:form.sector ? '#1a1a1a' : '#999',fontFamily:'Plus Jakarta Sans',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {form.sector || ui.profile.sector}
        </span>
        <span style={{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',color:'#1a1a1a',fontSize:14,pointerEvents:'none'}}>▼</span>
        <select value={form.sector||''} onChange={e => setForm({...form,sector:e.target.value})}
          aria-label={ui.profile.sector}
          style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer',fontSize:16}}>
          <option value="">{ui.profile.sector}</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{display:'flex',gap:12}}>
        <select value={form.canton||''} onChange={e => setForm({...form,canton:e.target.value})}
          style={{...selectFieldStyle, flex:'0 0 104px', width:104}}>
          <option value="">Canton</option>
          {cantons.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Input style={{flex:2}} value={form.city||''} onChange={e => setForm({...form,city:e.target.value})} placeholder={ui.profile.city} />
      </div>
      <Input value={form.address||''} onChange={e => setForm({...form,address:e.target.value})} placeholder={ui.profile.address} />
<textarea value={form.description||''} onChange={e => setForm({...form,description:e.target.value})}
        rows={5} placeholder={ui.profile.description}
        style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical',minHeight:'120px'}} />
      <Input value={form.website||''} onChange={e => setForm({...form,website:e.target.value})} placeholder={ui.profile.website} />

      <Label>{ui.profile.contact}</Label>
<Input value={form.contact_name||''} onChange={e => setForm({...form,contact_name:e.target.value})} placeholder={ui.profile.contactName} />
<Input value={form.contact_title||''} onChange={e => setForm({...form,contact_title:e.target.value})} placeholder={ui.profile.contactTitle} />
<Input value={form.contact_phone||''} onChange={e => setForm({...form,contact_phone:e.target.value})} placeholder={ui.profile.contactPhone} />
<Input value={form.contact_linkedin||''} onChange={e => setForm({...form,contact_linkedin:e.target.value})} placeholder={ui.profile.contactLinkedin} />

{/* Photo décisionnaire */}
<p style={{fontSize:12,color:'#666'}}>{ui.profile.contactPhoto}</p>
<div style={{display:'flex',alignItems:'center',gap:12}}>
  {form.contact_photo_url ? (
    <img src={form.contact_photo_url} alt="contact"
      style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',border:'2px solid #ddd'}} />
	  ) : (
	    <div style={{width:56,height:56,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
	      <HubbingIcon name="profile" size={24} color="#777" />
	    </div>
	  )}
  <label style={{padding:'10px 16px',background:'#f0f0f0',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
    {uploadingContact ? ui.common.upload : ui.profile.choosePhoto}
    <input type="file" accept="image/*" style={{display:'none'}} onChange={handleContactPhotoUpload} />
  </label>
</div>
      {company?.id && (
        <>
          <Label>{ui.realizations?.title || 'Réalisations'}</Label>
          <CompanyRealizationsManager
            company={company}
            plan={currentPlan}
            realizations={realizations}
            onChange={() => loadRealizations(company.id)}
            ui={ui}
          />
        </>
      )}
      <Label>{ui.profile.needs}</Label>
      <textarea value={form.needs_description||''} onChange={e => setForm({...form,needs_description:e.target.value})}
	style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical',minHeight:'120px'}} />
      <p style={{fontSize:12,color:'#666'}}>{ui.profile.needsHelp}</p>
      {company?.id && (
        <NeedAttachmentUploader
          company={company}
          plan={currentPlan}
          needKey={GENERAL_NEED_KEY}
          needLabel={ui.profile.needs}
          attachments={groupedNeedAttachments[GENERAL_NEED_KEY] || []}
          onChange={() => loadNeedAttachments(company.id)}
          ui={ui}
        />
      )}
      {String(form.needs_description || '').trim() && (
        <NeedCompletionCloseButton
          ui={ui}
          need={{
            needKey: GENERAL_NEED_KEY,
            needLabel: ui.profile.needs,
            needTitle: String(form.needs_description || '').trim().slice(0, 120),
          }}
          onClick={setClosingNeed}
        />
      )}

      {/* Tags existants */}
      {tags.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {tags.map((tag, i) => {
            const label = tagText(tag)
            const tagKey = needKeyForTag(tag)
            const expires = typeof tag === 'string' ? null : tag.expires
            return (
            <div key={`${tagKey}-${i}`} style={{display:'flex',flexDirection:'column',gap:8,background:'#f9f9f9',borderRadius:10,padding:'8px 12px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <div style={{minWidth:0}}>
                  <span style={{fontSize:14,fontWeight:500}}>{label}</span>
                  {expires && (
                    <span style={{fontSize:11,color:getTagColor(expires),marginLeft:8}}>
                      {getTagLabel(expires)}
                    </span>
                  )}
                </div>
                <button onClick={() => removeTag(tag)}
                  style={{background:'none',border:'none',cursor:'pointer',color:'#E24B4A',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <HubbingIcon name="x" size={16} color="#E24B4A" />
                </button>
              </div>
              {company?.id && (
                <NeedAttachmentUploader
                  company={company}
                  plan={currentPlan}
                  needKey={tagKey}
                  needLabel={label}
                  attachments={groupedNeedAttachments[tagKey] || []}
                  onChange={() => loadNeedAttachments(company.id)}
                  ui={ui}
                />
              )}
              <NeedCompletionCloseButton
                ui={ui}
                need={{
                  needKey: tagKey,
                  needLabel: label,
                  needTitle: label,
                }}
                onClick={setClosingNeed}
              />
            </div>
          )})}
        </div>
      )}

      {/* Ajouter un tag */}
      <div style={{display:'flex',flexDirection:'column',gap:8,background:'#f9f9f9',borderRadius:10,padding:'12px'}}>
        <Input value={newTag} onChange={e => setNewTag(e.target.value)}
          placeholder={ui.profile.tagPlaceholder} />
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input type="date" value={form.newTagExpiry||''} onChange={e => setForm({...form,newTagExpiry:e.target.value})}
            style={{flex:1,padding:'10px',border:'1px solid #ddd',borderRadius:10,fontSize:14,outline:'none',fontFamily:'Plus Jakarta Sans'}} />
          <button onClick={() => {
            const label = newTag.trim()
            if (!label || tags.some(tag => sameTag(tag, label))) return
            setTags([...tags, { label, expires: form.newTagExpiry || null }])
            setNewTag('')
            setForm({...form, newTagExpiry: ''})
          }}
            style={{padding:'10px 16px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
            {ui.profile.add}
          </button>
        </div>
        <p style={{fontSize:11,color:'#999'}}>{ui.profile.expiryOptional}</p>
      </div>
<Label>{ui.profile.notifications}</Label>
<div style={{display:'flex',flexDirection:'column',gap:12,background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
    <div>
      <p style={{fontSize:14,fontWeight:600,margin:0}}>{ui.profile.appNotif}</p>
      <p style={{fontSize:12,color:'#999',margin:'2px 0 0'}}>{ui.profile.appNotifDesc}</p>
    </div>
    <div onClick={() => setForm({...form, notif_app: !form.notif_app})}
      style={{width:44,height:24,borderRadius:12,background: form.notif_app !== false ? '#E24B4A' : '#ddd',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
      <div style={{position:'absolute',top:2,left: form.notif_app !== false ? 22 : 2,width:20,height:20,borderRadius:'50%',background:'white',boxShadow:'0 1px 4px rgba(0,0,0,0.2)',transition:'left 0.2s'}}></div>
    </div>
  </div>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
    <div>
      <p style={{fontSize:14,fontWeight:600,margin:0}}>{ui.profile.emailNotif}</p>
      <p style={{fontSize:12,color:'#999',margin:'2px 0 0'}}>{ui.profile.emailNotifDesc}</p>
    </div>
    <div onClick={() => setForm({...form, notif_email: !form.notif_email})}
      style={{width:44,height:24,borderRadius:12,background: form.notif_email !== false ? '#E24B4A' : '#ddd',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
      <div style={{position:'absolute',top:2,left: form.notif_email !== false ? 22 : 2,width:20,height:20,borderRadius:'50%',background:'white',boxShadow:'0 1px 4px rgba(0,0,0,0.2)',transition:'left 0.2s'}}></div>
    </div>
  </div>
</div>
<Label>{ui.profile.security}</Label>
<div style={{display:'flex',flexDirection:'column',gap:10,background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
  <p style={{fontSize:12,color:'#666',lineHeight:1.5,margin:0}}>{ui.profile.passwordHelp}</p>
  <Input
    type="password"
    autoComplete="new-password"
    value={passwordForm.newPassword}
    onChange={e => {
      setPasswordForm({...passwordForm,newPassword:e.target.value})
      setPasswordNotice(null)
    }}
    placeholder={ui.profile.newPassword}
  />
  <Input
    type="password"
    autoComplete="new-password"
    value={passwordForm.confirmPassword}
    onChange={e => {
      setPasswordForm({...passwordForm,confirmPassword:e.target.value})
      setPasswordNotice(null)
    }}
    placeholder={ui.profile.confirmPassword}
  />
  {passwordNotice && (
    <p style={{fontSize:12,color: passwordNotice.type === 'success' ? '#166534' : passwordNotice.type === 'warning' ? '#B45309' : '#E24B4A',fontWeight:600,margin:0}}>
      {passwordNotice.message}
    </p>
  )}
  <button onClick={handlePasswordUpdate} disabled={passwordSaving}
    style={{padding:'12px',background:passwordSaving ? '#eee' : '#1a1a1a',color:passwordSaving ? '#999' : 'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:passwordSaving ? 'default' : 'pointer'}}>
    {passwordSaving ? ui.profile.passwordChanging : ui.profile.changePassword}
  </button>
</div>
      <button onClick={handleSave} disabled={saving}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer',marginTop:'0.5rem'}}>
        {saving ? ui.common.saving : ui.common.save}
      </button>
      {closingNeed && (
        <NeedCompletionCloseModal
          company={company}
          need={closingNeed}
          ui={ui}
          onClose={() => setClosingNeed(null)}
          onCreated={handleNeedCompletionCreated}
        />
      )}
    </div>
  )

  // Récupérer les tags parsés
  let parsedTags = []
  try { parsedTags = company.needs_tags ? JSON.parse(company.needs_tags) : [] } catch { parsedTags = [] }
  const activeTags = parsedTags.filter(t => {
    const expires = typeof t === 'string' ? null : t.expires
    return getTagStatus(expires) !== 'expired'
  })
  const successfulCollaborations = countSuccessfulCollaborationsForCompany(company.id, needCompletions, { includeHiddenProvider: true })

  return (
    <div style={{flex:1,overflowY:'auto'}}>
      {showUsageGuide && <UsageGuideModal t={ui.usageGuide} onClose={() => setShowUsageGuide(false)} />}

      {/* Header */}
      <div style={{
  background: company.background_url ? `url(${company.background_url}) center/cover` : color,
  padding:'2rem 1.5rem 3rem',position:'relative',textAlign:'center'
}}>
  {company.background_url && (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)'}} />
  )}
  <div style={{position:'relative',zIndex:1}}>
  {/* Bouton changer fond */}
  <label style={{position:'absolute',top:10,right:10,background:'rgba(0,0,0,0.4)',borderRadius:20,padding:'4px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
    <span style={{fontSize:12,color:'white'}}>{ui.profile.background}</span>
    <input type="file" accept="image/*" style={{display:'none'}} onChange={handleBackgroundUpload} />
  </label>
        <div style={{position:'relative',width:88,height:88,margin:'0 auto',cursor:'pointer'}}
          onClick={() => fileInputRef.current?.click()}>
          {company.logo_url ? (
            <img src={company.logo_url} alt="logo"
              style={{width:88,height:88,borderRadius:'50%',objectFit:'cover',border:'3px solid white'}} />
          ) : (
            <div style={{width:88,height:88,borderRadius:'50%',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center',border:'3px solid rgba(255,255,255,0.5)'}}>
              <span style={{color:'white',fontWeight:700,fontSize:28}}>{initials}</span>
            </div>
          )}
	          <div style={{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
	            <HubbingIcon name="camera" size={14} color="#4B5563" />
	          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{display:'none'}} />
        {uploadingLogo && <p style={{color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:4}}>{ui.profile.downloading}</p>}
        <h2 style={{color:'white',fontSize:20,fontWeight:700,marginTop:'0.75rem',display:'flex',alignItems:'center',justifyContent:'center',gap:7,flexWrap:'wrap'}}>
          <span>{company.name}</span>
          {companyBadgeVariant && <VerifiedBadge size={22} variant={companyBadgeVariant} />}
        </h2>
        {company.sector && <p style={{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:2}}>{company.sector}</p>}
        {company.city && (
          <p style={{color:'rgba(255,255,255,0.7)',fontSize:13,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            <HubbingIcon name="mapPin" size={13} color="rgba(255,255,255,0.75)" />
            {company.city}{company.canton ? `, ${company.canton}` : ''}
          </p>
        )}
      </div>
  </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',margin:'-1.25rem 1rem 0',gap:12,position:'relative',zIndex:1}}>
        <StatCard value={stats.matches} label={ui.profile.matches} color="#E24B4A" onClick={() => setActiveTab && setActiveTab('messages')} />
        <StatCard value="0" label={ui.profile.messages} color="#E24B4A" onClick={() => setActiveTab && setActiveTab('messages')} />
        <StatCard value={successfulCollaborations} label={ui.profile.collaborations || 'Collaborations'} color="#E24B4A" />
        <div style={{flex:1,background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',cursor:'pointer'}}
          onClick={() => setActiveTab && setActiveTab('pricing')}>
          <p style={{fontSize:13,fontWeight:700,color:'#3B6D11',margin:0}}>{currentPlan}</p>
          <p style={{fontSize:11,color:'#999',marginTop:3}}>{ui.profile.myPlan}</p>
        </div>
      </div>

      <div style={{padding:'1.5rem 1rem',display:'flex',flexDirection:'column',gap:'0.75rem',marginTop:'0.5rem'}}>

        {success && (
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'0.75rem',textAlign:'center'}}>
            <p style={{color:'#166534',fontSize:14,fontWeight:600}}>{ui.profile.updated}</p>
          </div>
        )}

        <CompanyRealizationsGallery
          realizations={realizations}
          ui={ui}
          showEmpty
        />

        <NeedCompletionsPanel
          companyId={company.id}
          completions={needCompletions}
          ui={ui}
          showPendingActions
          onChanged={refreshNeedCompletions}
        />

        {/* Nos besoins */}
        {(company.needs_description || activeTags.length > 0 || needAttachments.length > 0) && (
          <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:12,padding:'1rem'}}>
	            <p style={{fontSize:12,color:'#E67E22',fontWeight:700,marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
	              <HubbingIcon name="briefcase" size={14} color="#E67E22" /> {ui.profile.needs}
	            </p>
            {company.needs_description && (
              <p style={{fontSize:14,color:'#444',lineHeight:1.6,marginBottom: activeTags.length > 0 ? 10 : 0}}>
                {company.needs_description}
              </p>
            )}
            {(groupedNeedAttachments[GENERAL_NEED_KEY] || []).length > 0 && (
              <NeedAttachmentGallery
                attachments={groupedNeedAttachments[GENERAL_NEED_KEY] || []}
                ui={ui}
                canDownload={currentPlan === 'Premium'}
              />
            )}
            {activeTags.length > 0 && (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {activeTags.map((tag, i) => {
                  const label = tagText(tag)
                  const tagKey = needKeyForTag(tag)
                  const expires = typeof tag === 'string' ? null : tag.expires
                  return (
                  <div key={`${tagKey}-${i}`} style={{display:'flex',flexDirection:'column',gap:6,width:'100%'}}>
                    <div style={{background:'white',border:`1px solid ${getTagColor(expires)}`,borderRadius:20,padding:'4px 10px',display:'flex',alignItems:'center',gap:4,width:'fit-content',maxWidth:'100%'}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:getTagColor(expires)}}></div>
                      <span style={{fontSize:12,fontWeight:500,color:'#333'}}>{label}</span>
                      {expires && <span style={{fontSize:10,color:getTagColor(expires)}}>{getTagLabel(expires)}</span>}
                    </div>
                    <NeedAttachmentGallery
                      attachments={groupedNeedAttachments[tagKey] || []}
                      ui={ui}
                      canDownload={currentPlan === 'Premium'}
                    />
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        <NeedAttachmentCloud
          plan={currentPlan}
          attachments={needAttachments}
          onChange={() => loadNeedAttachments(company.id)}
          ui={ui}
        />

        {/* Décideur */}
        {company.contact_name && (
  <InfoCard title={ui.profile.contact}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
      {company.contact_photo_url ? (
        <img src={company.contact_photo_url} alt="contact"
          style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',border:'2px solid #eee'}} />
      ) : (
	        <div style={{width:52,height:52,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
	          <HubbingIcon name="profile" size={22} color="#777" />
	        </div>
      )}
      <div>
        <p style={{fontSize:15,fontWeight:700,margin:0}}>{company.contact_name}</p>
        {company.contact_title && <p style={{fontSize:13,color:'#666',margin:0}}>{company.contact_title}</p>}
      </div>
    </div>
    {company.contact_phone && <InfoRow label={ui.profile.contactPhone.replace(' direct', '').replace(' *', '')} value={company.contact_phone} />}
    {company.contact_linkedin && (
      <InfoRow label="LinkedIn" value={ui.common.viewProfile} color="#0A66C2" />
    )}
  </InfoCard>
)}

        {/* Description */}
        {company.description && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:6}}>{ui.profile.about}</p>
            <p style={{fontSize:14,color:'#444',lineHeight:1.6}}>{company.description}</p>
          </div>
        )}

        {/* Infos entreprise */}
        <InfoCard title={ui.profile.companyInfo}>
          {company.zefix_uid && <InfoRow label={ui.profile.zefix} value={company.zefix_uid} />}
          {company.zefix_uid && <InfoRow label={ui.profile.verificationStatus} value={verificationLabel} color={verificationStatus === 'rejected' ? '#E24B4A' : verificationStatus === 'manual_pending' ? '#F39C12' : '#22c55e'} />}
          {company.address && <InfoRow label={ui.profile.address.replace(' *', '')} value={company.address} />}
          {company.city && <InfoRow label={ui.profile.city} value={`${company.city}${company.canton ? `, ${company.canton}` : ''}`} />}
          {company.website && <InfoRow label={ui.profile.website.replace(' (https://...)', '')} value={company.website} color="#185FA5" />}
          <InfoRow label={ui.profile.email} value={user.email} />
        </InfoCard>

        <button onClick={() => setEditing(true)}
          style={{padding:'14px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
          {ui.profile.editProfile}
        </button>
        <button onClick={handleShareProfile} disabled={sharingProfile}
          style={{padding:'14px',background:'white',color:'#E24B4A',border:'1px solid #FECACA',borderRadius:12,fontSize:15,fontWeight:700,cursor:sharingProfile ? 'default' : 'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <HubbingIcon name="sparkles" size={17} color="#E24B4A" />
          {sharingProfile ? (ui.profile.shareProfileBusy || 'Préparation du visuel...') : (ui.profile.shareProfile || 'Partager le profil')}
        </button>
        <a href="mailto:contact@hubbing.ch"
  style={{padding:'14px',background:'white',color:'#666',border:'1px solid #eee',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',textAlign:'center',textDecoration:'none',display:'block'}}>
  {ui.profile.contactHubbing}
</a>
        <button onClick={() => setShowUsageGuide(true)}
          style={{padding:'14px',background:'white',color:'#185FA5',border:'1px solid #BFDBFE',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <HubbingIcon name="sparkles" size={17} color="#185FA5" />
          {ui.usageGuide.usageGuide}
        </button>
        <DeleteAccountButton user={user} lang={lang} />

<button onClick={() => window.location.href = window.location.pathname + '?admin=true'}
  style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#eee',textAlign:'center',padding:'4px',width:'100%'}}>
  ···
</button>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{children}</p>
}

function DeleteAccountButton({ user, lang = 'fr' }) {
  const ui = getUiText(lang)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const nativeIOS = isNativeIOS()

  const openAppleSubscriptions = () => {
    window.open('https://apps.apple.com/account/subscriptions', '_blank', 'noopener,noreferrer')
  }

  const handleDelete = async () => {
  setLoading(true)
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const supabaseUrl = SUPABASE_URL
    if (!token || !supabaseUrl) throw new Error('Missing session')

    const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lang })
    })
    if (!response.ok) {
      const details = await response.text()
      throw new Error(details || 'Account deletion failed')
    }

    setStep(3)
    setTimeout(async () => {
      await supabase.auth.signOut().catch(() => null)
      window.location.href = '/'
    }, 2500)
  } catch(e) {
    alert(ui.profile.deleteError)
  }
  setLoading(false)
}

  if (step === 0) return (
    <button onClick={() => setStep(1)}
      style={{padding:'12px',background:'white',color:'#E24B4A',border:'1px solid #FECACA',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',width:'100%'}}>
      {ui.profile.deleteAccount}
    </button>
  )

  if (step === 1) return (
    <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem'}}>
      <p style={{fontSize:15,fontWeight:700,color:'#E24B4A',marginBottom:8}}>{ui.profile.warningTitle}</p>
      <p style={{fontSize:13,color:'#666',lineHeight:1.6,marginBottom:'1rem'}}>
        {ui.profile.warningText}
      </p>
      {nativeIOS && (
        <div style={{background:'white',border:'1px solid #FECACA',borderRadius:10,padding:'0.75rem',marginBottom:'1rem'}}>
          <p style={{fontSize:12,color:'#666',lineHeight:1.5,margin:'0 0 0.65rem'}}>
            {ui.profile.appleSubscriptionNotice}
          </p>
          <button onClick={openAppleSubscriptions}
            style={{width:'100%',padding:'10px',background:'#111827',color:'white',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer'}}>
            {ui.profile.manageAppleSubscription}
          </button>
        </div>
      )}
      <div style={{display:'flex',gap:8}}>
        <button onClick={() => setStep(0)}
          style={{flex:1,padding:'12px',background:'#f5f5f5',color:'#444',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
          {ui.profile.abandon}
        </button>
        <button onClick={() => setStep(2)}
          style={{flex:1,padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
          {ui.profile.continue}
        </button>
      </div>
    </div>
  )

  if (step === 2) return (
    <div style={{background:'#FFF5F5',border:'2px solid #E24B4A',borderRadius:12,padding:'1rem'}}>
      <p style={{fontSize:15,fontWeight:700,color:'#E24B4A',marginBottom:8}}>{ui.profile.finalConfirm}</p>
      <p style={{fontSize:13,color:'#666',lineHeight:1.6,marginBottom:'1rem'}}>
        {ui.profile.finalConfirmText(user.email)}
      </p>
      {nativeIOS && (
        <button onClick={openAppleSubscriptions}
          style={{width:'100%',padding:'11px',background:'#111827',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:'1rem'}}>
          {ui.profile.manageAppleSubscription}
        </button>
      )}
      <div style={{display:'flex',gap:8}}>
        <button onClick={() => setStep(0)}
          style={{flex:1,padding:'12px',background:'#f5f5f5',color:'#444',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
          {ui.profile.abandon}
        </button>
        <button onClick={handleDelete} disabled={loading}
          style={{flex:1,padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
          {loading ? ui.common.sending : ui.profile.confirm}
        </button>
      </div>
    </div>
  )

  if (step === 3) return (
    <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:'1rem',textAlign:'center'}}>
      <p style={{fontSize:15,fontWeight:700,color:'#166534',marginBottom:4}}>{ui.profile.requestSent}</p>
      <p style={{fontSize:13,color:'#666'}}>{ui.profile.requestSentText(user.email)}</p>
    </div>
  )
}

function Input({ value, onChange, placeholder, style, type = 'text', autoComplete }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
      style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none',fontFamily:'Plus Jakarta Sans',width:'100%',...style}} />
  )
}

function StatCard({ value, label, color, onClick }) {
  return (
    <div onClick={onClick} style={{flex:1,background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',cursor:onClick ? 'pointer' : 'default'}}>
      <p style={{fontSize:24,fontWeight:700,color,margin:0}}>{value}</p>
      <p style={{fontSize:11,color:'#999',marginTop:3}}>{label}</p>
    </div>
  )
}

function InfoCard({ title, children }) {
  return (
    <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
      <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:8}}>{title}</p>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:13,color:'#666'}}>{label}</span>
      <span style={{fontSize:13,color:color||'#444',fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{value}</span>
    </div>
  )
}
