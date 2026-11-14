import { expect, mock, test } from 'claude-code/testing'

import { OUTFITS, PROPS, TRICKS, draw, front, paint, scene, topicOf } from '../hooks/register'

const text = (rows: ReturnType<typeof front>) => rows.map(row => row.map(([t]) => t).join(''))
const show = (g: ReturnType<typeof paint>) => g.map(r => r.map(c => c.ch).join(''))

test('front pose is the real Clawd', () => {
  expect(text(front({ eyes: 'open', arms: 'down', feet: 'both' }))).toEqual([' ▐▛███▛█ ', '▝▜██████▀', ' ▝▝   ▝▝ '])
})

test('every trick frame and hat is 9 columns wide', () => {
  for (const keys of Object.values(TRICKS))
    for (const k of keys) for (const r of text(draw(k).rows)) expect([...r].length).toBe(9)
  for (const o of OUTFITS) if (o.hat) expect([...o.hat.map(([t]) => t).join('')].length).toBe(9)
})

test('prompt topics pick props and scenes', () => {
  expect(topicOf('commit and push this')).toEqual({ prop: 'computer' })
  expect(topicOf('fix the login bug')).toEqual({ prop: 'hammer' })
  expect(topicOf('deploy to prod')).toEqual({ prop: 'rocket', scene: 'space' })
  expect(topicOf('lets go swimming')).toEqual({ scene: 'swim' })
  expect(topicOf('make the css pretty')).toEqual({ prop: 'flower', scene: 'garden' })
  expect(topicOf('thanks!')).toEqual({ prop: 'heart', scene: 'party' })
  expect(topicOf('what is a monad')).toEqual({ prop: 'think' })
  expect(topicOf('hello')).toBeNull()
})

test('Clawd walks the lane, stops for its activity with a prop, and stays in bounds', () => {
  const range = 30
  const seen = Array.from({ length: 400 }, (_, b) => scene(range, b, 7, { prop: 'computer' }))
  expect(Math.min(...seen.map(s => s.x))).toBe(0)
  expect(Math.max(...seen.map(s => s.x))).toBe(range)
  expect(seen.some(s => s.prop?.[1]?.some(c => c.ch === '●'))).toBe(true)
  for (const s of seen) {
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.x).toBeLessThanOrEqual(range)
    if (s.prop) expect(s.x + 1 + 8).toBeLessThanOrEqual(range)
  }
})

test('no lane means activity and tricks in place', () => {
  const seen = Array.from({ length: 60 }, (_, b) => scene(0, b, 3, { prop: 'hammer' }))
  expect(new Set(seen.map(s => text(s.frame.rows).join('|'))).size).toBeGreaterThan(3)
  expect(seen.every(s => s.x === 0)).toBe(true)
})

test('hats sit on top, swimming puts waves over the bottom row', () => {
  const girl = OUTFITS.find(o => o.name === 'girl') ?? { name: 'plain' }
  const s = scene(30, 3, 1, { scene: 'swim' })
  const g = show(paint(s, 39, girl, '#D77757', 3, 1))
  expect(g).toHaveLength(4)
  expect(g[3]).toMatch(/^[~≈]+$/)
  const dry = show(paint(scene(30, 3, 1, { prop: 'think' }), 39, girl, '#D77757', 3, 1))
  expect(dry.some(r => r.includes('▚▞'))).toBe(true)
  for (const r of dry) expect([...r].length).toBe(39)
})

test('a prompt keeps its look when its message id changes', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const looks = []
  for (const id of ['pending-1', 'stored-abc']) {
    const ui = await $.ui.mount({
      plugin: 'buddy',
      surface: 'terminal',
      component: 'UserMessage',
      requestId: id,
      props: { text: 'refactor the parser', origin: { kind: 'composer' }, isExpanded: true },
    } as never)
    looks.push(JSON.stringify(await ui.drawn()))
    await ui.unmount()
  }
  expect(looks[0]).toBe(looks[1])
})

test('Clawd never gets a dark background behind solid blocks', () => {
  for (const name of Object.keys(TRICKS))
    for (let b = 0; b < 40; b++) {
      const g = paint(scene(20, b, b, null), 29, OUTFITS[b % OUTFITS.length] ?? { name: 'plain' }, '#D77757', b, 1)
      for (const row of g) for (const c of row) if (c.bg === '#000000') expect(c.ch).not.toBe('█')
    }
})

test('typed prompt row is highlighted and shows Clawd', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  for (const id of ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5', 'msg-6']) {
    const ui = await $.ui.mount({
      plugin: 'buddy',
      surface: 'terminal',
      component: 'UserMessage',
      requestId: id,
      props: { text: 'fix the login bug', origin: { kind: 'composer' }, isExpanded: true },
    } as never)
    expect(await ui.find({ type: 'Text', text: /fix the login bug/ })).toBeDefined()
    expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { backgroundColor: 'userMessageBackground' } })
    await ui.unmount()
  }
})

test('hammer comes down on the nail and the nail sinks', () => {
  const frames = Array.from({ length: 12 }, (_, i) => PROPS.hammer?.render(i).map(r => r.map(c => c.ch).join('')) ?? [])
  expect(frames[0]?.[0]).toContain('▐█▌')
  expect(frames[2]?.[1]).toContain('▐█▌')
  expect(frames[2]?.[0]).toContain('✦')
  expect(frames[0]?.[1]).toContain('┃')
  expect(frames[4]?.[1]).toContain('╻')
})
