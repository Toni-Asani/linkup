import {
  CreditCard,
  House,
  Map,
  MessageCircle,
  PanelsTopLeft,
  UserRound,
} from 'lucide-react'

const icons = {
  home: House,
  swipe: PanelsTopLeft,
  map: Map,
  messages: MessageCircle,
  pricing: CreditCard,
  profile: UserRound,
}

export function HubbingIcon({ name, active = false, size = 23 }) {
  const Icon = icons[name]
  if (!Icon) return null

  return (
    <Icon
      size={size}
      strokeWidth={2}
      color={active ? '#E24B4A' : '#4B5563'}
      absoluteStrokeWidth
    />
  )
}
