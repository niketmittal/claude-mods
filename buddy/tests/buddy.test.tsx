import { expect, mock, test } from 'claude-code/testing'

import { COLORS, EARRINGS, OUTFITS, PROPS, SHOW_BEATS, TRICKS, apart, earringFor, setGreetName, showOutfit, bodyFor, draw, front, paint, scene, startBeat, tiny, topicOf, topicsOf } from '../hooks/register'

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
  expect(topicsOf('fix the login bug').map(t => t.prop)).toEqual(['bug', 'lock', 'hammer'])
  expect(topicOf('deploy to prod')).toEqual({ prop: 'rocket', scene: 'space' })
  expect(topicOf('lets go swimming')).toEqual({ scene: 'swim' })
  expect(topicOf('make the css pretty')).toEqual({ prop: 'flower', scene: 'garden' })
  expect(topicOf('thanks!')).toEqual({ prop: 'heart', scene: 'party' })
  expect(topicOf('what is a monad')).toEqual({ prop: 'think' })
  expect(topicOf('explain closures')).toEqual({ outfit: 'graduate', crew: 'class' })
  expect(topicOf('pair with me on this')).toEqual({ crew: 'catch' })
  expect(topicOf('family dinner')).toEqual({ crew: 'family' })
  expect(topicOf('read the docs')).toEqual({ prop: 'book' })
  expect(topicOf('banana')).toBeNull()
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

test('each message has its own clock, even with the same text', () => {
  expect(startBeat('m1', 'coffee?', 100)).toBe(100)
  expect(startBeat('m1', 'coffee?', 500)).toBe(100)
  expect(startBeat('m2', 'coffee?', 900)).toBe(900) // same text sent again later starts fresh
  expect(startBeat('m2-stored', 'coffee?', 905)).toBe(900) // its id changing moments later keeps the start
})

test('the coffee mug is one line tall', () => {
  for (let i = 0; i < 10; i++) {
    const rows = PROPS.coffee?.render(i) ?? []
    const mugRows = rows.filter(r => r.some(c => c.ch === '◗'))
    expect(mugRows).toHaveLength(1)
  }
})

test('what Clawd holds or wears never matches its own color', () => {
  expect(apart('#E0607E', '#E0607E')).not.toBe('#E0607E') // pink umbrella on a pink Clawd
  expect(apart('#E0607E', '#D77757')).not.toBe('#E0607E') // pink on Clawd orange is too close too
  expect(apart('#F5F5F5', '#D77757')).toBe('#F5F5F5') // white mug on orange is fine
  // a pink umbrella's prompt gets a Clawd that is not pink, so the umbrella stays pink
  for (let seed = 0; seed < 8; seed++) expect(['#E0607E', '#D77757']).not.toContain(bodyFor(seed, { prop: 'umbrella' }, { name: 'plain' }))
  const beanie = OUTFITS.find(o => o.name === 'beanie') ?? { name: 'plain' }
  for (const body of COLORS) {
    const s = scene(40, 0, 1, { prop: 'umbrella' })
    const g = paint(s, 49, beanie, body, 0, 1)
    const clawdX = s.x
    // every cell outside Clawd's own columns that is colored must differ from the body color
    g.forEach(row => row.forEach((c, x) => {
      if (x < clawdX || x > clawdX + 8) { if (c.fg && c.ch !== ' ') expect(c.fg).not.toBe(body) }
    }))
    // the hat row over Clawd is not in Clawd's color either
    for (const c of g[0]?.slice(clawdX, clawdX + 9) ?? []) if (c.ch !== ' ' && c.fg) expect(c.fg).not.toBe(body)
  }
})

test('naming an item shows it', () => {
  expect(topicOf('hammer')).toEqual({ prop: 'hammer' })
  expect(topicOf('laptop')).toEqual({ prop: 'computer' })
  expect(topicOf('umbrella?')).toEqual({ prop: 'umbrella', scene: 'rain' })
  expect(topicOf('rocket')).toEqual({ prop: 'rocket', scene: 'space' })
})

test('common asks have their own activity', () => {
  const prop = (text: string) => topicOf(text)?.prop
  expect(prop('yes')).toBe('approve')
  expect(prop('show me the orders page')).toBe('cart')
  expect(prop('remove that file')).toBe('trash')
  expect(prop('the payment failed')).toBe('coins')
  expect(prop('call the api')).toBe('server')
  expect(prop('scan the barcode')).toBe('scanner')
  expect(prop('there is an error')).toBe('bug')
  expect(prop('run it')).toBe('run')
})

test('a prompt with several topics does one per lap, handing over with a sparkle and a puff', () => {
  const topics = topicsOf('check the shop orders')
  expect(topics.map(t => t.prop)).toEqual(['cart', 'magnifier'])
  const lap = 2 * 30 + 10 + 36 + 30
  expect(scene(30, 0, 1, topics).prop).not.toBeNull()
  const props = [0, lap].map(b => JSON.stringify(scene(30, b + 5, 1, topics).prop?.rows))
  expect(props[0]).not.toBe(props[1])
  const first = scene(30, 0, 1, topics).prop?.rows.flat().map(c => c.ch).join('') ?? ''
  expect(first).toContain('✦')
  const last = scene(30, 35, 1, topics).prop?.rows.flat().map(c => c.ch).join('') ?? ''
  expect(last.trim()).toBe('')
})

test('heroes: each has its own move, flying heroes leave the ground, capes stay off Clawd', () => {
  expect(topicOf('be a hero')).toMatchObject({ hero: 'super' })
  expect(topicOf('do it fast')).toMatchObject({ hero: 'speed' })
  expect(topicOf('automate this with an agent')).toMatchObject({ hero: 'robo' })
  const fly = scene(40, 10, 1, { hero: 'super', outfit: 'plain' })
  expect(fly.frame.offset).toBe(-1)
  for (const e of fly.extras) if (e.kind === 'mark') expect(e.x < fly.x || e.x > fly.x + 8).toBe(true)
  const dash = Array.from({ length: 30 }, (_, b) => scene(40, b, 1, { hero: 'speed' }).x)
  expect(new Set(dash).size).toBeGreaterThan(5)
  const vault = Array.from({ length: 36 }, (_, b) => scene(40, b, 1, { hero: 'swing', outfit: 'plain' }))
  expect(vault.some(s => s.frame.offset === -1)).toBe(true) // leaps the crate
  expect(vault[0]?.extras.filter(e => e.kind === 'mark').length).toBe(4)
})

test('fashion show: Clawd stays put, twirls, and wears a new hat every few beats', () => {
  expect(topicOf('show me the hats')).toEqual({ show: true })
  const xs = new Set(Array.from({ length: 60 }, (_, b) => scene(40, b, 1, { show: true }).x))
  expect(xs.size).toBe(1)
  const hats = new Set(Array.from({ length: 10 }, (_, k) => showOutfit(k * SHOW_BEATS).name))
  expect(hats.size).toBe(10)
  expect(hats.has('plain')).toBe(false)
})

test('earrings: about a third of Clawds wear one, on one side of the head only', () => {
  const worn = Array.from({ length: 300 }, (_, k) => earringFor(k * 104729 * 7919)).filter(Boolean).length
  expect(worn).toBeGreaterThan(60)
  expect(worn).toBeLessThan(160)
  const s = scene(30, 40, 1, { prop: 'think' })
  const plain = paint({ ...s, frame: draw({ pose: 'default', offset: 0, x: 0 }) }, 39, { name: 'plain' }, '#D77757', 0, 1)
  const withRing = paint({ ...s, frame: draw({ pose: 'default', offset: 0, x: 0 }) }, 39, { name: 'plain', earring: EARRINGS[0] }, '#D77757', 0, 1)
  const diff = withRing.flatMap((row, y) => row.map((c, x) => [x, y, c.ch, plain[y]?.[x]?.ch] as const)).filter(([, , a, b]) => a !== b)
  expect(diff).toHaveLength(1)
  expect(diff[0]?.[0]).toBe(s.x) // against the left side of the head
  expect(diff[0]?.[1]).toBe(1) // eye row
})

test('the earring shows in every activity pose, arms up or not', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  for (const text of ['yes', 'build', 'teach', 'pair with me']) {
    const ui = await $.ui.mount({
      plugin: 'buddy', surface: 'terminal', component: 'UserMessage', requestId: 'r-' + text,
      props: { text, origin: { kind: 'composer' }, isExpanded: true },
    } as never)
    expect(JSON.stringify(await ui.drawn())).toMatch(/[·°╷]/)
    await ui.unmount()
  }
})

test('every hat and item stands out against the prompt bar', () => {
  const lum = (c: string) => {
    const v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    return 0.2126 * (v[0] ?? 0) + 0.7152 * (v[1] ?? 0) + 0.0722 * (v[2] ?? 0)
  }
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05)
  }
  const BAR = '#373737'
  // Dark detail drawn inside a light frame (a screen, barcode lines, clock hands) is meant to be dark.
  const INSIDE = new Set(['#16232B', '#2A2E37'])
  for (const o of OUTFITS) for (const [, k] of o.hat ?? []) if (k.startsWith('#')) expect([o.name, ratio(k, BAR) >= 2.2]).toEqual([o.name, true])
  for (const [n, p] of Object.entries(PROPS))
    for (let i = 0; i < 30; i++)
      for (const c of p.render(i).flat())
        if (c.fg && !c.bg && c.ch !== ' ' && !INSIDE.has(c.fg)) expect([n, c.fg, ratio(c.fg, BAR) >= 2.2]).toEqual([n, c.fg, true])
})

test('greetings wave hello; prompts with no topic get light, fun items only', () => {
  expect(topicOf('hi')).toEqual({ prop: 'hello' })
  expect(topicOf('hello there')).toEqual({ prop: 'hello' })
  const work = ['scanner', 'server', 'lock', 'trash', 'cart', 'coins', 'chart', 'gears', 'box', 'phone', 'clapper', 'run', 'approve', 'chest', 'bug']
  for (let b = 0; b < 3000; b += 37) {
    const s = scene(40, b, b * 7, null)
    const rows = JSON.stringify(s.prop?.rows ?? null)
    for (const w of work) {
      const sample = JSON.stringify(PROPS[w]?.render(0))
      if (s.prop && sample === rows) throw new Error(`work prop ${w} on a no-topic prompt`)
    }
  }
})

test('saying hi gets a hi back by name', () => {
  setGreetName('niket')
  const text = (PROPS.hello?.render(0) ?? []).map(r => r.map(c => c.ch).join('')).join('|')
  expect(text).toContain('hi,')
  expect(text).toContain('Niket!')
  setGreetName(undefined)
  expect((PROPS.hello?.render(0) ?? []).map(r => r.map(c => c.ch).join('')).join('|')).toContain('hi!')
})
