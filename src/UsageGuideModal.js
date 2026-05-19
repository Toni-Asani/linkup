import React, { useEffect, useRef, useState } from 'react'
import { HubbingIcon } from './icons'

export default function UsageGuideModal({ t, onClose }) {
  const overlayRef = useRef(null)
  const scrollRef = useRef(null)
  const touchStartYRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const guideColors = ['#E24B4A', '#185FA5', '#16A34A', '#7C3AED', '#F59E0B', '#0F766E']
  const fallbackIcons = ['home', 'swipe', 'map', 'messages', 'profile', 'pricing']
  const pages = t.usageGuidePages?.length
    ? t.usageGuidePages
    : (t.usageGuideSteps || []).map((step, index) => ({
        title: step.title,
        icon: fallbackIcons[index] || 'sparkles',
        summary: step.body,
        sections: [{ title: t.usageGuideTitle, items: [step.body] }],
      }))
  const activePage = pages[Math.min(activeIndex, Math.max(pages.length - 1, 0))] || {}
  const activeColor = activePage.color || guideColors[activeIndex] || '#E24B4A'

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeIndex])

  return (
    <div ref={overlayRef} style={{position:'fixed',inset:0,zIndex:50000,background:'rgba(15,23,42,0.58)',display:'flex',justifyContent:'center',overflow:'hidden',overscrollBehavior:'none'}} role="dialog" aria-modal="true">
      <div style={{width:'100%',maxWidth:430,height:'100dvh',background:'white',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 18px 55px rgba(15,23,42,0.28)'}}>
        <div style={{flexShrink:0,padding:'calc(env(safe-area-inset-top) + 0.9rem) 1rem 0.75rem',borderBottom:'1px solid #E5E7EB',background:'white',zIndex:2}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:12,color:'#E24B4A',fontWeight:800,margin:'0 0 4px'}}>{t.usageGuide}</p>
              <h2 style={{fontSize:22,fontWeight:850,margin:0,color:'#111827',lineHeight:1.12}}>{t.usageGuideTitle}</h2>
            </div>
            <button onClick={onClose} aria-label={t.usageGuideClose}
              style={{width:38,height:38,border:'1px solid #E5E7EB',borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <HubbingIcon name="x" size={18} color="#64748B" />
            </button>
          </div>
          <p style={{fontSize:13,color:'#64748B',lineHeight:1.45,margin:'0.65rem 0 0'}}>{t.usageGuideIntro}</p>
          <div style={{display:'flex',gap:8,overflowX:'auto',padding:'0.85rem 0 0.2rem',WebkitOverflowScrolling:'touch'}}>
            {pages.map((page, index) => {
              const selected = index === activeIndex
              const color = page.color || guideColors[index] || '#E24B4A'
              return (
                <button key={page.title} onClick={() => setActiveIndex(index)}
                  style={{flexShrink:0,minHeight:42,padding:'8px 12px',borderRadius:999,border:selected ? `2px solid ${color}` : '1px solid #E2E8F0',background:selected ? `${color}12` : 'white',color:selected ? color : '#475569',fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
                  <HubbingIcon name={page.icon || fallbackIcons[index] || 'sparkles'} size={16} color={selected ? color : '#64748B'} />
                  {page.title}
                </button>
              )
            })}
          </div>
        </div>

        <div ref={scrollRef} style={{flex:1,minHeight:0,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',padding:'1rem 1rem 1.15rem',background:'#F8FAFC'}}>
          <div style={{background:'white',border:`1px solid ${activeColor}22`,borderRadius:16,padding:'1rem',boxShadow:'0 10px 24px rgba(15,23,42,0.06)',marginBottom:'0.85rem'}}>
            <div style={{width:48,height:48,borderRadius:15,background:`${activeColor}14`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10}}>
              <HubbingIcon name={activePage.icon || fallbackIcons[activeIndex] || 'sparkles'} size={25} color={activeColor} />
            </div>
            <h3 style={{fontSize:20,fontWeight:850,color:'#111827',margin:'0 0 6px',lineHeight:1.2}}>{activePage.title}</h3>
            <p style={{fontSize:14,color:'#475569',lineHeight:1.55,margin:0}}>{activePage.summary}</p>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {(activePage.sections || []).map((section) => (
              <div key={section.title} style={{background:'white',border:'1px solid #E2E8F0',borderRadius:14,padding:'0.95rem'}}>
                <p style={{fontSize:13,fontWeight:850,color:activeColor,margin:'0 0 0.65rem',textTransform:'uppercase',letterSpacing:0}}>{section.title}</p>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(section.items || []).map((item, index) => (
                    <div key={index} style={{display:'grid',gridTemplateColumns:'20px 1fr',gap:8,alignItems:'start'}}>
                      <span style={{width:20,height:20,borderRadius:'50%',background:`${activeColor}12`,color:activeColor,fontSize:12,fontWeight:850,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,marginTop:1}}>{index + 1}</span>
                      <p style={{fontSize:13,color:'#334155',lineHeight:1.5,margin:0}}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {activePage.note && (
            <div style={{marginTop:10,background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:14,padding:'0.9rem'}}>
              <p style={{fontSize:13,color:'#9A3412',lineHeight:1.5,margin:0,fontWeight:700}}>{activePage.note}</p>
            </div>
          )}
        </div>

        <div style={{flexShrink:0,padding:'0.75rem 1rem calc(env(safe-area-inset-bottom) + 0.9rem)',background:'white',borderTop:'1px solid #E5E7EB',boxShadow:'0 -10px 25px rgba(15,23,42,0.08)',zIndex:2}}>
          <button onClick={onClose}
            style={{width:'100%',minHeight:48,padding:'13px 14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:850,cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
            {t.usageGuideClose}
          </button>
        </div>
      </div>
    </div>
  )
}
