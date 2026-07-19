import {
  MAX_SERVICE_TAGS,
  addServiceTag,
  formatServiceTag,
  parseServiceTags,
  serviceTagKey,
} from './serviceTags'

test('normalizes and deduplicates service tags', () => {
  expect(parseServiceTags(['#Peinture', ' peinture ', 'Jardinage'])).toEqual(['Peinture', 'Jardinage'])
})

test('limits service tags to ten entries', () => {
  const tags = Array.from({ length: 15 }, (_, index) => `Service ${index + 1}`)
  expect(parseServiceTags(tags)).toHaveLength(MAX_SERVICE_TAGS)
  expect(addServiceTag(parseServiceTags(tags), 'Service supplémentaire')).toHaveLength(MAX_SERVICE_TAGS)
})

test('creates stable matching keys and hashtag labels', () => {
  expect(serviceTagKey('  Réseaux sociaux ')).toBe('reseaux sociaux')
  expect(formatServiceTag('#Comptabilité')).toBe('#Comptabilité')
})
