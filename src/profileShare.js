const WIDTH = 1080
const HEIGHT = 1920

const loadImage = async (url) => {
  if (!url) return null
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) return null
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = objectUrl
    })
    URL.revokeObjectURL(objectUrl)
    return image
  } catch {
    return null
  }
}

const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) => {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  })
  if (line) lines.push(line)
  lines.slice(0, maxLines).forEach((textLine, index) => {
    const value = index === maxLines - 1 && lines.length > maxLines ? `${textLine.replace(/[.,;:!?]+$/,'')}...` : textLine
    ctx.fillText(value, x, y + index * lineHeight)
  })
}

const roundRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export const createCompanyShareImage = async (company, ui) => {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')

  const background = await loadImage(company?.background_url)
  if (background) {
    const scale = Math.max(WIDTH / background.width, HEIGHT / background.height)
    const drawWidth = background.width * scale
    const drawHeight = background.height * scale
    ctx.drawImage(background, (WIDTH - drawWidth) / 2, (HEIGHT - drawHeight) / 2, drawWidth, drawHeight)
    ctx.fillStyle = 'rgba(0,0,0,0.48)'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  } else {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
    gradient.addColorStop(0, '#E24B4A')
    gradient.addColorStop(0.52, '#B91C1C')
    gradient.addColorStop(1, '#111827')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, 70, 120, WIDTH - 140, HEIGHT - 240, 42)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 54px "Plus Jakarta Sans", Arial, sans-serif'
  ctx.fillText('Hubbing', 94, 210)
  ctx.font = '500 30px "Plus Jakarta Sans", Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.fillText(ui?.profile?.shareCardTagline || 'Le réseau B2B suisse', 94, 252)

  const logo = await loadImage(company?.logo_url)
  const logoSize = 250
  const logoX = (WIDTH - logoSize) / 2
  const logoY = 420
  ctx.save()
  ctx.beginPath()
  ctx.arc(WIDTH / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
  ctx.clip()
  if (logo) {
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
  } else {
    ctx.fillStyle = '#E24B4A'
    ctx.fillRect(logoX, logoY, logoSize, logoSize)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 82px "Plus Jakarta Sans", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(company?.name || 'HU').slice(0, 2).toUpperCase(), WIDTH / 2, logoY + logoSize / 2)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(WIDTH / 2, logoY + logoSize / 2, logoSize / 2 + 4, 0, Math.PI * 2)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 66px "Plus Jakarta Sans", Arial, sans-serif'
  drawWrappedText(ctx, company?.name || 'Entreprise Hubbing', 120, 820, WIDTH - 240, 78, 2)

  ctx.font = '500 34px "Plus Jakarta Sans", Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  const subtitle = [company?.sector, company?.city].filter(Boolean).join(' · ')
  if (subtitle) drawWrappedText(ctx, subtitle, 130, 1010, WIDTH - 260, 46, 2)

  const services = company?.description || company?.needs_description || ''
  if (services) {
    ctx.font = '500 36px "Plus Jakarta Sans", Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    drawWrappedText(ctx, services, 130, 1145, WIDTH - 260, 50, 5)
  }

  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 150, 1520, WIDTH - 300, 112, 28)
  ctx.fill()
  ctx.fillStyle = '#E24B4A'
  ctx.font = '800 38px "Plus Jakarta Sans", Arial, sans-serif'
  ctx.fillText(ui?.profile?.shareCardCta || 'Voir le profil sur hubbing.ch', WIDTH / 2, 1590)

  ctx.font = '600 28px "Plus Jakarta Sans", Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fillText('hubbing.ch', WIDTH / 2, 1740)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95))
}

export const shareCompanyProfileCard = async (company, ui) => {
  const blob = await createCompanyShareImage(company, ui)
  if (!blob) throw new Error(ui?.profile?.shareProfileError || 'Impossible de generer le visuel.')
  const fileName = `hubbing-${String(company?.name || 'profil').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
  const file = new File([blob], fileName, { type: 'image/png' })
  const shareText = typeof ui?.profile?.shareText === 'function'
    ? ui.profile.shareText(company?.name || 'Hubbing')
    : (ui?.profile?.shareText || 'Découvrez ce profil Hubbing.')

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: company?.name || 'Hubbing',
      text: shareText,
      files: [file],
    })
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
