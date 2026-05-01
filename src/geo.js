const cantonCoordinates = {
  AG: { lat: 47.3904, lng: 8.0457 },
  AI: { lat: 47.3162, lng: 9.4317 },
  AR: { lat: 47.3665, lng: 9.3001 },
  BE: { lat: 46.948, lng: 7.4474 },
  BL: { lat: 47.484, lng: 7.7319 },
  BS: { lat: 47.5596, lng: 7.5886 },
  FR: { lat: 46.8065, lng: 7.1619 },
  GE: { lat: 46.2044, lng: 6.1432 },
  GL: { lat: 47.0406, lng: 9.0672 },
  GR: { lat: 46.6566, lng: 9.578 },
  JU: { lat: 47.3444, lng: 7.1431 },
  LU: { lat: 47.0502, lng: 8.3093 },
  NE: { lat: 46.9896, lng: 6.9293 },
  NW: { lat: 46.9267, lng: 8.3849 },
  OW: { lat: 46.8779, lng: 8.2512 },
  SG: { lat: 47.4245, lng: 9.3767 },
  SH: { lat: 47.6965, lng: 8.6339 },
  SO: { lat: 47.2088, lng: 7.5323 },
  SZ: { lat: 47.0207, lng: 8.6541 },
  TG: { lat: 47.5665, lng: 9.1084 },
  TI: { lat: 46.3317, lng: 8.8005 },
  UR: { lat: 46.7739, lng: 8.6025 },
  VD: { lat: 46.5613, lng: 6.5368 },
  VS: { lat: 46.2331, lng: 7.3606 },
  ZG: { lat: 47.1662, lng: 8.5155 },
  ZH: { lat: 47.3769, lng: 8.5417 },
}

const cityCoordinates = {
  aigle: { lat: 46.3181, lng: 6.9646 },
  aubonne: { lat: 46.4954, lng: 6.3917 },
  biel: { lat: 47.1368, lng: 7.2468 },
  bienne: { lat: 47.1368, lng: 7.2468 },
  bulle: { lat: 46.6179, lng: 7.0565 },
  carouge: { lat: 46.1841, lng: 6.1396 },
  chauxdefonds: { lat: 47.1035, lng: 6.8328 },
  chavannes: { lat: 46.533, lng: 6.5719 },
  fribourg: { lat: 46.8065, lng: 7.1619 },
  geneve: { lat: 46.2044, lng: 6.1432 },
  gland: { lat: 46.4208, lng: 6.2701 },
  lausanne: { lat: 46.5197, lng: 6.6323 },
  lutry: { lat: 46.502, lng: 6.6865 },
  martigny: { lat: 46.1028, lng: 7.0726 },
  meyrin: { lat: 46.2342, lng: 6.0803 },
  montreux: { lat: 46.4312, lng: 6.9107 },
  morgins: { lat: 46.2376, lng: 6.8523 },
  morges: { lat: 46.5088, lng: 6.4961 },
  neuchatel: { lat: 46.9896, lng: 6.9293 },
  nyon: { lat: 46.3833, lng: 6.2348 },
  payerne: { lat: 46.822, lng: 6.9389 },
  prilly: { lat: 46.5362, lng: 6.6047 },
  renens: { lat: 46.5399, lng: 6.5881 },
  sion: { lat: 46.2331, lng: 7.3606 },
  vevey: { lat: 46.4628, lng: 6.8419 },
  vuarrens: { lat: 46.6871, lng: 6.6472 },
  yverdonlesbains: { lat: 46.7785, lng: 6.6412 },
  zurich: { lat: 47.3769, lng: 8.5417 },
}

const normalizeLocationKey = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export const hasValidCoordinates = (lat, lng) => {
  const parsedLat = Number(lat)
  const parsedLng = Number(lng)
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
}

export const getFallbackCoordinates = ({ city, canton }) => {
  const cityKey = normalizeLocationKey(city)
  if (cityKey && cityCoordinates[cityKey]) return cityCoordinates[cityKey]
  if (canton && cantonCoordinates[canton]) return cantonCoordinates[canton]
  return null
}

export const getCompanyCoordinates = (company) => {
  if (hasValidCoordinates(company?.lat, company?.lng)) {
    return { lat: Number(company.lat), lng: Number(company.lng), precise: true }
  }
  const fallback = getFallbackCoordinates(company || {})
  if (!fallback) return null
  return { ...fallback, precise: false }
}

export const geocodeSwissAddress = async ({ address, npa, city, canton }) => {
  const fallback = getFallbackCoordinates({ city, canton })
  const query = [address, npa, city, canton, 'Switzerland'].filter(Boolean).join(', ')
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`)
    const data = await response.json()
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      }
    }
  } catch (error) {
    console.log('Geocoding service unavailable:', error)
  }
  return fallback
}
