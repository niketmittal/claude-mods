import { expect, mock, test } from 'claude-code/testing'

import { front, walk } from '../hooks/register'

const text = (f: ReturnType<typeof front>) => f.map(row => row.map(([t]) => t).join(''))

test('front pose is the real Clawd', () => {
  expect(text(front('down', 'open', 'both'))).toEqual([' ▐▛███▛█ ', '▝▜██████▀', ' ▝▝   ▝▝ '])
})

test('Clawd walks the whole lane, turns, walks back', () => {
  const xs = Array.from({ length: 2 * (10 + 5) }, (_, b) => walk(10, b).x)
  expect(Math.min(...xs)).toBe(0)
  expect(Math.max(...xs)).toBe(10)
  expect(walk(10, 3).x).toBe(3)
  expect(walk(10, 15 + 3).x).toBe(7)
  // feet alternate while walking
  expect(text(walk(10, 1).frame)[2]).not.toBe(text(walk(10, 2).frame)[2])
  // every frame is 9 columns wide
  for (let b = 0; b < 40; b++) for (const row of text(walk(10, b).frame)) expect([...row].length).toBe(9)
})

test('no room to walk means dancing in place', () => {
  const frames = new Set(Array.from({ length: 8 }, (_, b) => text(walk(0, b).frame).join('|')))
  expect(frames.size).toBeGreaterThan(2)
})

test('typed prompt row shows Clawd and text', async ($, on) => {
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
  expect(await ui.find({ type: 'Text', text: /▘▘|▝▝/ })).toBeDefined()
  expect(JSON.stringify(await ui.drawn())).not.toMatch(/"marginLeft":-/)
  await ui.unmount()
})
