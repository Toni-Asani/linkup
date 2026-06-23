import { Fragment, useState, useEffect, useRef } from 'react'
import { Eye, Search, Trash2, X } from 'lucide-react'
import { supabase } from './supabaseClient'
import { getUiText, localeForLang } from './i18n'
import { moderateImageFile, moderateTextContent } from './moderation'
import { VerifiedBadge, attachCompanySubscriptions, getCompanyBadgeVariant } from './VerifiedBadge'
import { HubbingIcon } from './icons'
import { createNotificationAndPush } from './pushDelivery'
import LoadingIndicator from './LoadingIndicator'

const STARTER_DAILY_MESSAGE_LIMIT = 5
const MESSAGE_CHAR_LIMITS = {
  Starter: 100,
  Basic: 1000,
  Premium: 2000,
}
const CONVERSATION_DELETE_ACTION_WIDTH = 96
const CONVERSATION_SWIPE_START_THRESHOLD = 5
const CONVERSATION_VERTICAL_CANCEL_THRESHOLD = 14
const CONVERSATION_DELETE_OPEN_THRESHOLD = 28
const conversationBackgroundStyle = {
  backgroundColor: '#fff8f4',
  backgroundImage: 'linear-gradient(rgba(255,255,255,0.44), rgba(255,255,255,0.44)), url("./FondMessageHubbing-2.png")',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

function CompanyAvatar({ company, size = 48, fontSize = 16 }) {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = company?.name?.substring(0, 2).toUpperCase() || '??'
  const showImage = company?.logo_url && !imageFailed

  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden',border:'1px solid #f1f1f1'}}>
      {showImage ? (
        <img src={company.logo_url} alt={company.name || 'Entreprise'}
          onError={() => setImageFailed(true)}
          style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
      ) : (
        <span style={{color:'white',fontWeight:700,fontSize}}>
          {initials}
        </span>
      )}
    </div>
  )
}

function MessageStatus({ read, ui }) {
  return (
    <span style={{
      marginLeft: 6,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      fontWeight: 800,
      color: read ? '#BFEFFF' : 'rgba(255,255,255,0.82)'
    }}>
      <span style={{letterSpacing: read ? -3 : 0, fontSize: 12, lineHeight: 1}}>
        {read ? '✓✓' : '✓'}
      </span>
      <span>{read ? ui.messages.read : ui.messages.sent}</span>
    </span>
  )
}

export default function MessagesScreen({ user, plan, setSelectedCompanyId, setCompanyProfileReturn, setActiveTab, openMatchWithCompanyId, openMessageDraft, onDirectOpenHandled, onUnreadChange, onActiveMatchChange, lang = 'fr' }) {
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
  const [conversationSubject, setConversationSubject] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [unreadByMatch, setUnreadByMatch] = useState({})
  const [conversationSearch, setConversationSearch] = useState('')
  const [openDeleteMatchId, setOpenDeleteMatchId] = useState(null)
  const [draggingConversation, setDraggingConversation] = useState(null)
  const fileAttachRef = useRef(null)
  const sendingMessageRef = useRef(false)
  const conversationSwipeRef = useRef(null)
  const ignoreConversationClickRef = useRef(false)
  const selectedMatchRef = useRef(null)
  const onUnreadChangeRef = useRef(onUnreadChange)
  const foregroundRefreshTimerRef = useRef(null)

  useEffect(() => { loadMyCompanyAndMatches() }, [])

  useEffect(() => {
    selectedMatchRef.current = selectedMatch
    onActiveMatchChange?.(selectedMatch?.id || null)
    return () => onActiveMatchChange?.(null)
  }, [selectedMatch, onActiveMatchChange])

  useEffect(() => {
    onUnreadChangeRef.current = onUnreadChange
  }, [onUnreadChange])

  useEffect(() => {
    if (!myCompany?.id) return undefined

    const refreshMessagesOnForeground = () => {
      if (document.hidden) return
      window.clearTimeout(foregroundRefreshTimerRef.current)
      foregroundRefreshTimerRef.current = window.setTimeout(async () => {
        await loadMyCompanyAndMatches()
        await onUnreadChangeRef.current?.()
        if (selectedMatchRef.current?.id) {
          await loadMessages(selectedMatchRef.current.id)
        }
      }, 300)
    }

    window.addEventListener('focus', refreshMessagesOnForeground)
    window.addEventListener('pageshow', refreshMessagesOnForeground)
    document.addEventListener('visibilitychange', refreshMessagesOnForeground)

    return () => {
      window.clearTimeout(foregroundRefreshTimerRef.current)
      window.removeEventListener('focus', refreshMessagesOnForeground)
      window.removeEventListener('pageshow', refreshMessagesOnForeground)
      document.removeEventListener('visibilitychange', refreshMessagesOnForeground)
    }
  }, [myCompany?.id])

useEffect(() => {
  if (openMatchWithCompanyId && matches.length > 0) {
    const match = matches.find(m => 
      m.company_a?.id === openMatchWithCompanyId || 
      m.company_b?.id === openMatchWithCompanyId
    )
    if (match) {
      setSelectedMatch(match)
      if (openMessageDraft?.subject) {
        setConversationSubject(openMessageDraft.subject)
        setNewMessage('')
      } else {
        setConversationSubject('')
      }
      onDirectOpenHandled && onDirectOpenHandled()
    }
  }
}, [openMatchWithCompanyId, openMessageDraft, matches, onDirectOpenHandled, ui.messages])

  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch.id)
      checkExistingReview()
      const sub = supabase
        .channel('messages-' + selectedMatch.id)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `match_id=eq.${selectedMatch.id}`
        }, async payload => {
          addMessageIfMissing(payload.new)
          if (myCompany?.id && payload.new.sender_id !== myCompany.id) {
            await markMessagesRead(selectedMatch.id, [payload.new])
            await markNotificationsRead(selectedMatch.id)
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `match_id=eq.${selectedMatch.id}`
        }, payload => {
          setMessages(prev => prev.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } : msg))
        })
        .subscribe()
      return () => supabase.removeChannel(sub)
    }
  }, [selectedMatch, myCompany?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const countByMatch = (items = []) => {
    const grouped = {}
    items.forEach(item => {
      if (!item.match_id) return
      grouped[item.match_id] = (grouped[item.match_id] || 0) + 1
    })
    return grouped
  }

  const mergeUnreadMaps = (...maps) => {
    const merged = {}
    maps.forEach(map => {
      Object.entries(map || {}).forEach(([matchId, count]) => {
        merged[matchId] = Math.max(merged[matchId] || 0, Number(count) || 0)
      })
    })
    return merged
  }

  const loadUnreadNotifications = async (matchList = matches, companyId = myCompany?.id) => {
    const { data: notificationRows, error: notificationError } = await supabase
      .from('notifications')
      .select('match_id')
      .eq('user_id', user.id)
      .in('type', ['new_message', 'new_match'])
      .eq('read', false)

    if (notificationError) {
      console.warn('Unable to load unread notifications:', notificationError.message)
    }

    let unreadMessagesByMatch = {}
    const matchIds = (matchList || []).map(match => match.id).filter(Boolean)
    if (companyId && matchIds.length > 0) {
      const { data: unreadMessages, error: unreadMessagesError } = await supabase
        .from('messages')
        .select('match_id')
        .in('match_id', matchIds)
        .neq('sender_id', companyId)
        .is('read_at', null)
        .or('deleted_for_all.is.null,deleted_for_all.eq.false')

      if (unreadMessagesError) {
        console.warn('Unable to load unread messages:', unreadMessagesError.message)
      } else {
        unreadMessagesByMatch = countByMatch(unreadMessages || [])
      }
    }

    const grouped = mergeUnreadMaps(
      countByMatch(notificationRows || []),
      unreadMessagesByMatch
    )
    setUnreadByMatch(grouped)
    return grouped
  }

  const markNotificationsRead = async (matchId) => {
    if (!matchId) return
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .in('type', ['new_message', 'new_match'])
      .eq('match_id', matchId)
      .eq('read', false)
    if (error) {
      console.warn('Unable to mark notifications as read:', error.message)
      return
    }
    setUnreadByMatch(current => {
      const next = { ...current }
      delete next[matchId]
      return next
    })
    await loadUnreadNotifications()
    await onUnreadChangeRef.current?.()
  }

  useEffect(() => {
    if (!myCompany?.id) return undefined

    loadUnreadNotifications()
    const sub = supabase
      .channel(`message-notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, async payload => {
        const notification = payload.new || payload.old || {}
        if (!['new_message', 'new_match'].includes(notification.type)) return

        if (
          payload.eventType === 'INSERT' &&
          notification.match_id &&
          selectedMatchRef.current?.id === notification.match_id
        ) {
          await loadMessages(notification.match_id)
          await onUnreadChangeRef.current?.()
          return
        }

        await refreshConversationList()
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [myCompany?.id, user.id])

  const getMatchActivityAt = (match) => match?.last_message?.created_at || match?.created_at

  const sortMatchesByActivity = (matchList) => [...(matchList || [])].sort((a, b) =>
    new Date(getMatchActivityAt(b) || 0) - new Date(getMatchActivityAt(a) || 0)
  )

  const sortMatchesByPriority = (matchList, unreadMap = unreadByMatch) => [...(matchList || [])].sort((a, b) => {
    const aUnread = Number(unreadMap?.[a.id] || 0) > 0 ? 1 : 0
    const bUnread = Number(unreadMap?.[b.id] || 0) > 0 ? 1 : 0
    if (aUnread !== bUnread) return bUnread - aUnread
    return new Date(getMatchActivityAt(b) || 0) - new Date(getMatchActivityAt(a) || 0)
  })

  const isMessageVisibleForCompany = (message, companyId) => {
    if (!message || message.deleted_for_all) return false
    const deletedFor = Array.isArray(message.deleted_for) ? message.deleted_for : []
    return !deletedFor.includes(companyId)
  }

  const loadLatestMessagesForMatches = async (matchList, companyId) => {
    const matchIds = (matchList || []).map(match => match.id).filter(Boolean)
    if (matchIds.length === 0) return []

    const { data, error } = await supabase
      .from('messages')
      .select('id, match_id, sender_id, content, attachment_name, created_at, deleted_for, deleted_for_all')
      .in('match_id', matchIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Unable to load latest messages:', error.message)
      return sortMatchesByActivity(matchList)
    }

    const latestByMatch = {}
    ;(data || []).forEach(message => {
      if (latestByMatch[message.match_id]) return
      if (!isMessageVisibleForCompany(message, companyId)) return
      latestByMatch[message.match_id] = message
    })

    return sortMatchesByActivity(matchList.map(match => ({
      ...match,
      last_message: latestByMatch[match.id] || match.last_message || null,
    })))
  }

  const updateMatchLastMessage = (message) => {
    if (!message?.match_id) return
    setMatches(current => sortMatchesByPriority(current.map(match => {
      if (match.id !== message.match_id) return match
      const currentActivity = new Date(getMatchActivityAt(match) || 0).getTime()
      const nextActivity = new Date(message.created_at || 0).getTime()
      if (match.last_message && currentActivity > nextActivity) return match
      return { ...match, last_message: message }
    })))
  }

  const getConversationPreview = (match, other) => {
    const latest = match?.last_message
    if (!latest) return `${other.sector} · ${other.city}`
    const content = latest.attachment_name || latest.content || ui.messages.attachment
    const prefix = latest.sender_id === myCompany?.id ? `${ui.messages.youPrefix} ` : ''
    return `${prefix}${content}`
  }

  const markMessagesRead = async (matchId, messageList = messages) => {
    if (!matchId || !myCompany?.id) return
    const unreadIncomingIds = (messageList || [])
      .filter(msg => msg.sender_id !== myCompany.id && !msg.read_at && !msg.deleted_for_all)
      .map(msg => msg.id)

    if (unreadIncomingIds.length === 0) return

    const { data, error } = await supabase
      .rpc('mark_match_messages_read', { p_match_id: matchId })

    if (error) {
      console.warn('Unable to mark messages as read:', error.message)
      return
    }

    const updatedById = new Map((data || []).map(msg => [msg.id, msg]))
    setMessages(prev => prev.map(msg =>
      updatedById.has(msg.id) ? { ...msg, ...updatedById.get(msg.id) } : msg
    ))
  }

  useEffect(() => {
    const matchIds = matches.map(match => match.id).filter(Boolean)
    if (!myCompany?.id || matchIds.length === 0) return

    const channel = supabase.channel(`message-list-${myCompany.id}-${matchIds.length}`)
    matchIds.forEach(matchId => {
      channel.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      }, async payload => {
        const message = payload.new
        updateMatchLastMessage(message)
        if (selectedMatchRef.current?.id === message.match_id) {
          addMessageIfMissing(message)
          if (message.sender_id !== myCompany.id) {
            await markMessagesRead(message.match_id, [message])
            await markNotificationsRead(message.match_id)
          }
          return
        }
        if (message.sender_id !== myCompany.id) {
          setUnreadByMatch(current => ({
            ...current,
            [message.match_id]: (current[message.match_id] || 0) + 1,
          }))
          window.setTimeout(async () => {
            await loadUnreadNotifications()
            await onUnreadChangeRef.current?.()
          }, 300)
        }
      })
    })
    channel.subscribe()

    return () => supabase.removeChannel(channel)
  }, [myCompany?.id, matches.map(match => match.id).join(',')])

  const notifyMessageRecipient = async (match) => {
    const other = getOtherCompany(match)
    if (!other?.user_id) return
    await createNotificationAndPush({
      user_id: other.user_id,
      type: 'new_message',
      match_id: match.id
    })
  }

const loadMyCompanyAndMatches = async () => {
  // Expirer les matchs sans message après 7 jours
  await supabase.rpc('expire_matches')

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

  const validMatches = (matchData || []).filter(match => {
    const other = match.company_a?.id === myComp.id ? match.company_b : match.company_a
    return other?.id && other.id !== myComp.id
  })
  const companiesInMatches = validMatches.flatMap(match => [match.company_a, match.company_b]).filter(Boolean)
  const companiesWithSubscriptions = await attachCompanySubscriptions(supabase, companiesInMatches)
  const companyById = Object.fromEntries((companiesWithSubscriptions || []).map(company => [company.id, company]))
  const enrichedMatches = validMatches.map(match => ({
    ...match,
    company_a: companyById[match.company_a?.id] || match.company_a,
    company_b: companyById[match.company_b?.id] || match.company_b,
  }))
  const matchesWithActivity = await loadLatestMessagesForMatches(enrichedMatches, myComp.id)
  const unreadMap = await loadUnreadNotifications(matchesWithActivity, myComp.id)
  setMatches(sortMatchesByPriority(matchesWithActivity, unreadMap))
  setLoading(false)
}

  const refreshConversationList = async () => {
    await loadMyCompanyAndMatches()
    await onUnreadChangeRef.current?.()
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
    const loadedMessages = data || []
    setMessages(loadedMessages)
    const latestVisibleMessage = [...loadedMessages]
      .reverse()
      .find(message => isMessageVisibleForCompany(message, myCompany?.id))
    if (latestVisibleMessage) updateMatchLastMessage(latestVisibleMessage)
    await markNotificationsRead(matchId)
    await markMessagesRead(matchId, loadedMessages)
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
    
    const { data: insertedMessage, error: messageError } = await supabase.from('messages').insert({
      match_id: selectedMatch.id,
      sender_id: myCompany.id,
      content: file.name,
      attachment_url: urlData.publicUrl,
      attachment_name: file.name,
      attachment_type: file.type
    }).select().single()
    if (messageError) throw messageError
    if (insertedMessage) addMessageIfMissing(insertedMessage)
    await notifyMessageRecipient(selectedMatch)
    await loadMessages(selectedMatch.id)
  } catch(e) {
    alert(ui.messages.fileUploadError)
  }
  setUploadingFile(false)
  if (fileAttachRef.current) fileAttachRef.current.value = ''
}
  const addMessageIfMissing = (message) => {
    if (!message?.id) return
    setMessages(prev => prev.some(existing => existing.id === message.id) ? prev : [...prev, message])
    updateMatchLastMessage(message)
  }

  const sendMessage = async () => {
    const content = newMessage.trim()
    if (!content || !myCompany || !selectedMatch || sendingMessageRef.current) return
    if (content.length > messageCharLimit) {
      alert(ui.messages.messageTooLong(messageCharLimit))
      return
    }

    sendingMessageRef.current = true
    setSendingMessage(true)

    try {
      let starterCountBeforeSend = dailyMessageCount
      if (isStarter) {
        starterCountBeforeSend = await loadDailyMessageCount(myCompany.id)
        if (starterCountBeforeSend >= STARTER_DAILY_MESSAGE_LIMIT) {
          alert(ui.messages.starterLimitReached)
          return
        }
      }
      const moderation = await moderateTextContent(content, 'message')
      if (!moderation.allowed) {
        alert(moderation.reason === 'direct_contact_info'
          ? ui.messages.directContactBlocked
          : ui.messages.messageBlocked)
        return
      }
      setNewMessage('')
      const msg = { match_id: selectedMatch.id, sender_id: myCompany.id, content }
      const { data, error } = await supabase.from('messages').insert(msg).select().single()
      if (error) throw error
      if (data) {
        addMessageIfMissing(data)
        await notifyMessageRecipient(selectedMatch)
        if (isStarter) {
          const nextCount = starterCountBeforeSend + 1
          setDailyMessageCount(nextCount)
          if (nextCount >= STARTER_DAILY_MESSAGE_LIMIT) {
            alert(ui.messages.starterLimitReached)
          }
        }
      }
    } catch (e) {
      console.warn('Unable to send message:', e?.message || e)
      setNewMessage(current => current || content)
    } finally {
      sendingMessageRef.current = false
      setSendingMessage(false)
    }
  }

  const getOtherCompany = (match) => {
    if (!myCompany) return null
    const other = match.company_a?.id === myCompany.id ? match.company_b : match.company_a
    return other?.id === myCompany.id ? null : other
  }

  useEffect(() => {
    if (selectedMatch && myCompany && !getOtherCompany(selectedMatch)) {
      setSelectedMatch(null)
    }
  }, [selectedMatch, myCompany])

  const locale = localeForLang(lang)
  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const getMessageDateKey = (dateStr) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  }
  const isSameMessageDay = (dateA, dateB) =>
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  const formatMessageDay = (dateStr) => {
    const messageDate = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (isSameMessageDay(messageDate, today)) return ui.messages.today
    if (isSameMessageDay(messageDate, yesterday)) return ui.messages.yesterday

    const options = messageDate.getFullYear() === today.getFullYear()
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    return messageDate.toLocaleDateString(locale, options)
  }

  const isStarter = plan === 'Starter'
  const isBasicOrPremium = plan === 'Basic' || plan === 'Premium'
  const canSendMessages = isStarter || isBasicOrPremium
  const canLeaveReview = isBasicOrPremium && messages.length >= 1
  const starterMessagesRemaining = Math.max(0, STARTER_DAILY_MESSAGE_LIMIT - dailyMessageCount)
  const starterLimitReached = isStarter && starterMessagesRemaining <= 0
  const messageCharLimit = MESSAGE_CHAR_LIMITS[plan] || MESSAGE_CHAR_LIMITS.Starter
  const messageCharsRemaining = Math.max(0, messageCharLimit - newMessage.length)
  const messageLimitReached = newMessage.length >= messageCharLimit

  const openCompanyProfile = (companyId) => {
    if (!companyId) return
    setCompanyProfileReturn && setCompanyProfileReturn({ tab: 'messages', companyId })
    setSelectedCompanyId && setSelectedCompanyId(companyId)
  }

  const getConversationSwipeOffset = (matchId) => {
    if (draggingConversation?.matchId === matchId) return draggingConversation.offset
    return openDeleteMatchId === matchId ? -CONVERSATION_DELETE_ACTION_WIDTH : 0
  }

  const startConversationSwipe = (match, e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)

    conversationSwipeRef.current = {
      matchId: match.id,
      startX: e.clientX,
      startY: e.clientY,
      baseOffset: openDeleteMatchId === match.id ? -CONVERSATION_DELETE_ACTION_WIDTH : 0,
      currentOffset: openDeleteMatchId === match.id ? -CONVERSATION_DELETE_ACTION_WIDTH : 0,
      isSwiping: false,
      moved: false,
    }
  }

  const moveConversationSwipe = (e) => {
    const swipe = conversationSwipeRef.current
    if (!swipe) return

    const deltaX = e.clientX - swipe.startX
    const deltaY = e.clientY - swipe.startY
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    if (!swipe.isSwiping) {
      if (absDeltaX < CONVERSATION_SWIPE_START_THRESHOLD && absDeltaY < CONVERSATION_SWIPE_START_THRESHOLD) return
      if (absDeltaY > CONVERSATION_VERTICAL_CANCEL_THRESHOLD && absDeltaY > absDeltaX * 1.35) {
        conversationSwipeRef.current = null
        return
      }
      if (absDeltaX < CONVERSATION_SWIPE_START_THRESHOLD) return
      swipe.isSwiping = true
    }

    e.preventDefault?.()

    const nextOffset = Math.max(
      -CONVERSATION_DELETE_ACTION_WIDTH,
      Math.min(0, swipe.baseOffset + deltaX)
    )

    swipe.currentOffset = nextOffset
    swipe.moved = true
    ignoreConversationClickRef.current = true
    setDraggingConversation({ matchId: swipe.matchId, offset: nextOffset })
  }

  const endConversationSwipe = () => {
    const swipe = conversationSwipeRef.current
    if (!swipe) return

    const shouldOpen = swipe.currentOffset < -CONVERSATION_DELETE_OPEN_THRESHOLD
    setOpenDeleteMatchId(shouldOpen ? swipe.matchId : null)
    setDraggingConversation(null)

    if (swipe.moved) {
      ignoreConversationClickRef.current = true
      window.setTimeout(() => {
        ignoreConversationClickRef.current = false
      }, 120)
    }

    conversationSwipeRef.current = null
  }

  const cancelConversationSwipe = () => {
    conversationSwipeRef.current = null
    setDraggingConversation(null)
    window.setTimeout(() => {
      ignoreConversationClickRef.current = false
    }, 80)
  }

  const handleDeleteConversation = async (match) => {
    const other = getOtherCompany(match)
    const otherName = other?.name || 'cette entreprise'
    const confirmed = window.confirm(ui.messages.deleteConversationConfirm(otherName))

    if (!confirmed) {
      setOpenDeleteMatchId(null)
      return
    }

    const { error } = await supabase.from('matches').delete().eq('id', match.id)

    if (error) {
      alert(ui.messages.deleteConversationError)
      return
    }

    setMatches(prev => prev.filter(m => m.id !== match.id))
    if (selectedMatch?.id === match.id) setSelectedMatch(null)
    setOpenDeleteMatchId(null)
  }

  const handleConversationClick = (match, e) => {
    if (ignoreConversationClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (openDeleteMatchId) {
      setOpenDeleteMatchId(null)
      if (openDeleteMatchId === match.id) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }

    setConversationSubject('')
    setNewMessage('')
    setSelectedMatch(match)
  }

  const closeConversation = async () => {
    const matchId = selectedMatchRef.current?.id
    setSelectedMatch(null)
    setConversationSubject('')
    setNewMessage('')
    if (matchId) {
      await refreshConversationList()
    }
  }

  const normalizedConversationSearch = conversationSearch.trim().toLowerCase()
  const orderedMatches = sortMatchesByPriority(matches, unreadByMatch)
  const visibleMatches = normalizedConversationSearch
    ? orderedMatches.filter(match => {
      const other = getOtherCompany(match)
      if (!other) return false
      const searchableText = [
        other.name,
        other.sector,
        other.city,
        other.canton,
        getConversationPreview(match, other),
      ].filter(Boolean).join(' ').toLowerCase()
      return searchableText.includes(normalizedConversationSearch)
    })
    : orderedMatches

  // Vue conversation
  if (selectedMatch) {
    const other = getOtherCompany(selectedMatch)
    if (!other) return null
    const otherBadgeVariant = getCompanyBadgeVariant(other)
    const visibleMessages = messages.filter(msg => {
      if (msg.deleted_for_all) return false
      if (msg.deleted_for && msg.deleted_for.includes(myCompany?.id)) return false
      return true
    })
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
          <button onClick={closeConversation}
            style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:20,padding:0}}>
            ←
          </button>
          <CompanyAvatar company={other} size={40} fontSize={14} />
          <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={() => openCompanyProfile(other?.id)}>
  <p style={{fontWeight:700,fontSize:15,margin:0,display:'flex',alignItems:'center',gap:5}}>
    <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{other?.name}</span>
    {otherBadgeVariant && <VerifiedBadge size={15} variant={otherBadgeVariant} />}
  </p>
  <p style={{fontSize:12,color:'#999',margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{other?.sector} · {other?.city}</p>
</div>
          <button onClick={() => openCompanyProfile(other?.id)}
            style={{height:34,display:'inline-flex',alignItems:'center',gap:5,background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:18,padding:'0 10px',cursor:'pointer',fontSize:12,fontWeight:700,color:'#E24B4A',flexShrink:0,fontFamily:'Plus Jakarta Sans'}}>
            <Eye size={14} strokeWidth={2.4} />
            {ui.messages.viewProfileShort}
          </button>
          {/* Bouton avis */}
          {canLeaveReview && (
            <button onClick={() => setShowReviewModal(true)}
              style={{background: existingReview ? '#FFF9F0' : '#FFF5F5',border:`1px solid ${existingReview ? '#FDE8C0' : '#FECACA'}`,borderRadius:20,padding:'6px 10px',cursor:'pointer',fontSize:12,fontWeight:600,color: existingReview ? '#E67E22' : '#E24B4A',flexShrink:0}}>
              {existingReview ? `★ ${existingReview.rating}/5` : ui.messages.evaluate}
            </button>
          )}
        </div>

        {conversationSubject && (
          <div style={{padding:'0.625rem 1rem',background:'#f9f9f9',borderBottom:'1px solid #eeeeee'}}>
            <div style={{maxWidth:520,margin:'0 auto',background:'#f1f3f5',border:'1px solid #e5e7eb',borderRadius:12,padding:'8px 12px',display:'flex',alignItems:'center',justifyContent:'center',gap:6,textAlign:'center'}}>
	              <HubbingIcon name="lock" size={14} color="#555" />
              <p style={{margin:0,fontSize:12,fontWeight:700,color:'#555',lineHeight:1.35}}>
                {ui.messages.needSubjectLabel(conversationSubject)}
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'1rem',display:'flex',flexDirection:'column',gap:8,...conversationBackgroundStyle}}>
	          {visibleMessages.length === 0 && (
	            <div style={{textAlign:'center',padding:'2rem',color:'#999'}}>
	              <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
	                <HubbingIcon name="messages" size={32} color="#9CA3AF" />
	              </div>
	              <p style={{fontSize:14}}>{ui.messages.startConversation(other?.name)}</p>
              <p style={{fontSize:12,marginTop:4}}>{ui.messages.introduce}</p>
            </div>
          )}
          {visibleMessages.map((msg, index) => {
  const isMe = msg.sender_id === myCompany?.id
  const previous = visibleMessages[index - 1]
  const showDateSeparator = !previous || getMessageDateKey(previous.created_at) !== getMessageDateKey(msg.created_at)
  return (
            <Fragment key={msg.id}>
              {showDateSeparator && (
                <div style={{display:'flex',justifyContent:'center',margin:'6px 0 10px'}}>
                  <span style={{background:'rgba(255,255,255,0.72)',color:'#777',borderRadius:999,padding:'5px 10px',fontSize:11,fontWeight:700,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)'}}>
                    {formatMessageDay(msg.created_at)}
                  </span>
                </div>
              )}
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
	  <HubbingIcon name="trash" size={15} color="#c7c7c7" />
	</button>
  <div style={{
    maxWidth:'75%',padding:'10px 14px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? '#E24B4A' : 'white',
                  color: isMe ? 'white' : '#1a1a1a',
                  border: isMe ? '1px solid rgba(226,75,74,0.06)' : '1px solid rgba(15,23,42,0.04)',
                  boxShadow: isMe ? '0 6px 16px rgba(226,75,74,0.18)' : '0 5px 14px rgba(15,23,42,0.10)',
                  fontSize:14,lineHeight:1.5
                }}>
                  {msg.attachment_url ? (
	  <a href={msg.attachment_url} target="_blank" rel="noreferrer"
	    style={{color: 'inherit', display:'flex', alignItems:'center', gap:6, textDecoration:'none'}}>
	    <HubbingIcon name="paperclip" size={17} color="currentColor" />
	    <span style={{textDecoration:'underline', fontSize:13}}>{msg.attachment_name || msg.content}</span>
  </a>
) : (
  <p style={{margin:0}}>{msg.content}</p>
)}
                  <p style={{fontSize:10,margin:'4px 0 0',opacity:0.75,textAlign:'right'}}>
                    {formatTime(msg.created_at)}
                    {isMe && <MessageStatus read={Boolean(msg.read_at)} ui={ui} />}
                  </p>
                </div>
              </div>
            </Fragment>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input message */}
{canSendMessages ? (
  <div style={{padding:'0.75rem 1rem',borderTop:'1px solid #f0f0f0',background:'white'}}>
    {(isStarter || messageLimitReached) && (
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,margin:'0 0 8px'}}>
        {isStarter ? (
          <p style={{fontSize:11,color: starterLimitReached ? '#E24B4A' : '#666',margin:0,fontWeight:600}}>
            {ui.messages.starterDailyLimit(starterMessagesRemaining, STARTER_DAILY_MESSAGE_LIMIT)}
          </p>
        ) : <span />}
        <p style={{fontSize:11,color: messageLimitReached ? '#E24B4A' : '#999',margin:0,fontWeight:600,whiteSpace:'nowrap'}}>
          {newMessage.length}/{messageCharLimit}
        </p>
      </div>
    )}
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
    {plan === 'Premium' && (
	  <label style={{cursor:'pointer',flexShrink:0}}>
	    <span style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center'}}>
	      <HubbingIcon name={uploadingFile ? 'loader' : 'paperclip'} size={22} color="#4B5563" />
	    </span>
    <input ref={fileAttachRef} type="file" style={{display:'none'}}
      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
      onChange={handleFileUpload} />
  </label>
)}
<textarea
  value={newMessage}
  onChange={e => setNewMessage(e.target.value)}
  onKeyDown={e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }}
      disabled={starterLimitReached || sendingMessage}
      maxLength={messageCharLimit}
      placeholder={starterLimitReached ? ui.messages.starterLimitPlaceholder : ui.messages.messagePlaceholder}
      rows={1}
      style={{flex:1,minHeight:40,maxHeight:86,padding:'10px 14px',border:'1px solid #eee',borderRadius:20,fontSize:16,lineHeight:1.25,outline:'none',fontFamily:'Plus Jakarta Sans',background: starterLimitReached ? '#f5f5f5' : 'white',resize:'none'}}
    />
	    <button onClick={sendMessage} disabled={!newMessage.trim() || starterLimitReached || sendingMessage}
	      style={{width:40,height:40,borderRadius:'50%',background: newMessage.trim() && !starterLimitReached && !sendingMessage ? '#E24B4A' : '#eee',border:'none',cursor: newMessage.trim() && !starterLimitReached && !sendingMessage ? 'pointer' : 'default',color:'white',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
	      {sendingMessage ? '…' : <HubbingIcon name="send" size={18} color="white" />}
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
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0'}}>
        <h2 style={{fontSize:20,fontWeight:700}}>{ui.messages.title}</h2>
        <p style={{fontSize:13,color:'#999',marginTop:2}}>{ui.messages.subtitle}</p>
      </div>

      {!loading && matches.length > 0 && (
        <div style={{padding:'0.75rem 1rem',borderBottom:'1px solid #f5f5f5',background:'white'}}>
          <div style={{height:42,border:'1px solid #e5e7eb',borderRadius:14,display:'flex',alignItems:'center',gap:8,padding:'0 12px',background:'#f9fafb'}}>
            <Search size={18} color="#94A3B8" strokeWidth={2.2} />
            <input
              value={conversationSearch}
              onChange={e => setConversationSearch(e.target.value)}
              placeholder={ui.messages.searchPlaceholder}
              style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:16,fontFamily:'Plus Jakarta Sans',color:'#1a1a1a',minWidth:0}}
            />
            {conversationSearch && (
              <button onClick={() => setConversationSearch('')}
                aria-label={ui.common.close}
                style={{width:28,height:28,borderRadius:'50%',border:'none',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#94A3B8',padding:0}}>
                <X size={17} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingIndicator fill />
      ) : matches.length === 0 ? (
	        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
	          <HubbingIcon name="messages" size={48} color="#9CA3AF" />
	          <h3 style={{fontSize:18,fontWeight:700}}>{ui.messages.noConnections}</h3>
          <p style={{color:'#999',fontSize:14,lineHeight:1.6}}>{ui.messages.noConnectionsDesc}</p>
        </div>
      ) : visibleMatches.length === 0 ? (
	        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'0.75rem'}}>
	          <HubbingIcon name="search" size={42} color="#9CA3AF" />
	          <h3 style={{fontSize:17,fontWeight:700}}>{ui.messages.noSearchResults}</h3>
          <p style={{color:'#999',fontSize:13,lineHeight:1.6}}>{ui.messages.searchHint}</p>
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto',padding:'0.55rem 0.75rem 0.75rem',background:'#FAFAFB'}}>
          {visibleMatches.map(match => {
            const other = getOtherCompany(match)
            if (!other) return null
            const unread = unreadByMatch[match.id] || 0
            const otherBadgeVariant = getCompanyBadgeVariant(other)
            const swipeOffset = getConversationSwipeOffset(match.id)
            const isDragging = draggingConversation?.matchId === match.id
            return (
              <div key={match.id}
                draggable={false}
                style={{position:'relative',overflow:'hidden',borderRadius:14,marginBottom:8,background:'#E24B4A',boxShadow:'0 5px 16px rgba(15,23,42,0.08)'}}
              >
                <button
                  onClick={e => {
                    e.stopPropagation()
                    handleDeleteConversation(match)
                  }}
                  aria-label={ui.messages.deleteConversation}
                  style={{position:'absolute',top:0,right:0,bottom:0,width:CONVERSATION_DELETE_ACTION_WIDTH,border:'none',background:'#E24B4A',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}
                >
                  <Trash2 size={18} strokeWidth={2.4} />
                  <span>{ui.messages.deleteConversationAction}</span>
                </button>

                <div
                  onClick={e => handleConversationClick(match, e)}
                  onPointerDown={e => startConversationSwipe(match, e)}
                  onPointerMove={moveConversationSwipe}
                  onPointerUp={endConversationSwipe}
                  onPointerCancel={cancelConversationSwipe}
                  draggable={false}
                  style={{padding:'0.9rem 1rem',display:'flex',alignItems:'center',gap:12,cursor:'pointer',background: unread > 0 ? '#FFF9F9' : 'white',border:'1px solid #F1F5F9',borderRadius:14,userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',touchAction:'pan-y',transform:`translateX(${swipeOffset}px)`,transition:isDragging ? 'none' : 'transform 0.18s ease',position:'relative',zIndex:1}}
                  onMouseEnter={e => {
                    if (unread === 0) e.currentTarget.style.background = '#fafafa'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = unread > 0 ? '#FFF9F9' : 'white'
                  }}
                >
                  <CompanyAvatar company={other} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <p style={{fontWeight:700,fontSize:15,margin:0,display:'flex',alignItems:'center',gap:5,minWidth:0,flex:1}}>
                        <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{other.name}</span>
                        {otherBadgeVariant && <VerifiedBadge size={15} variant={otherBadgeVariant} />}
                      </p>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        {unread > 0 && (
                          <span style={{minWidth:18,height:18,borderRadius:9,background:'#E24B4A',color:'white',fontSize:10,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 5px'}}>
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                        <span style={{fontSize:11,color:'#999'}}>{formatDate(getMatchActivityAt(match))}</span>
                      </div>
                    </div>
                    <p style={{fontSize:13,color:'#999',margin:'2px 0 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {getConversationPreview(match, other)}
                    </p>
                  </div>
                  <span style={{color:'#ccc',fontSize:18}}>›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
