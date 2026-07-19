import { needFromGeneral, needFromTag } from './NeedDetailsComponents'

test('builds a general need with its publication date', () => {
  expect(needFromGeneral({
    needs_description: 'Cherche un paysagiste',
    needs_updated_at: '2026-07-18T10:00:00.000Z',
  })).toEqual({
    key: 'general',
    kind: 'permanent',
    label: 'Cherche un paysagiste',
    description: 'Cherche un paysagiste',
    publishedAt: '2026-07-18T10:00:00.000Z',
  })
})

test('keeps the start and end dates of a dated need', () => {
  expect(needFromTag({
    label: 'Impression de brochures',
    starts: '2026-07-20',
    expires: '2026-08-20',
  }, 'impression-de-brochures')).toEqual({
    key: 'impression-de-brochures',
    kind: 'punctual',
    label: 'Impression de brochures',
    description: 'Impression de brochures',
    starts: '2026-07-20',
    expires: '2026-08-20',
  })
})
