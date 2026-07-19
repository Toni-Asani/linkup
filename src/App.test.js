import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the Hubbing application loader while restoring the session', () => {
  const { unmount } = render(<App />)
  expect(screen.getByRole('status')).toBeInTheDocument()
  unmount()
})
