import {
  CreditCard,
  House,
  Map,
  MessageCircle,
  UserRound,
} from 'lucide-react'

function SwipePanelsIcon({ size = 23, color = '#4B5563', strokeWidth = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="7" width="12" height="11" rx="2" />
      <rect x="8" y="4" width="12" height="11" rx="2" />
      <path d="M8 12h8" />
      <path d="m11 9-3 3 3 3" />
      <path d="m13 9 3 3-3 3" />
    </svg>
  )
}

const icons = {
  home: House,
  swipe: SwipePanelsIcon,
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
