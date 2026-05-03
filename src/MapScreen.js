import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { getCompanyCoordinates } from './geo'
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

export default function MapScreen({ user, setScreen, setSelectedCompanyId, setActiveTab, lang = 'fr' }) {
  const ui = getUiText(lang)
  const [companies, setCompanies] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [filterCanton, setFilterCanton] = useState('')

  useEffect(() => { loadCompanies() }, [])

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
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
  const createIcon = (color) => L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

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

      <div style={{flex:1,minHeight:0,position:'relative'}}>
        <MapContainer
          center={[46.8182, 8.2275]}
          zoom={8}
          style={{height:'100%',width:'100%',minHeight:350}}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {filtered.map(company => (
            <Marker
              key={company.id}
              position={[company.mapLat, company.mapLng]}
              icon={createIcon(sectorColors[company.sector] || '#E24B4A')}
              eventHandlers={{ click: () => setSelected(company) }}
            >
              <Popup>
                <div style={{fontFamily:'Plus Jakarta Sans',minWidth:160}}>
                  {(() => {
                    const activeTags = getActiveTags(company.needs_tags)
                    const hasNeeds = company.needs_description || activeTags.length > 0
                    return (
                      <>
                  <p style={{fontWeight:700,fontSize:14,margin:'0 0 4px'}}>{company.name}</p>
                  <p style={{fontSize:12,color:'#666',margin:'0 0 2px'}}>{company.sector}</p>
                  <p style={{fontSize:12,color:'#999',margin:'0 0 6px'}}>📍 {company.city}, {company.canton}</p>
                  {!company.hasPreciseCoordinates && <p style={{fontSize:11,color:'#999',margin:'0 0 6px'}}>{ui.map.approximatePosition}</p>}
                  {hasNeeds && (
                    <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:8,padding:'6px 8px',margin:'0 0 8px'}}>
                      <p style={{fontSize:11,color:'#E67E22',fontWeight:700,margin:'0 0 4px'}}>{ui.swipe.needs}</p>
                      {company.needs_description && <p style={{fontSize:11,color:'#444',lineHeight:1.35,margin:'0 0 4px'}}>{company.needs_description}</p>}
                      {activeTags.length > 0 && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                          {activeTags.slice(0, 3).map((tag, i) => (
                            <span key={i} style={{background:'white',border:'1px solid #22c55e',borderRadius:20,padding:'2px 6px',fontSize:10,color:'#333'}}>{tag.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!user && (
  <div style={{marginTop:'0.75rem',display:'flex',flexDirection:'column',gap:8}}>
    <button onClick={() => setScreen && setScreen('register')}
      style={{width:'100%',padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
      {ui.map.createAccount}
    </button>
    <button onClick={() => setScreen && setScreen('login')}
      style={{width:'100%',padding:'12px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
      {ui.map.login}
    </button>
  </div>
)}
                      </>
                    )
                  })()}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {selected && (
        <div style={{position:'absolute',left:0,right:0,bottom:34,zIndex:900,padding:'0 0.75rem',pointerEvents:'none'}}>
        <div style={{background:'white',border:'1px solid #f0f0f0',borderRadius:18,boxShadow:'0 -12px 35px rgba(0,0,0,0.14)',maxHeight:'36vh',overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'0.875rem 1rem 1rem',pointerEvents:'auto'}}>
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
              <p style={{fontWeight:700,fontSize:15,margin:0}}>{selected.name}</p>
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
