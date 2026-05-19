import React, { useEffect, useRef } from 'react'
import { HubbingIcon } from './icons'

export default function UsageGuideModal({ t, onClose }) {
  const overlayRef = useRef(null)
  const scrollRef = useRef(null)
  const touchStartYRef = useRef(0)
  const guideIcons = ['home', 'swipe', 'map', 'messages', 'profile', 'pricing']
  const guideColors = ['#E24B4A', '#185FA5', '#16A34A', '#7C3AED', '#F59E0B', '#0F766E']
  const steps = t.usageGuideSteps || []

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyWidth = body.style.width
    const scrollY = window.scrollY || window.pageYOffset || 0

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    const overlay = overlayRef.current
    const scrollArea = scrollRef.current

    const preventBackgroundTouch = (event) => {
      if (!scrollArea?.contains(event.target)) {
        event.preventDefault()
      }
    }

    const handleTouchStart = (event) => {
      touchStartYRef.current = event.touches?.[0]?.clientY || 0
    }

    const handleTouchMove = (event) => {
      const currentY = event.touches?.[0]?.clientY || 0
      const deltaY = currentY - touchStartYRef.current
      const atTop = scrollArea.scrollTop <= 0
      const atBottom = Math.ceil(scrollArea.scrollTop + scrollArea.clientHeight) >= scrollArea.scrollHeight

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault()
      }
    }

    overlay?.addEventListener('touchmove', preventBackgroundTouch, { passive: false })
    scrollArea?.addEventListener('touchstart', handleTouchStart, { passive: true })
    scrollArea?.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      overlay?.removeEventListener('touchmove', preventBackgroundTouch)
      scrollArea?.removeEventListener('touchstart', handleTouchStart)
      scrollArea?.removeEventListener('touchmove', handleTouchMove)
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.width = previousBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <div ref={overlayRef} style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.48)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 0.75rem) 0 0',overflow:'hidden',overscrollBehavior:'none',touchAction:'none'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:430,height:'min(92dvh, calc(100dvh - env(safe-area-inset-top) - 0.75rem))',maxHeight:'calc(100dvh - env(safe-area-inset-top) - 0.75rem)',background:'white',borderRadius:'22px 22px 0 0',boxShadow:'0 -18px 55px rgba(15,23,42,0.22)',display:'flex',flexDirection:'column',overflow:'hidden',overscrollBehavior:'contain',touchAction:'auto'}} onClick={event => event.stopPropagation()}>
        <div style={{padding:'1.25rem 1.25rem 0.85rem',borderBottom:'1px solid #F1F5F9',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
            <div>
              <p style={{fontSize:12,color:'#E24B4A',fontWeight:800,margin:'0 0 4px'}}>{t.usageGuide}</p>
              <h2 style={{fontSize:21,fontWeight:800,margin:0,color:'#111827',lineHeight:1.15}}>{t.usageGuideTitle}</h2>
            </div>
            <button onClick={onClose} aria-label={t.usageGuideClose}
              style={{width:36,height:36,border:'1px solid #E5E7EB',borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <HubbingIcon name="x" size={18} color="#64748B" />
            </button>
          </div>
          <p style={{fontSize:13,color:'#64748B',lineHeight:1.5,margin:'0.65rem 0 0'}}>{t.usageGuideIntro}</p>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:5,marginTop:'0.9rem',padding:'0.7rem',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:14,overflowX:'auto'}}>
            {guideIcons.slice(0, 5).map((icon, index) => (
              <div key={icon} style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                <div style={{width:34,height:34,borderRadius:'50%',background:'white',border:'1px solid #E2E8F0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <HubbingIcon name={icon} size={17} color={guideColors[index]} />
                </div>
                {index < 4 && <span style={{fontSize:14,color:'#CBD5E1',fontWeight:800}}>→</span>}
              </div>
            ))}
          </div>
        </div>
        <div ref={scrollRef} style={{flex:1,minHeight:0,padding:'1rem 1.25rem calc(env(safe-area-inset-bottom) + 2rem)',overflowY:'auto',WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',touchAction:'pan-y'}}>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {steps.map((step, index) => (
              <div key={step.title} style={{display:'grid',gridTemplateColumns:'44px 1fr',gap:11,alignItems:'start',padding:'0.85rem',border:'1px solid #EDF2F7',borderRadius:14,background:index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}}>
                <div style={{width:44,height:44,borderRadius:14,background:`${guideColors[index] || '#E24B4A'}14`,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                  <HubbingIcon name={guideIcons[index] || 'sparkles'} size={22} color={guideColors[index] || '#E24B4A'} />
                  {index < steps.length - 1 && (
                    <span style={{position:'absolute',bottom:-17,left:'50%',transform:'translateX(-50%)',color:'#CBD5E1',fontSize:16,fontWeight:800}}>↓</span>
                  )}
                </div>
                <div>
                  <p style={{fontSize:15,fontWeight:800,color:'#111827',margin:'0 0 4px'}}>{step.title}</p>
                  <p style={{fontSize:13,color:'#64748B',lineHeight:1.5,margin:0}}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onClose}
            style={{width:'100%',marginTop:'1rem',padding:'13px 14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
            {t.usageGuideClose}
          </button>
        </div>
      </div>
    </div>
  )
}
