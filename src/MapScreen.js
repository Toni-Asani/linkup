import { useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { getCompanyCoordinates } from './geo'
import { VerifiedBadge, attachCompanySubscriptions, getCompanyBadgeVariant } from './VerifiedBadge'
import { HubbingIcon } from './icons'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

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
  'Fiduciaire': '#3B6D11',
  'Design & Communication': '#533AB7',
  'Informatique': '#185FA5',
  'Construction': '#854F0B',
  'Marketing Digital': '#993556',
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

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const coordinateKey = (company) => {
  const lat = Number(company?.mapLat)
  const lng = Number(company?.mapLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  return `${lat.toFixed(6)},${lng.toFixed(6)}`
}

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

function MapLocationFocus({ location, focusKey }) {
  const map = useMap()
  const lastFocusKeyRef = useRef(0)

  useEffect(() => {
    if (!location || !focusKey) return
    if (lastFocusKeyRef.current === focusKey) return
    lastFocusKeyRef.current = focusKey
    map.setView([location.lat, location.lng], Math.max(map.getZoom(), 13), { animate: true })
  }, [focusKey, location, map])

  return null
}

export default function MapScreen({ user, setScreen, plan = 'Starter', setSelectedCompanyId, setCompanyProfileReturn, setActiveTab, lang = 'fr' }) {
  const ui = getUiText(lang)
  const [companies, setCompanies] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [filterCanton, setFilterCanton] = useState('')
  const [filterRadius, setFilterRadius] = useState(300)
  const [showRadiusFilter, setShowRadiusFilter] = useState(false)
  const [mapStyle, setMapStyle] = useState('standard')
  const [myCompanyCoords, setMyCompanyCoords] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [locationFocusKey, setLocationFocusKey] = useState(0)
  const locationWatchRef = useRef(null)

  useEffect(() => { loadCompanies() }, [])
  useEffect(() => { loadMyCompanyCoords() }, [user?.id])
  useEffect(() => () => {
    if (locationWatchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchRef.current)
    }
  }, [])

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('is_suspended', false)
      .limit(200)
    if (error) {
      console.warn('Unable to load map companies:', error.message)
      setCompanies([])
      return
    }
    const companiesWithSubscriptions = await attachCompanySubscriptions(supabase, data || [])
    const mappedCompanies = companiesWithSubscriptions
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

  const loadMyCompanyCoords = async () => {
    if (!user?.id) {
      setMyCompanyCoords(null)
      return
    }

    const { data, error } = await supabase
      .from('companies')
      .select('lat, lng, city, canton')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !data) {
      setMyCompanyCoords(null)
      return
    }

    const coords = getCompanyCoordinates(data)
    setMyCompanyCoords(coords ? { lat: coords.lat, lng: coords.lng } : null)
  }

  const startLiveLocation = () => {
    if (locationStatus === 'active' && userLocation) {
      setLocationFocusKey(key => key + 1)
      return
    }
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      return
    }

    setLocationStatus('loading')
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current)
      locationWatchRef.current = null
    }

    let firstFix = true
    locationWatchRef.current = navigator.geolocation.watchPosition(
      position => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
        setUserLocation(nextLocation)
        setLocationStatus('active')
        if (firstFix) {
          setLocationFocusKey(key => key + 1)
          firstFix = false
        }
      },
      error => {
        setLocationStatus(error.code === 1 ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
    )
  }

  const radiusReference = userLocation || myCompanyCoords
  const radiusIsActive = filterRadius < 300 && radiusReference
  const filtered = companies.filter(c => {
    const matchSector = !filter || c.sector === filter
    const matchCanton = !filterCanton || c.canton === filterCanton
    const matchRadius = !radiusIsActive || haversine(radiusReference.lat, radiusReference.lng, c.mapLat, c.mapLng) <= filterRadius
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.sector?.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.canton?.toLowerCase().includes(search.toLowerCase())
    return matchSector && matchCanton && matchRadius && matchSearch
  })

  const sectorCounts = companies.reduce((counts, company) => {
    if (!company.sector) return counts
    counts[company.sector] = (counts[company.sector] || 0) + 1
    return counts
  }, {})
  const sectors = Object.keys(sectorCounts).sort((a, b) => a.localeCompare(b, 'fr'))
  const selectedCoordinateKey = selected ? coordinateKey(selected) : ''
  const selectedCoversUserLocation = Boolean(
    selected &&
    userLocation &&
    haversine(selected.mapLat, selected.mapLng, userLocation.lat, userLocation.lng) < 0.02
  )
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
  const createIcon = (color, isSelected = false) => {
    if (isSelected) {
      return L.divIcon({
        className: '',
        html: `<div style="position:relative;width:30px;height:32px;">
          <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;border-left:15px solid transparent;border-right:15px solid transparent;border-top:28px solid white;filter:drop-shadow(0 2px 7px rgba(0,0,0,0.35));"></div>
          <div style="position:absolute;left:50%;bottom:5px;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:20px solid ${color};"></div>
        </div>`,
        iconSize: [30, 32],
        iconAnchor: [15, 32],
      })
    }

    return L.divIcon({
      className: '',
      html: `<div style="position:relative;width:28px;height:28px;">
        <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:28px;height:28px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);"></div>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
  }
  const isSatellite = mapStyle === 'satellite'
  const openSelectedProfile = () => {
    if (!selected) return
    setCompanyProfileReturn && setCompanyProfileReturn({ tab: 'map' })
    setSelectedCompanyId && setSelectedCompanyId(selected.id)
    setActiveTab && setActiveTab('map')
  }

  const applyRadiusFilter = () => {
    setShowRadiusFilter(false)
  }

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

      {showRadiusFilter && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.45)',zIndex:40000,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 0.75rem) 0 calc(76px + env(safe-area-inset-bottom))'}} onClick={() => setShowRadiusFilter(false)}>
          <div style={{width:'100%',maxWidth:430,background:'white',borderRadius:'20px 20px 0 0',boxShadow:'0 -12px 40px rgba(0,0,0,0.18)',overflow:'hidden'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.25rem 1.5rem 0.75rem'}}>
              <h3 style={{fontSize:18,fontWeight:700,margin:0}}>{ui.map.radius(filterRadius)}</h3>
              <button onClick={() => setShowRadiusFilter(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#999',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <HubbingIcon name="x" size={22} color="#999" />
              </button>
            </div>
            <div style={{padding:'0.5rem 1.5rem 1rem'}}>
              <input type="range" min={5} max={300} step={5} value={filterRadius} onChange={e => setFilterRadius(Number(e.target.value))} style={{width:'100%',accentColor:'#E24B4A'}} />
              <div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:11,color:'#999',marginTop:4}}>
                <span>5 km</span>
                <span style={{textAlign:'right'}}>{ui.map.allSwitzerland}</span>
              </div>
              {filterRadius < 300 && !radiusReference && (
                <div style={{marginTop:12,background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:12,padding:'10px 12px'}}>
                  <p style={{fontSize:12,color:'#B45309',margin:'0 0 8px',lineHeight:1.4}}>{ui.map.radiusNeedsLocation}</p>
                  <button onClick={startLiveLocation}
                    style={{width:'100%',padding:'10px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
                    {locationStatus === 'loading' ? ui.map.locating : ui.map.useMyLocation}
                  </button>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:10,padding:'0.75rem 1.5rem 1.25rem',borderTop:'1px solid #f2f2f2',background:'white'}}>
              <button onClick={() => { setFilterRadius(300); setShowRadiusFilter(false) }} style={{flex:1,padding:'12px',background:'#f5f5f5',color:'#444',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>{ui.swipe.clear}</button>
              <button onClick={applyRadiusFilter} style={{flex:2,padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>{ui.swipe.apply(filtered.length)}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{padding:'0.75rem 1rem',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
        <div style={{position:'relative'}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',display:'flex',alignItems:'center'}}>
            <HubbingIcon name="search" size={16} color="#94A3B8" />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={ui.map.searchPlaceholder}
            style={{width:'100%',padding:'11px 12px 11px 36px',border:'1px solid #eee',borderRadius:10,fontSize:16,lineHeight:1.2,outline:'none',fontFamily:'Plus Jakarta Sans',background:'#f9f9f9',color:'#111'}}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <HubbingIcon name="x" size={16} color="#999" />
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
      <div style={{padding:'0.5rem 1rem',borderBottom:'1px solid #f0f0f0',flexShrink:0,display:'grid',gridTemplateColumns:'minmax(0, 3fr) minmax(74px, 1fr)',gap:8}}>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{width:'100%',minWidth:0,padding:'10px 12px',border:'1px solid #eee',borderRadius:10,fontSize:16,lineHeight:1.2,outline:'none',background:'#f9f9f9',fontFamily:'Plus Jakarta Sans',color:'#111'}}>
          <option value="">{ui.map.allSectors(companies.length)}</option>
          {sectors.map(s => <option key={s} value={s}>{s} ({sectorCounts[s]})</option>)}
        </select>
        <button onClick={() => setShowRadiusFilter(true)}
          style={{width:'100%',minWidth:0,padding:'10px 8px',background:filterRadius < 300 ? '#FFF5F5' : '#f9f9f9',color:filterRadius < 300 ? '#E24B4A' : '#444',border:`1px solid ${filterRadius < 300 ? '#FECACA' : '#eee'}`,borderRadius:10,fontSize:13,lineHeight:1.2,fontWeight:800,cursor:'pointer',fontFamily:'Plus Jakarta Sans',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {ui.map.radiusButton(filterRadius)}
        </button>
      </div>

      <div style={{flex:1,minHeight:selected ? 170 : 350,position:'relative'}}>
        <button
          onClick={startLiveLocation}
          style={{position:'absolute',top:10,left:58,zIndex:500,display:'inline-flex',alignItems:'center',gap:6,background:locationStatus === 'active' ? '#E24B4A' : 'white',color:locationStatus === 'active' ? 'white' : '#333',border:'1px solid rgba(0,0,0,0.12)',borderRadius:999,padding:'7px 12px',fontSize:12,fontWeight:700,boxShadow:'0 4px 14px rgba(0,0,0,0.16)',cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
          <HubbingIcon name="mapPin" size={14} color={locationStatus === 'active' ? 'white' : '#E24B4A'} />
          {locationStatus === 'loading' ? ui.map.locating : ui.map.myLocation}
        </button>
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
          <MapLocationFocus location={userLocation} focusKey={locationFocusKey} />
          {radiusIsActive && (
            <Circle
              center={[radiusReference.lat, radiusReference.lng]}
              radius={filterRadius * 1000}
              pathOptions={{ color: '#E24B4A', fillColor: '#E24B4A', fillOpacity: 0.12, weight: 2 }}
            />
          )}
          {userLocation && !selectedCoversUserLocation && (
            <>
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={Math.min(Math.max(userLocation.accuracy || 30, 25), 1200)}
                pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.08, weight: 1 }}
              />
              <CircleMarker
                center={[userLocation.lat, userLocation.lng]}
                radius={8}
                pathOptions={{ color: 'white', fillColor: '#2563EB', fillOpacity: 1, weight: 3 }}
              />
            </>
          )}
          {filtered.map(company => {
            const isSelectedCompany = selected?.id === company.id
            const hiddenUnderSelection = selectedCoordinateKey && !isSelectedCompany && coordinateKey(company) === selectedCoordinateKey
            if (hiddenUnderSelection) return null
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
            const selectedBadgeVariant = getCompanyBadgeVariant(selected)
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
                {selectedBadgeVariant && <VerifiedBadge size={17} variant={selectedBadgeVariant} />}
              </p>
              <p style={{fontSize:12,color:'#999',margin:'2px 0 0'}}>{selected.sector} · {selected.city}, {selected.canton}</p>
              {!selected.hasPreciseCoordinates && <p style={{fontSize:11,color:'#bbb',margin:'2px 0 0'}}>{ui.map.approximatePosition}</p>}
              {selected.description && <p style={{fontSize:12,color:'#666',margin:'4px 0 0',lineHeight:1.35}}>{selected.description}</p>}
            </div>
            <button onClick={() => setSelected(null)}
              style={{background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:20,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><HubbingIcon name="x" size={20} color="#999" /></button>
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
              <button onClick={openSelectedProfile}
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
  <span style={{fontSize:12,color:'#999',display:'inline-flex',alignItems:'center',gap:4}}>
    <HubbingIcon name="building" size={14} color="#999" /> {ui.map.filteredCount(filtered.length, companies.length)}
  </span>
  {(locationStatus === 'denied' || locationStatus === 'unavailable') && (
    <p style={{fontSize:11,color:'#F39C12',margin:'3px 0 0'}}>
      {locationStatus === 'denied' ? ui.map.locationDenied : ui.map.locationUnavailable}
    </p>
  )}
</div>
    </div>
  )
}
