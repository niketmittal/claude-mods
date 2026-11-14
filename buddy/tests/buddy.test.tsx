import { expect, mock, test } from 'claude-code/testing'

import { OUTFITS, PROPS, TRICKS, draw, front, paint, scene, tiny, topicOf } from '../hooks/register'

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
  expect(topicOf('explain closures')).toEqual({ outfit: 'graduate', crew: 'class' })
  expect(topicOf('pair with me on this')).toEqual({ crew: 'catch' })
  expect(topicOf('family photo')).toEqual({ crew: 'family' })
  expect(topicOf('read the docs')).toEqual({ prop: 'book' })
  expect(topicOf('hello')).toBeNull()
})

test('Clawd walks the lane, stops for its activity with a prop, and stays in bounds', () => {
  const range = 30
  const seen = Array.from({ length: 400 }, (_, b) => scene(range, b, 7, { prop: 'computer' }))
  expect(Math.min(...seen.map(s => s.x))).toBe(0)
  expect(Math.max(...seen.map(s => s.x))).toBe(range)
  expect(seen.some(s => s.prop !== null)).toBe(true)
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

test('hammer: raised high, then down with a spark, and the nail gets shorter', () => {
  const frame = (i: number) => PROPS.hammer?.render(i).map(r => r.map(c => c.ch).join('')) ?? []
  const nailPixels = (i: number) => (PROPS.hammer?.render(i) ?? []).flat().filter(c => c.fg === '#9A9AA0' || c.bg === '#9A9AA0').length
  expect(frame(0)[0]).toMatch(/█/) // head up top
  expect(frame(3).join('')).toContain('✦')
  expect(frame(0)[0]).not.toMatch(/✦/)
  expect(nailPixels(0)).toBeGreaterThan(nailPixels(3))
})

test('crews: ducklings follow, catch throws a ball, class has a board and students', () => {
  const at = (topic: Parameters<typeof scene>[3], b: number) => scene(60, b, 0, topic)
  const walking = at({ crew: 'family' }, 3)
  expect(walking.extras.filter(e => e.kind === 'tiny')).toHaveLength(2)
  for (const e of walking.extras) if (e.kind === 'tiny') expect(e.x).toBeLessThan(walking.x)

  const laps = Array.from({ length: 200 }, (_, b) => at({ crew: 'catch' }, b))
  const ball = laps.flatMap(s => s.extras.filter(e => e.kind === 'ball'))
  expect(new Set(ball.map(e => (e.kind === 'ball' ? e.x : 0))).size).toBeGreaterThan(5)
  expect(laps.some(s => s.extras.some(e => e.kind === 'friend'))).toBe(true)

  const cls = Array.from({ length: 200 }, (_, b) => at({ crew: 'class' }, b)).find(s => s.extras.some(e => e.kind === 'cells'))
  expect(cls?.extras.filter(e => e.kind === 'tiny').length).toBeGreaterThan(1)
  const g = paint(cls ?? at(null, 0), 69, { name: 'plain' }, '#D77757', 0, 1).map(r => r.map(c => c.ch).join(''))
  expect(g.join('\n')).toContain('┌──────┐')
  expect(g.join('\n')).toContain('▐▛█▛▌')
})

test('tiny Clawd is 5 wide', () => {
  for (const step of [0, 1]) for (const r of tiny(step)) expect([...r.map(([t]) => t).join('')].length).toBe(5)
})

test('every prop frame is 8 wide and 4 tall', () => {
  for (const p of Object.values(PROPS))
    for (let i = 0; i < 30; i++) {
      const rows = p.render(i)
      expect(rows).toHaveLength(4)
      for (const r of rows) expect(r).toHaveLength(8)
    }
})

test('a fresh prompt opens on its activity', () => {
  expect(scene(40, 0, 5, { prop: 'coffee' }).prop).not.toBeNull()
  expect(scene(40, 0, 5, { crew: 'catch' }).extras.some(e => e.kind === 'friend')).toBe(true)
  expect(scene(40, 0, 5, { crew: 'class' }).extras.some(e => e.kind === 'cells')).toBe(true)
})

test('small things are small: mug, camera and book fit beside Clawd at a fraction of its size', () => {
  for (const name of ['coffee', 'camera', 'book', 'trophy']) {
    const cols = new Set((PROPS[name]?.render(0) ?? []).flatMap(r => r.map((c, x) => (c.ch !== ' ' ? x : -1))).filter(x => x >= 0))
    expect(cols.size).toBeLessThanOrEqual(6)
  }
})
