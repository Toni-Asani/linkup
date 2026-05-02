import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { getUiText, localeForLang } from './i18n'
import { moderateImageFile, moderateTextContent } from './moderation'

const STARTER_DAILY_MESSAGE_LIMIT = 5

export default function MessagesScreen({ user, plan, setSelectedCompanyId, setActiveTab, openMatchWithCompanyId, onDirectOpenHandled, lang = 'fr' }) {
  const ui = getUiText(lang)
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [myCompany, setMyCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [existingReview, setExistingReview] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [dailyMessageCount, setDailyMessageCount] = useState(0)
  const messagesEndRef = useRef(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [longPressMatch, setLongPressMatch] = useState(null)
  const fileAttachRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressTriggeredRef = useRef(false)
  const touchStartPointRef = useRef(null)

  useEffect(() => { loadMyCompanyAndMatches() }, [])

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [])

useEffect(() => {
  if (openMatchWithCompanyId && matches.length > 0) {
    const match = matches.find(m => 
      m.company_a?.id === openMatchWithCompanyId || 
      m.company_b?.id === openMatchWithCompanyId
    )
    if (match) {
      setSelectedMatch(match)
      onDirectOpenHandled && onDirectOpenHandled()
    }
  }
}, [openMatchWithCompanyId, matches, onDirectOpenHandled])

  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch.id)
      checkExistingReview()
      const sub = supabase
        .channel('messages-' + selectedMatch.id)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `match_id=eq.${selectedMatch.id}`
        }, payload => {
          setMessages(prev => [...prev, payload.new])
        })
        .subscribe()
      return () => supabase.removeChannel(sub)
    }
  }, [selectedMatch])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const markNotificationsRead = async () => {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)
}

const loadMyCompanyAndMatches = async () => {
  // Expirer les matchs sans message après 7 jours
  await supabase.rpc('expire_matches')

  // Marquer les notifications comme lues
  await markNotificationsRead()

  const { data: myComp } = await supabase
    .from('companies').select('*').eq('user_id', user.id).single()
  if (!myComp) { setLoading(false); return }
  setMyCompany(myComp)
  await loadDailyMessageCount(myComp.id)

  const { data: matchData } = await supabase
    .from('matches')
    .select('*, company_a(*), company_b(*)')
    .or(`company_a.eq.${myComp.id},company_b.eq.${myComp.id}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  setMatches(matchData || [])
  setLoading(false)
}

  const loadDailyMessageCount = async (companyId) => {
    if (!companyId) return 0
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', companyId)
      .gte('created_at', startOfToday.toISOString())
    const todayCount = count || 0
    setDailyMessageCount(todayCount)
    return todayCount
  }

  const loadMessages = async (matchId) => {
    const { data } = await supabase
      .from('messages').select('*').eq('match_id', matchId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  const checkExistingReview = async () => {
    if (!myCompany || !selectedMatch) return
    const other = getOtherCompany(selectedMatch)
    if (!other) return
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewer_company_id', myCompany.id)
      .eq('reviewed_company_id', other.id)
      .maybeSingle()
    setExistingReview(data)
    if (data) {
      setReviewRating(data.rating)
      setReviewComment(data.comment || '')
    }
  }

  const submitReview = async () => {
    if (!reviewRating || !myCompany) return
    setSubmittingReview(true)
    const other = getOtherCompany(selectedMatch)

    const reviewModeration = await moderateTextContent(reviewComment, 'review')
    if (!reviewModeration.allowed) {
      alert(ui.messages.reviewBlocked)
      setSubmittingReview(false)
      return
    }

    if (existingReview) {
      await supabase.from('reviews').update({
        rating: reviewRating,
        comment: reviewComment,
        status: 'pending'
      }).eq('id', existingReview.id)
    } else {
      await supabase.from('reviews').insert({
        reviewer_company_id: myCompany.id,
        reviewed_company_id: other.id,
        match_id: selectedMatch.id,
        rating: reviewRating,
        comment: reviewComment,
        status: 'pending'
      })
    }
    setShowReviewModal(false)
    setExistingReview({ rating: reviewRating, comment: reviewComment })
    setSubmittingReview(false)
  }

  const allowedTypes = [
  'image/jpeg','image/png','image/gif','image/webp',
  'application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
]

const handleFileUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (!allowedTypes.includes(file.type)) {
    alert(ui.messages.fileTypeError)
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    alert(ui.messages.fileSizeError)
    return
  }

  setUploadingFile(true)
  try {
    if (file.type.startsWith('image/')) {
      const moderation = await moderateImageFile(file, 'message_attachment')
      if (!moderation.allowed) {
        alert(ui.messages.fileBlocked)
        setUploadingFile(false)
        if (fileAttachRef.current) fileAttachRef.current.value = ''
        return
      }
    }

    const ext = file.name.split('.').pop()
    const fileName = `${myCompany.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('attachments').upload(fileName, file)
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName)
    
    await supabase.from('messages').insert({
      match_id: selectedMatch.id,
      sender_id: myCompany.id,
      content: `📎 ${file.name}`,
      attachment_url: urlData.publicUrl,
      attachment_name: file.name,
      attachment_type: file.type
    })
    await loadMessages(selectedMatch.id)
  } catch(e) {
    alert(ui.messages.fileUploadError)
  }
  setUploadingFile(false)
  if (fileAttachRef.current) fileAttachRef.current.value = ''
}
  const sendMessage = async () => {
    if (!newMessage.trim() || !myCompany) return
    let starterCountBeforeSend = dailyMessageCount
    if (isStarter) {
      starterCountBeforeSend = await loadDailyMessageCount(myCompany.id)
      if (starterCountBeforeSend >= STARTER_DAILY_MESSAGE_LIMIT) {
        alert(ui.messages.starterLimitReached)
        return
      }
    }
    const moderation = await moderateTextContent(newMessage, 'message')
    if (!moderation.allowed) {
      alert(moderation.reason === 'direct_contact_info'
        ? ui.messages.directContactBlocked
        : ui.messages.messageBlocked)
      return
    }
    const content = newMessage.trim()
setNewMessage('')
const msg = { match_id: selectedMatch.id, sender_id: myCompany.id, content }
const { data } = await supabase.from('messages').insert(msg).select().single()
if (data) {
  setMessages(prev => [...prev, data])
  if (isStarter) {
    const nextCount = starterCountBeforeSend + 1
    setDailyMessageCount(nextCount)
    if (nextCount >= STARTER_DAILY_MESSAGE_LIMIT) {
      alert(ui.messages.starterLimitReached)
    }
  }
}
  }

  const getOtherCompany = (match) => {
    if (!myCompany) return null
    return match.company_a?.id === myCompany.id ? match.company_b : match.company_a
  }

  const locale = localeForLang(lang)
  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' })

  const isStarter = plan === 'Starter'
  const isBasicOrPremium = plan === 'Basic' || plan === 'Premium'
  const canSendMessages = isStarter || isBasicOrPremium
  const canLeaveReview = isBasicOrPremium && messages.length >= 1
  const starterMessagesRemaining = Math.max(0, STARTER_DAILY_MESSAGE_LIMIT - dailyMessageCount)
  const starterLimitReached = isStarter && starterMessagesRemaining <= 0

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const startConversationLongPress = (match, e) => {
    clearLongPressTimer()
    longPressTriggeredRef.current = false
    const touch = e.touches?.[0]
    touchStartPointRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setLongPressMatch(match)
    }, 700)
  }

  const moveConversationLongPress = (e) => {
    const start = touchStartPointRef.current
    const touch = e.touches?.[0]
    if (!start || !touch) return
    const deltaX = Math.abs(touch.clientX - start.x)
    const deltaY = Math.abs(touch.clientY - start.y)
    if (deltaX > 10 || deltaY > 10) clearLongPressTimer()
  }

  const endConversationLongPress = () => {
    clearLongPressTimer()
    touchStartPointRef.current = null
  }

  const handleConversationClick = (match, e) => {
    if (longPressTriggeredRef.current) {
      e.preventDefault()
      e.stopPropagation()
      longPressTriggeredRef.current = false
      return
    }
    setSelectedMatch(match)
  }

  // Vue conversation
  if (selectedMatch) {
    const other = getOtherCompany(selectedMatch)
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>

        {/* Modal avis */}
        {showReviewModal && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
            <div style={{background:'white',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:360}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                <h3 style={{fontSize:17,fontWeight:700}}>{ui.messages.reviewTitle(other?.name)}</h3>
                <button onClick={() => setShowReviewModal(false)}
                  style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#999'}}>✕</button>
              </div>

              {/* Étoiles */}
              <p style={{fontSize:13,color:'#666',marginBottom:8}}>{ui.messages.ratingLabel}</p>
              <div style={{display:'flex',gap:8,marginBottom:'1rem'}}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setReviewRating(star)}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:32,
                      color: star <= reviewRating ? '#F39C12' : '#ddd',
                      transform: star <= reviewRating ? 'scale(1.1)' : 'scale(1)',
                      transition:'all 0.15s'}}>
                    ★
                  </button>
                ))}
              </div>

              {/* Commentaire */}
              <p style={{fontSize:13,color:'#666',marginBottom:6}}>{ui.messages.commentOptional}</p>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder={ui.messages.commentPlaceholder}
                rows={3}
                style={{width:'100%',padding:'10px',border:'1px solid #ddd',borderRadius:10,fontSize:13,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical',marginBottom:'1rem'}}
              />

              <p style={{fontSize:11,color:'#999',marginBottom:'1rem'}}>
                {ui.messages.moderation}
              </p>

              <button onClick={submitReview} disabled={!reviewRating || submittingReview}
                style={{width:'100%',padding:'13px',background: reviewRating ? '#E24B4A' : '#eee',color: reviewRating ? 'white' : '#999',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor: reviewRating ? 'pointer' : 'default'}}>
                {submittingReview ? ui.common.sending : existingReview ? ui.messages.editReview : ui.messages.submitReview}
              </button>
            </div>
          </div>
        )}

        {/* Header conversation */}
        <div style={{padding:'1rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',gap:12,background:'white'}}>
          <button onClick={() => setSelectedMatch(null)}
            style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:20,padding:0}}>
            ←
          </button>
          <div style={{width:40,height:40,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span style={{color:'white',fontWeight:700,fontSize:14}}>
              {other?.name?.substring(0,2).toUpperCase()}
            </span>
          </div>
          <div style={{flex:1,cursor:'pointer'}} onClick={() => setSelectedCompanyId && setSelectedCompanyId(other?.id)}>
  <p style={{fontWeight:700,fontSize:15,margin:0}}>{other?.name}</p>
  <p style={{fontSize:12,color:'#999',margin:0}}>{other?.sector} · {other?.city} — <span style={{color:'#E24B4A'}}>{ui.messages.viewProfile}</span></p>
</div>
          {/* Bouton avis */}
          {canLeaveReview && (
            <button onClick={() => setShowReviewModal(true)}
              style={{background: existingReview ? '#FFF9F0' : '#FFF5F5',border:`1px solid ${existingReview ? '#FDE8C0' : '#FECACA'}`,borderRadius:20,padding:'6px 10px',cursor:'pointer',fontSize:12,fontWeight:600,color: existingReview ? '#E67E22' : '#E24B4A',flexShrink:0}}>
              {existingReview ? `★ ${existingReview.rating}/5` : ui.messages.evaluate}
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'1rem',display:'flex',flexDirection:'column',gap:8,background:'#f9f9f9'}}>
          {messages.length === 0 && (
            <div style={{textAlign:'center',padding:'2rem',color:'#999'}}>
              <p style={{fontSize:32,marginBottom:8}}>👋</p>
              <p style={{fontSize:14}}>{ui.messages.startConversation(other?.name)}</p>
              <p style={{fontSize:12,marginTop:4}}>{ui.messages.introduce}</p>
            </div>
          )}
          {messages.filter(msg => {
  if (msg.deleted_for_all) return false
  if (msg.deleted_for && msg.deleted_for.includes(myCompany?.id)) return false
  return true
}).map(msg => {
  const isMe = msg.sender_id === myCompany?.id
  return (
              <div key={msg.id} style={{display:'flex',justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems:'flex-end', gap:4}}>
  <button onClick={async () => {
  if (isMe) {
    if (window.confirm(ui.messages.deleteForAllConfirm)) {
      await supabase.from('messages').update({ deleted_for_all: true }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? {...m, deleted_for_all: true} : m))
    }
  } else {
    if (window.confirm(ui.messages.deleteForMeConfirm)) {
      const newDeletedFor = [...(msg.deleted_for || []), myCompany.id]
      await supabase.from('messages').update({ deleted_for: newDeletedFor }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? {...m, deleted_for: newDeletedFor} : m))
    }
  }
}}
  style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',fontSize:14,padding:'0 4px',flexShrink:0}}>
  🗑️
</button>
  <div style={{
    maxWidth:'75%',padding:'10px 14px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? '#E24B4A' : 'white',
                  color: isMe ? 'white' : '#1a1a1a',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.08)',
                  fontSize:14,lineHeight:1.5
                }}>
                  {msg.attachment_url ? (
  <a href={msg.attachment_url} target="_blank" rel="noreferrer"
    style={{color: 'inherit', display:'flex', alignItems:'center', gap:6, textDecoration:'none'}}>
    <span style={{fontSize:18}}>📎</span>
    <span style={{textDecoration:'underline', fontSize:13}}>{msg.attachment_name || msg.content}</span>
  </a>
) : (
  <p style={{margin:0}}>{msg.content}</p>
)}
                  <p style={{fontSize:10,margin:'4px 0 0',opacity:0.7,textAlign:'right'}}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input message */}
{canSendMessages ? (
  <div style={{padding:'0.75rem 1rem',borderTop:'1px solid #f0f0f0',background:'white'}}>
    {isStarter && (
      <p style={{fontSize:11,color: starterLimitReached ? '#E24B4A' : '#666',margin:'0 0 8px',textAlign:'center',fontWeight:600}}>
        {ui.messages.starterDailyLimit(starterMessagesRemaining, STARTER_DAILY_MESSAGE_LIMIT)}
      </p>
    )}
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
    {plan === 'Premium' && (
  <label style={{cursor:'pointer',flexShrink:0}}>
    <span style={{fontSize:22}}>{uploadingFile ? '⏳' : '📎'}</span>
    <input ref={fileAttachRef} type="file" style={{display:'none'}}
      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
      onChange={handleFileUpload} />
  </label>
)}
<input
  value={newMessage}
  onChange={e => setNewMessage(e.target.value)}
  onKeyDown={e => e.key === 'Enter' && sendMessage()}
      disabled={starterLimitReached}
      placeholder={starterLimitReached ? ui.messages.starterLimitPlaceholder : ui.messages.messagePlaceholder}
      style={{flex:1,padding:'10px 14px',border:'1px solid #eee',borderRadius:24,fontSize:16,outline:'none',fontFamily:'Plus Jakarta Sans',background: starterLimitReached ? '#f5f5f5' : 'white'}}
    />
    <button onClick={sendMessage} disabled={!newMessage.trim() || starterLimitReached}
      style={{width:40,height:40,borderRadius:'50%',background: newMessage.trim() && !starterLimitReached ? '#E24B4A' : '#eee',border:'none',cursor: newMessage.trim() && !starterLimitReached ? 'pointer' : 'default',color:'white',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      ↑
    </button>
    </div>
  </div>
) : (
  <div style={{padding:'1rem',borderTop:'1px solid #f0f0f0',background:'#FFF5F5',textAlign:'center'}}>
    <p style={{fontSize:13,color:'#E24B4A',fontWeight:600,marginBottom:6}}>{ui.messages.basicOnly}</p>
    <button onClick={() => setActiveTab && setActiveTab('pricing')}
      style={{padding:'8px 20px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
      {ui.messages.upgradeBasic}
    </button>
  </div>
)}
      </div>
    )
  }

  // Vue liste des conversations
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column'}}>
      {longPressMatch && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
          <div style={{background:'white',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:340,textAlign:'center'}}>
            <p style={{fontWeight:700,fontSize:16,marginBottom:'1rem'}}>{getOtherCompany(longPressMatch)?.name}</p>
            <button onClick={async () => {
              await supabase.from('matches').delete().eq('id', longPressMatch.id)
              setMatches(prev => prev.filter(m => m.id !== longPressMatch.id))
              setLongPressMatch(null)
            }}
              style={{width:'100%',padding:'13px',background:'#FFF5F5',color:'#E24B4A',border:'1px solid #FECACA',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:8}}>
              {ui.messages.deleteConversation}
            </button>
            <button onClick={() => setLongPressMatch(null)}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
              {ui.common.cancel}
            </button>
          </div>
        </div>
      )}
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0'}}>
        <h2 style={{fontSize:20,fontWeight:700}}>{ui.messages.title}</h2>
        <p style={{fontSize:13,color:'#999',marginTop:2}}>{ui.messages.subtitle}</p>
      </div>

      {loading ? (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <p style={{color:'#999'}}>{ui.common.loading}</p>
        </div>
      ) : matches.length === 0 ? (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
          <div style={{fontSize:48}}>💬</div>
          <h3 style={{fontSize:18,fontWeight:700}}>{ui.messages.noConnections}</h3>
          <p style={{color:'#999',fontSize:14,lineHeight:1.6}}>{ui.messages.noConnectionsDesc}</p>
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto'}}>
          {matches.map(match => {
            const other = getOtherCompany(match)
            if (!other) return null
            return (
              <div key={match.id} 
                onClick={e => handleConversationClick(match, e)}
                onContextMenu={e => { e.preventDefault(); setLongPressMatch(match) }}
                onMouseDown={e => e.preventDefault()}
                onTouchStart={e => startConversationLongPress(match, e)}
                onTouchMove={moveConversationLongPress}
                onTouchEnd={endConversationLongPress}
                onTouchCancel={endConversationLongPress}
                draggable={false}
                style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f5f5f5',display:'flex',alignItems:'center',gap:12,cursor:'pointer',background:'white',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none'}}
                onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background='white'}
              >
                <div style={{width:48,height:48,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{color:'white',fontWeight:700,fontSize:16}}>
                    {other.name?.substring(0,2).toUpperCase()}
                  </span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <p style={{fontWeight:700,fontSize:15,margin:0}}>{other.name}</p>
                    <span style={{fontSize:11,color:'#999',flexShrink:0}}>{formatDate(match.created_at)}</span>
                  </div>
                  <p style={{fontSize:13,color:'#999',margin:'2px 0 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {other.sector} · {other.city}
                  </p>
                </div>
                <span style={{color:'#ccc',fontSize:18}}>›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
