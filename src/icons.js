import {
  CreditCard,
  House,
  Map,
  UserRound,
} from 'lucide-react'

function SwipeGestureIcon({ size = 23, color = '#4B5563', strokeWidth = 2 }) {
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
      <path d="M6.6 4.6H2.8" />
      <path d="m4.6 2.6-2 2 2 2" />
      <path d="M17.4 4.6h3.8" />
      <path d="m19.4 2.6 2 2-2 2" />
      <path d="M8 13V6a1.6 1.6 0 0 1 3.2 0v6.2" />
      <path d="M11.2 10.8a1.45 1.45 0 0 1 2.9 0v2" />
      <path d="M14.1 11.8a1.45 1.45 0 0 1 2.9 0v2" />
      <path d="M17 13a1.45 1.45 0 0 1 2.9 0v3.4a4.6 4.6 0 0 1-4.6 4.6h-4.2a4.7 4.7 0 0 1-3.6-1.7l-4-4.9a1.55 1.55 0 0 1 2.3-2.1L8 14.5" />
    </svg>
  )
}

function MessageDotsIcon({ size = 23, color = '#4B5563', strokeWidth = 2 }) {
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
      <path d="M21 11.6c0 4.4-4 8-9 8a10 10 0 0 1-3.7-.7L3 21l1.8-4.4A7.5 7.5 0 0 1 3 11.6c0-4.4 4-8 9-8s9 3.6 9 8Z" />
      <circle cx="8.5" cy="11.6" r="1" fill={color} stroke="none" />
      <circle cx="12" cy="11.6" r="1" fill={color} stroke="none" />
      <circle cx="15.5" cy="11.6" r="1" fill={color} stroke="none" />
    </svg>
  )
}

const icons = {
  home: House,
  swipe: SwipeGestureIcon,
  map: Map,
  messages: MessageDotsIcon,
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
