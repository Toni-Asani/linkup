import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function MessagesScreen({ user }) {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [myCompany, setMyCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadMyCompanyAndMatches()
  }, [])

  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch.id)
      const sub = supabase
        .channel('messages-' + selectedMatch.id)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
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

  const loadMyCompanyAndMatches = async () => {
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
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !myCompany) return
    const msg = {
      match_id: selectedMatch.id,
      sender_id: myCompany.id,
      content: newMessage.trim()
    }
    setNewMessage('')
    await supabase.from('messages').insert(msg)
  }

  const getOtherCompany = (match) => {
    if (!myCompany) return null
    return match.company_a?.id === myCompany.id ? match.company_b : match.company_a
  }

  const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
  }

  // Vue conversation
  if (selectedMatch) {
    const other = getOtherCompany(selectedMatch)
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',height:'calc(100vh - 120px)'}}>

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
          <div>
            <p style={{fontWeight:700,fontSize:15,margin:0}}>{other?.name}</p>
            <p style={{fontSize:12,color:'#999',margin:0}}>{other?.sector} · {other?.city}</p>
          </div>
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
                  maxWidth:'75%',padding:'10px 14px',borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
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
                style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f5f5f5',display:'flex',alignItems:'center',gap:12,cursor:'pointer',background:'white',transition:'background 0.15s'}}
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