import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function MessagesScreen({ user, plan, setSelectedCompanyId, setActiveTab }) {
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
  const messagesEndRef = useRef(null)

  useEffect(() => { loadMyCompanyAndMatches() }, [])

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

  const { data: matchData } = await supabase
    .from('matches')
    .select('*, company_a(*), company_b(*)')
    .or(`company_a.eq.${myComp.id},company_b.eq.${myComp.id}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  setMatches(matchData || [])
  setLoading(false)
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

    if (containsForbiddenContent(reviewComment)) {
      alert('⚠️ Avis non soumis\n\nVotre commentaire contient du contenu inapproprié.')
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

  const forbiddenWords = [
    'sexe','sex','porn','porno','nue','nud','bite','queue','chatte','vagin','penis','seins','cul',
    'baise','baiser','niquer','coucher','érotique','erotic','xxx','escort','prostituée',
    'nègre','negre','youpin','bougnoule','bamboula','bicot','raton','sale arabe','sale noir',
    'sale juif','hitler','nazi','heil','ku klux','kkk','raciste','antisémite',
    'connard','enculé','encule','fdp','ntm','pute','salope','batard','bâtard',
  ]

  const containsForbiddenContent = (text) => {
    const lower = text.toLowerCase()
    return forbiddenWords.some(word => lower.includes(word))
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !myCompany) return
    if (containsForbiddenContent(newMessage)) {
      alert('⚠️ Message non envoyé\n\nVotre message contient du contenu inapproprié (sexuel, raciste ou abusif).\n\nTout abus peut entraîner la suspension de votre compte.')
      return
    }
    const msg = { match_id: selectedMatch.id, sender_id: myCompany.id, content: newMessage.trim() }
    setNewMessage('')
    await supabase.from('messages').insert(msg)
  }

  const getOtherCompany = (match) => {
    if (!myCompany) return null
    return match.company_a?.id === myCompany.id ? match.company_b : match.company_a
  }

  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })

  const isBasicOrPremium = plan === 'Basic' || plan === 'Premium'
  const canSendMessages = plan === 'Basic' || plan === 'Premium'
  const canLeaveReview = isBasicOrPremium && messages.length >= 1

  // Vue conversation
  if (selectedMatch) {
    const other = getOtherCompany(selectedMatch)
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',height:'calc(100vh - 120px)'}}>

        {/* Modal avis */}
        {showReviewModal && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
            <div style={{background:'white',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:360}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                <h3 style={{fontSize:17,fontWeight:700}}>Évaluer {other?.name}</h3>
                <button onClick={() => setShowReviewModal(false)}
                  style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#999'}}>✕</button>
              </div>

              {/* Étoiles */}
              <p style={{fontSize:13,color:'#666',marginBottom:8}}>Note globale *</p>
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
              <p style={{fontSize:13,color:'#666',marginBottom:6}}>Commentaire (optionnel)</p>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Décrivez votre expérience avec cette entreprise..."
                rows={3}
                style={{width:'100%',padding:'10px',border:'1px solid #ddd',borderRadius:10,fontSize:13,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical',marginBottom:'1rem'}}
              />

              <p style={{fontSize:11,color:'#999',marginBottom:'1rem'}}>
                ⚠️ Votre avis sera soumis à modération avant publication. Tout avis abusif entraîne une suspension.
              </p>

              <button onClick={submitReview} disabled={!reviewRating || submittingReview}
                style={{width:'100%',padding:'13px',background: reviewRating ? '#E24B4A' : '#eee',color: reviewRating ? 'white' : '#999',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor: reviewRating ? 'pointer' : 'default'}}>
                {submittingReview ? 'Envoi...' : existingReview ? 'Modifier mon avis' : 'Soumettre mon avis'}
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
  <p style={{fontSize:12,color:'#999',margin:0}}>{other?.sector} · {other?.city} — <span style={{color:'#E24B4A'}}>Voir le profil →</span></p>
</div>
          {/* Bouton avis */}
          {canLeaveReview && (
            <button onClick={() => setShowReviewModal(true)}
              style={{background: existingReview ? '#FFF9F0' : '#FFF5F5',border:`1px solid ${existingReview ? '#FDE8C0' : '#FECACA'}`,borderRadius:20,padding:'6px 10px',cursor:'pointer',fontSize:12,fontWeight:600,color: existingReview ? '#E67E22' : '#E24B4A',flexShrink:0}}>
              {existingReview ? `★ ${existingReview.rating}/5` : '⭐ Évaluer'}
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'1rem',display:'flex',flexDirection:'column',gap:8,background:'#f9f9f9'}}>
          {messages.length === 0 && (
            <div style={{textAlign:'center',padding:'2rem',color:'#999'}}>
              <p style={{fontSize:32,marginBottom:8}}>👋</p>
              <p style={{fontSize:14}}>Début de la conversation avec {other?.name}</p>
              <p style={{fontSize:12,marginTop:4}}>Présentez-vous !</p>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.sender_id === myCompany?.id
            return (
              <div key={msg.id} style={{display:'flex',justifyContent: isMe ? 'flex-end' : 'flex-start'}}>
                <div style={{
                  maxWidth:'75%',padding:'10px 14px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? '#E24B4A' : 'white',
                  color: isMe ? 'white' : '#1a1a1a',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.08)',
                  fontSize:14,lineHeight:1.5
                }}>
                  <p style={{margin:0}}>{msg.content}</p>
                  <p style={{fontSize:10,margin:'4px 0 0',opacity:0.7,textAlign:'right'}}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input message */}
{canSendMessages ? (
  <div style={{padding:'0.75rem 1rem',borderTop:'1px solid #f0f0f0',background:'white',display:'flex',gap:8,alignItems:'center'}}>
    <input
      value={newMessage}
      onChange={e => setNewMessage(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && sendMessage()}
      placeholder="Votre message..."
      style={{flex:1,padding:'10px 14px',border:'1px solid #eee',borderRadius:24,fontSize:14,outline:'none',fontFamily:'Plus Jakarta Sans'}}
    />
    <button onClick={sendMessage} disabled={!newMessage.trim()}
      style={{width:40,height:40,borderRadius:'50%',background: newMessage.trim() ? '#E24B4A' : '#eee',border:'none',cursor: newMessage.trim() ? 'pointer' : 'default',color:'white',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      ↑
    </button>
  </div>
) : (
  <div style={{padding:'1rem',borderTop:'1px solid #f0f0f0',background:'#FFF5F5',textAlign:'center'}}>
    <p style={{fontSize:13,color:'#E24B4A',fontWeight:600,marginBottom:6}}>💬 Messagerie disponible dès le plan Basic</p>
    <button onClick={() => setActiveTab && setActiveTab('pricing')}
      style={{padding:'8px 20px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
      Passer au plan Basic →
    </button>
  </div>
)}
      </div>
    )
  }

  // Vue liste des conversations
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0'}}>
        <h2 style={{fontSize:20,fontWeight:700}}>Messages</h2>
        <p style={{fontSize:13,color:'#999',marginTop:2}}>Vos connexions B2B</p>
      </div>

      {loading ? (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <p style={{color:'#999'}}>Chargement...</p>
        </div>
      ) : matches.length === 0 ? (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
          <div style={{fontSize:48}}>💬</div>
          <h3 style={{fontSize:18,fontWeight:700}}>Pas encore de connexions</h3>
          <p style={{color:'#999',fontSize:14,lineHeight:1.6}}>Swipez des entreprises pour démarrer des conversations !</p>
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto'}}>
          {matches.map(match => {
            const other = getOtherCompany(match)
            if (!other) return null
            return (
              <div key={match.id} onClick={() => setSelectedMatch(match)}
                style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f5f5f5',display:'flex',alignItems:'center',gap:12,cursor:'pointer',background:'white'}}
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