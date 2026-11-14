import { expect, mock, test } from 'claude-code/testing'

import { TRICKS, draw, front, scene, topicOf } from '../hooks/register'

const text = (rows: ReturnType<typeof front>) => rows.map(row => row.map(([t]) => t).join(''))

test('front pose is the real Clawd', () => {
  expect(text(front({ eyes: 'open', arms: 'down', feet: 'both' }))).toEqual([' ▐▛███▛█ ', '▝▜██████▀', ' ▝▝   ▝▝ '])
})

test('every trick frame is 3 rows of 9 columns', () => {
  for (const keys of Object.values(TRICKS))
    for (const k of keys) {
      const rows = text(draw(k))
      expect(rows).toHaveLength(3)
      for (const r of rows) expect([...r].length).toBe(9)
    }
})

test('prompt topics pick props', () => {
  expect(topicOf('commit and push this')).toBe('computer')
  expect(topicOf('fix the login bug')).toBe('hammer')
  expect(topicOf('deploy to prod')).toBe('rocket')
  expect(topicOf('find where auth is defined')).toBe('magnifier')
  expect(topicOf('thanks!')).toBe('heart')
  expect(topicOf('what is a monad')).toBe('think')
  expect(topicOf('hello')).toBeNull()
})

test('Clawd walks the lane, stops for its activity with a prop, and stays in bounds', () => {
  const range = 30
  const seen = Array.from({ length: 400 }, (_, b) => scene(range, b, 7, 'computer'))
  expect(Math.min(...seen.map(s => s.x))).toBe(0)
  expect(Math.max(...seen.map(s => s.x))).toBe(range)
  expect(seen.some(s => s.prop?.rows[1]?.includes('▒'))).toBe(true)
  for (const s of seen) {
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.x).toBeLessThanOrEqual(range)
    if (s.prop) expect(s.x + 1 + 6).toBeLessThanOrEqual(range)
  }
})

test('no lane means activity and tricks in place', () => {
  const seen = Array.from({ length: 60 }, (_, b) => scene(0, b, 3, 'hammer'))
  expect(new Set(seen.map(s => text(s.rows).join('|'))).size).toBeGreaterThan(3)
  expect(seen.every(s => s.x === 0)).toBe(true)
})

test('typed prompt row is highlighted and shows Clawd', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const ui = await $.ui.mount({
    plugin: 'buddy',
    surface: 'terminal',
    component: 'UserMessage',
    requestId: 'msg-1',
    props: { text: 'fix the login bug', origin: { kind: 'composer' }, isExpanded: true },
  } as never)
  expect(await ui.find({ type: 'Text', text: /fix the login bug/ })).toBeDefined()
  expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { backgroundColor: 'userMessageBackground' } })
  expect(JSON.stringify(await ui.drawn())).not.toMatch(/"marginLeft":-/)
  await ui.unmount()
})
