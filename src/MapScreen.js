import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { getCompanyCoordinates } from './geo'
import { VerifiedBadge, isPremiumCompany } from './VerifiedBadge'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const sectorColors = {
  'Fiduciaire': '#3B6D11',
  'Design & Communication': '#533AB7',
  'Informatique': '#185FA5',
  'Construction': '#854F0B',
  'Marketing Digital': '#993556',
  'Ressources Humaines': '#0F6E56',
  'Transport & Logistique': '#444441',
  'Services': '#993C1D',
}

const getActiveTags = (needs_tags) => {
  try {
    const tags = needs_tags ? JSON.parse(needs_tags) : []
    return tags.filter(t => !t.expires || new Date(t.expires) > new Date())
  } catch { return [] }
}

const DETAIL_PANEL_MAX_HEIGHT = 220

function MapSelectionFocus({ selected }) {
  const map = useMap()

  useEffect(() => {
    if (!selected?.mapLat || !selected?.mapLng) return

    const timeout = window.setTimeout(() => {
      map.invalidateSize()
      map.setView([selected.mapLat, selected.mapLng], Math.max(map.getZoom(), 10), { animate: true })
    }, 120)

    return () => window.clearTimeout(timeout)
  }, [map, selected])

  return null
}

export default function MapScreen({ user, setScreen, setSelectedCompanyId, setActiveTab, lang = 'fr' }) {
  const ui = getUiText(lang)
  const [companies, setCompanies] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [filterCanton, setFilterCanton] = useState('')
  const [mapStyle, setMapStyle] = useState('standard')

  useEffect(() => { loadCompanies() }, [])

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*, subscriptions(plan, status)')
      .eq('is_suspended', false)
      .limit(200)
    const mappedCompanies = (data || [])
      .map(company => {
        const coords = getCompanyCoordinates(company)
        if (!coords) return null
        return {
          ...company,
          mapLat: coords.lat,
          mapLng: coords.lng,
          hasPreciseCoordinates: coords.precise,
        }
      })
      .filter(Boolean)
    setCompanies(mappedCompanies)
  }

  const filtered = companies.filter(c => {
    const matchSector = !filter || c.sector === filter
    const matchCanton = !filterCanton || c.canton === filterCanton
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.sector?.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.canton?.toLowerCase().includes(search.toLowerCase())
    return matchSector && matchCanton && matchSearch
  })

  const sectorCounts = companies.reduce((counts, company) => {
    if (!company.sector) return counts
    counts[company.sector] = (counts[company.sector] || 0) + 1
    return counts
  }, {})
  const sectors = Object.keys(sectorCounts).sort((a, b) => a.localeCompare(b, 'fr'))
const cantons = [
  {code:'AG', name:'Argovie'},
  {code:'AI', name:'Appenzell Rhodes-Intérieures'},
  {code:'AR', name:'Appenzell Rhodes-Extérieures'},
  {code:'BE', name:'Berne'},
  {code:'BL', name:'Bâle-Campagne'},
  {code:'BS', name:'Bâle-Ville'},
  {code:'FR', name:'Fribourg'},
  {code:'GE', name:'Genève'},
  {code:'GL', name:'Glaris'},
  {code:'GR', name:'Grisons'},
  {code:'JU', name:'Jura'},
  {code:'LU', name:'Lucerne'},
  {code:'NE', name:'Neuchâtel'},
  {code:'NW', name:'Nidwald'},
  {code:'OW', name:'Obwald'},
  {code:'SG', name:'Saint-Gall'},
  {code:'SH', name:'Schaffhouse'},
  {code:'SO', name:'Soleure'},
  {code:'SZ', name:'Schwytz'},
  {code:'TG', name:'Thurgovie'},
  {code:'TI', name:'Tessin'},
  {code:'UR', name:'Uri'},
  {code:'VD', name:'Vaud'},
  {code:'VS', name:'Valais'},
  {code:'ZG', name:'Zoug'},
  {code:'ZH', name:'Zurich'},
]
  const createIcon = (color, isSelected = false) => L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${isSelected ? 36 : 28}px;height:${isSelected ? 42 : 28}px;">
      ${isSelected ? '<div style="position:absolute;left:50%;top:-10px;transform:translateX(-50%);font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">📍</div>' : ''}
      <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:${isSelected ? 34 : 28}px;height:${isSelected ? 34 : 28}px;background:${color};border-radius:50%;border:${isSelected ? 4 : 3}px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);"></div>
    </div>`,
    iconSize: [isSelected ? 36 : 28, isSelected ? 42 : 28],
    iconAnchor: [isSelected ? 18 : 14, isSelected ? 25 : 14],
  })
  const isSatellite = mapStyle === 'satellite'

  return (
    <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',width:'100%',maxWidth:'100%',overflow:'hidden',background:'white',position:'relative'}}>

      {!user && (
  <div style={{display:'flex',flexDirection:'column',gap:4}}>
    <button onClick={() => setScreen && setScreen('register')}
      style={{width:'100%',padding:'6px',background:'#E24B4A',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
      {ui.map.createAccount}
    </button>
    <button onClick={() => setScreen && setScreen('login')}
      style={{width:'100%',padding:'6px',background:'white',color:'#E24B4A',border:'1px solid #E24B4A',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
      {ui.map.login}
    </button>
  </div>
)}

      <div style={{padding:'0.75rem 1rem',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
        <div style={{position:'relative'}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14}}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={ui.map.searchPlaceholder}
            style={{width:'100%',padding:'11px 12px 11px 36px',border:'1px solid #eee',borderRadius:10,fontSize:16,lineHeight:1.2,outline:'none',fontFamily:'Plus Jakarta Sans',background:'#f9f9f9',color:'#111'}}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:16}}>
              ✕
            </button>
          )}
        </div>
      </div>

<div style={{padding:'0.5rem 1rem',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
  <select value={filterCanton} onChange={e => setFilterCanton(e.target.value)}
    style={{width:'100%',padding:'10px 12px',border:'1px solid #eee',borderRadius:10,fontSize:16,lineHeight:1.2,outline:'none',background:'#f9f9f9',fontFamily:'Plus Jakarta Sans',color:'#111'}}>
    <option value="">{ui.map.allCantons}</option>
    {cantons.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
  </select>
</div>
      <div style={{padding:'0.5rem 1rem',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
  <select value={filter} onChange={e => setFilter(e.target.value)}
    style={{width:'100%',padding:'10px 12px',border:'1px solid #eee',borderRadius:10,fontSize:16,lineHeight:1.2,outline:'none',background:'#f9f9f9',fontFamily:'Plus Jakarta Sans',color:'#111'}}>
    <option value="">{ui.map.allSectors(companies.length)}</option>
    {sectors.map(s => <option key={s} value={s}>{s} ({sectorCounts[s]})</option>)}
  </select>
</div>

      <div style={{flex:1,minHeight:selected ? 170 : 350,position:'relative'}}>
        <button
          onClick={() => setMapStyle(isSatellite ? 'standard' : 'satellite')}
          style={{position:'absolute',top:10,right:10,zIndex:500,background:'white',color:'#333',border:'1px solid rgba(0,0,0,0.12)',borderRadius:999,padding:'7px 12px',fontSize:12,fontWeight:700,boxShadow:'0 4px 14px rgba(0,0,0,0.16)',cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
          {isSatellite ? ui.map.standardView : ui.map.satelliteView}
        </button>
        <MapContainer
          center={[46.8182, 8.2275]}
          zoom={8}
          style={{height:'100%',width:'100%'}}
        >
          <TileLayer
            key={mapStyle}
            url={isSatellite ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
            attribution={isSatellite ? 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community' : '&copy; OpenStreetMap'}
          />
          <MapSelectionFocus selected={selected} />
          {filtered.map(company => {
            const isSelectedCompany = selected?.id === company.id
            return (
              <Marker
                key={company.id}
                position={[company.mapLat, company.mapLng]}
                icon={createIcon(sectorColors[company.sector] || '#E24B4A', isSelectedCompany)}
                zIndexOffset={isSelectedCompany ? 1000 : 0}
                eventHandlers={{ click: () => setSelected(company) }}
              />
            )
          })}
        </MapContainer>
      </div>

      {selected && (
        <div style={{maxHeight:DETAIL_PANEL_MAX_HEIGHT,flex:'0 0 auto',borderTop:'1px solid #f0f0f0',background:'white',overflow:'hidden'}}>
        <div style={{maxHeight:DETAIL_PANEL_MAX_HEIGHT,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'0.875rem 1rem 1rem'}}>
          {(() => {
            const selectedActiveTags = getActiveTags(selected.needs_tags)
            const selectedHasNeeds = selected.needs_description || selectedActiveTags.length > 0
            return (
              <>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:sectorColors[selected.sector]||'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{color:'white',fontWeight:700,fontSize:14}}>{selected.name.substring(0,2).toUpperCase()}</span>
            </div>
            <div style={{flex:1}}>
              <p style={{fontWeight:700,fontSize:15,margin:0,display:'flex',alignItems:'center',gap:5}}>
                <span>{selected.name}</span>
                {isPremiumCompany(selected) && <VerifiedBadge size={17} />}
              </p>
              <p style={{fontSize:12,color:'#999',margin:'2px 0 0'}}>{selected.sector} · {selected.city}, {selected.canton}</p>
              {!selected.hasPreciseCoordinates && <p style={{fontSize:11,color:'#bbb',margin:'2px 0 0'}}>{ui.map.approximatePosition}</p>}
              {selected.description && <p style={{fontSize:12,color:'#666',margin:'4px 0 0',lineHeight:1.35}}>{selected.description}</p>}
            </div>
            <button onClick={() => setSelected(null)}
              style={{background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:20,flexShrink:0}}>✕</button>
          </div>

          {selectedHasNeeds && (
            <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:12,padding:'0.75rem',marginTop:'0.75rem'}}>
              <p style={{fontSize:12,color:'#E67E22',fontWeight:700,marginBottom:6}}>{ui.swipe.needs}</p>
              {selected.needs_description && (
                <p style={{fontSize:12,color:'#444',lineHeight:1.4,marginBottom: selectedActiveTags.length > 0 ? 8 : 0}}>{selected.needs_description}</p>
              )}
              {selectedActiveTags.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {selectedActiveTags.map((tag, i) => (
                    <span key={i} style={{background:'white',border:'1px solid #22c55e',borderRadius:20,padding:'3px 8px',fontSize:11,fontWeight:500,color:'#333'}}>{tag.label}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{marginTop:'0.75rem',display:'flex',gap:8}}>
            {user ? (
              <button onClick={() => {
                setSelectedCompanyId(selected.id)
                setActiveTab('map')
              }}
                style={{flex:1,padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                {ui.map.viewProfile}
              </button>
            ) : (
              <button onClick={() => setScreen && setScreen('register')}
                style={{flex:1,padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                {ui.map.createAccountToContact(selected.name)}
              </button>
            )}
          </div>
              </>
            )
          })()}
        </div>
        </div>
      )}

      <div style={{padding:'6px',textAlign:'center',background:'#f9f9f9',borderTop:'1px solid #f0f0f0',flexShrink:0}}>
  <span style={{fontSize:12,color:'#999'}}>🏢 {ui.map.registeredCount(companies.length)}</span>
</div>
    </div>
  )
}
