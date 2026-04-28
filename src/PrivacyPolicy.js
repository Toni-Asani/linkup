import React from 'react'
import { getUiText } from './i18n'

export default function PrivacyPolicy({ setScreen, lang = 'fr' }) {
  const ui = getUiText(lang)
  const p = ui.privacy

  return (
    <div style={{
      height:'100dvh',
      overflowY:'auto',
      overflowX:'hidden',
      WebkitOverflowScrolling:'touch',
      background:'white',
      padding:'calc(env(safe-area-inset-top) + 1rem) 20px calc(env(safe-area-inset-bottom) + 2rem)',
      fontFamily:'Plus Jakarta Sans, sans-serif',
      color:'#333',
      lineHeight:1.7
    }}>
      <div style={{maxWidth:800,margin:'0 auto'}}>
        <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:14,marginBottom:24,padding:'0.25rem 0'}}>
          {ui.common.back}
        </button>

        <img src="/LOGO-HUBBING-ICON.svg" alt="Hubbing" style={{width:60,marginBottom:20,borderRadius:'50%'}} />
        <h1 style={{fontSize:28,fontWeight:700,marginBottom:8}}>{p.title}</h1>
        <p style={{color:'#999',fontSize:13,marginBottom:32}}>{p.updated}</p>

        <Section title={p.introTitle}>{p.intro}</Section>
        <Section title={p.controllerTitle}>
          {p.controller}<br />{p.contact}
        </Section>
        <ListSection title={p.dataTitle} items={p.data} />
        <ListSection title={p.useTitle} items={p.use} />
        <Section title={p.rightsTitle}>{p.rights}</Section>

        <p style={{marginTop:48,fontSize:12,color:'#ccc',textAlign:'center'}}>
          © 2026 Hubbing
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <>
      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>{title}</h2>
      <p>{children}</p>
    </>
  )
}

function ListSection({ title, items }) {
  return (
    <>
      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>{title}</h2>
      <ul style={{paddingLeft:20,lineHeight:2}}>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </>
  )
}
