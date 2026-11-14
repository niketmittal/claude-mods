import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const beat = atom({ plugin: 'buddy', key: 'beat' } as const, 0)

const BEAT_MS = 180
const W = 9
const PROP_W = 8
const EYE_BG = '#000000'
const BAR_BG = 'userMessageBackground'

type Cell = { ch: string; fg?: string; bg?: string }

// ---------------------------------------------------------------------------
// Clawd's sprite, as Claude Code draws it.
// A span is [text, kind]: 'n' body, 'e' eye (dark showing through the glyph's gaps),
// 'l' eyelid (dark on body), or a '#rrggbb' color for an accessory.
type Span = [string, string]
type Rows = Span[][]

type Eyes = 'open' | 'left' | 'right' | 'closed' | 'wink'
type Arms = 'down' | 'up' | 'one-up' | 'type'
type Feet = 'both' | 'left' | 'right'
type Pose = { eyes: Eyes; arms: Arms; feet: Feet }

const ARMS: Record<Arms, { r1L: string; r1R: string; r2L: string; r2R: string }> = {
  down: { r1L: ' ▐', r1R: '', r2L: '▝▜', r2R: '█▀' },
  up: { r1L: '▗▟', r1R: '▄', r2L: ' ▜', r2R: '█▘' },
  'one-up': { r1L: ' ▐', r1R: '▄', r2L: '▝▜', r2R: '█▘' },
  type: { r1L: ' ▐', r1R: '', r2L: '▝▜', r2R: '█▄' }, // hand pressed down on a keyboard
}
const EYES: Record<Eyes, Span[]> = {
  open: [['▛███▛█', 'e']],
  left: [['▟███▟█', 'e']],
  right: [['█▟███▟', 'e']],
  closed: [['▂', 'l'], ['███', 'e'], ['▂', 'l'], ['█', 'e']],
  wink: [['▛███', 'e'], ['▂', 'l'], ['█', 'e']],
}
const FEET: Record<Feet, string> = { both: ' ▝▝   ▝▝ ', left: ' ▝▝      ', right: '      ▝▝ ' }

// Turn frames: [glyphs, eyeFrom, eyeTo] per row.
const FACING: Record<string, [string, number, number][]> = {
  'right-12': [[' ▐█▜██▛█ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
  'right-30': [['  █▛██▛▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
  'right-55': [['  ▐█▛█▜  ', 3, 7], ['  ▐████  ', 3, 7], ['  ▝▝ ▝▝  ', 0, 0]],
  'right-75': [['   ██▛▌  ', 3, 6], ['   ███▌  ', 3, 6], ['   ▘  ▘  ', 0, 0]],
  edge: [['   ▐██   ', 4, 6], ['   ▐██   ', 4, 6], ['   ▝ ▝   ', 0, 0]],
  'back-105': [['   ███▌  ', 3, 6], ['   ███▌  ', 3, 6], ['   ▘  ▘  ', 0, 0]],
  'back-125': [['  ▐████  ', 3, 7], ['  ▐████  ', 3, 7], ['  ▝▝ ▝▝  ', 0, 0]],
  'back-150': [['  █████▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
  back: [[' ▐██████ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
  'left-75': [['   ▛██▌  ', 3, 6], ['   ███▌  ', 3, 6], ['   ▘  ▘  ', 0, 0]],
  'left-55': [['  ▐▜▛██  ', 3, 7], ['  ▐████  ', 3, 7], ['  ▝▝ ▝▝  ', 0, 0]],
  'left-30': [['  ▛██▛█▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
  'left-12': [[' ▐▛███▜█ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
}
const STRIDE = ['  ▘▘     ', '      ▘▘ ']
// Air: an empty row Clawd can jump or sink into; 'x' cells are see-through.
const BLANK: Span[] = [[' '.repeat(W), 'x']]

const pad = (spans: Span[]): Span[] => {
  const len = spans.reduce((n, [t]) => n + [...t].length, 0)
  return len < W ? [...spans, [' '.repeat(W - len), 'n']] : spans
}

export const front = ({ eyes, arms, feet }: Pose): Rows => {
  const a = ARMS[arms]
  return [pad([[a.r1L, 'n'], ...EYES[eyes], [a.r1R, 'n']]), [[a.r2L, 'n'], ['█████', 'n'], [a.r2R, 'n']], [[FEET[feet], 'n']]]
}

export const facing = (name: string, stride: number | null = null): Rows => {
  const rows = FACING[name] ?? FACING['right-30'] ?? []
  const row = (i: number, mid: string): Span[] => {
    const [g, from, to] = rows[i] ?? ['', 0, 0]
    const cs = [...g]
    return [[cs.slice(0, from).join(''), 'n'], [cs.slice(from, to).join(''), mid], [cs.slice(to).join(''), 'n']]
  }
  return [row(0, 'e'), row(1, 'n'), stride === null ? row(2, 'n') : [[STRIDE[stride % 2] ?? '', 'n']]]
}

// A tiny Clawd (kids, students): a head with two eyes on little stepping legs.
export const tiny = (step: number): Rows => [
  [['▐', 'n'], ['▛', 'e'], ['█', 'n'], ['▛', 'e'], ['▌', 'n']], // eyes like the big Clawd's
  [[step % 2 ? ' ▘ ▝ ' : ' ▝ ▘ ', 'n']],
]

// Shift rows down (offset > 0, sinking) or up (offset < 0) inside a window of h rows.
const shift = (rows: Rows, offset: number, h = rows.length): Rows => {
  const o = Math.max(-h, Math.min(h, offset))
  return o >= 0 ? [...Array(o).fill(BLANK), ...rows].slice(0, h) : [...rows.slice(-o), ...Array(-o).fill(BLANK)].slice(0, h)
}

// ---------------------------------------------------------------------------
// Clawd's own tricks from Claude Code, as keyframes: a pose, how far it sinks
// (offset), how far it slides (x) and a puff of dust (poof).
type Key = { pose: string | Pose | { facing: string }; offset: number; x: number; poof?: 'dot' | 'wave' }

const so = (eyes: Eyes, arms: Arms = 'down', feet: Feet = 'both'): Pose => ({ eyes, arms, feet })
const NAMED: Record<string, Pose> = {
  default: so('open'),
  'arms-up': so('open', 'up'),
  'look-left': so('left'),
  'look-right': so('right'),
}
const Se = (pose: Key['pose'], n: number, o: { offset?: number; x?: number; poof?: 'dot' | 'wave' } = {}): Key[] =>
  Array.from({ length: n }, () => ({ pose, offset: o.offset ?? 0, x: o.x ?? 0, poof: o.poof }))
const Mr = (fs: string[]): Key[] => fs.flatMap(f => Se({ facing: f }, 1))
const Cr = (): Key[] => [...Se('default', 1, { offset: 1, poof: 'dot' }), ...Se('default', 1, { offset: 1, poof: 'wave' })]
const NO: Key = { pose: 'default', offset: 0, x: 0 }
const Ss: Key[] = [...Se(so('closed'), 1), NO]

const hop = (): Key[] => [...Cr(), ...Se('arms-up', 2, { offset: -1 }), ...Se('arms-up', 1), ...Se('default', 1)]
const jump = [...hop(), ...hop()]
export const TRICKS: Record<string, Key[]> = {
  jump,
  look: [...Se('look-right', 5), ...Se('look-left', 5), ...Se('default', 1)],
  celebrate: [...jump, ...Se('default', 3, { offset: 1 })],
  spin: [...Se('look-left', 2), ...Se('look-right', 2), ...Se('look-left', 2), ...Se('arms-up', 3), ...Se('default', 1)],
  skip: [
    ...Se('arms-up', 2, { x: -6, offset: -1 }), ...Se('default', 1, { x: -6 }), ...Se('default', 1, { offset: 1, x: -6 }),
    ...Se('arms-up', 2, { x: -3, offset: -1 }), ...Se('default', 1, { x: -3 }), ...Se('default', 1, { offset: 1, x: -3 }),
    ...Se('arms-up', 2, { offset: -1 }), ...Cr(), ...Se('default', 1),
  ],
  peekaboo: [
    ...Se('default', 1, { offset: 3 }), ...Se('default', 3, { offset: 2 }), ...Se('look-right', 3, { offset: 2 }),
    ...Se('look-left', 3, { offset: 2 }), ...Se('default', 2, { offset: 2 }), ...Se('default', 1, { offset: 1 }),
    ...Se('arms-up', 4), ...Se('default', 2), ...Ss,
  ],
  drop: [...Se('arms-up', 1, { offset: -3 }), ...Se('arms-up', 2, { offset: -2 }), ...Se('arms-up', 2, { offset: -1 }), ...Se('arms-up', 1), ...Cr(), ...Se('default', 3), ...Ss],
  waddle: [...[-6, -5, -4, -3, -2, -1].flatMap(l => Se(so('right', 'down', l % 2 === 0 ? 'left' : 'right'), 2, { x: l })), ...Se('look-right', 2), ...Se('default', 2), ...Ss],
  wink: [...Se(so('wink'), 5), NO],
  boop: [...Se(so('closed'), 1, { offset: 1, poof: 'dot' }), ...Se(so('closed'), 2, { offset: 1, poof: 'wave' }), ...Se('look-left', 4), ...Se('default', 2), ...Ss],
  tap: [
    ...Se(so('open', 'down', 'left'), 2), ...Se(so('open', 'down', 'right'), 2), ...Se(so('open', 'down', 'left'), 2),
    ...Se(so('open', 'down', 'right'), 2), ...Se(so('open', 'down', 'left'), 1), ...Se(so('open', 'down', 'right'), 1), ...Se('arms-up', 3), NO,
  ],
  sneeze: [...Se(so('closed', 'up'), 4), ...Se(so('closed'), 2, { offset: 1, poof: 'wave' }), ...Se(so('closed'), 2), ...Se('default', 2), ...Ss],
  turn: [...Mr(['right-12', 'right-30', 'right-55', 'right-75', 'edge']), ...Mr(['back-105', 'back-125', 'back-150', 'back', 'back']), ...Mr(['back-150', 'back-125', 'back-105', 'edge']), ...Mr(['left-75', 'left-55', 'left-30', 'left-12']), NO],
  'coin-hop': [...Se('default', 2, { offset: 1 }), ...Se('arms-up', 1, { offset: -1 }), ...[...Mr(['right-55', 'edge', 'back-125', 'back']), ...Mr(['back-125', 'edge', 'left-55'])].map(k => ({ ...k, offset: -1 })), ...Se('arms-up', 1), ...Cr(), NO],
  wave: [...[0, 1, 2, 3].flatMap(() => [...Se(so('open', 'one-up'), 2), ...Se('default', 1)]), NO],
  shiver: [...Array.from({ length: 10 }, (_, k) => Se(so('closed'), 1, { x: k % 2 })).flat(), ...Se('arms-up', 2), NO],
  moonwalk: [
    ...[0, -1, -2, -3, -4, -5].flatMap(x => Se({ facing: 'right-30' }, 2, { x })),
    ...Se('arms-up', 2, { x: -5 }),
    ...[-5, -4, -3, -2, -1, 0].flatMap(x => Se({ facing: 'right-12' }, 1, { x })),
    NO,
  ],
  bounce: [...[1, -1, 1, -1, 1, -1].flatMap(o => Se(o > 0 ? 'default' : 'arms-up', 2, { offset: o })), NO],
  doze: [...Se(so('closed'), 4), ...Se(so('closed'), 4, { offset: 1 }), ...Se('arms-up', 2), ...Se('look-left', 2), ...Se('look-right', 2), NO],
  dab: [...Se(so('left', 'one-up'), 4), ...Se(so('right', 'up'), 4), NO],
}
const TRICK_NAMES = Object.keys(TRICKS)

const POOF = { dot: '  ·   ·  ', wave: ' ˚     ˚ ' }

// A frame of Clawd before it is dressed and placed: rows, how far it sinks, any dust.
export type Frame = { rows: Rows; offset: number; poof?: 'dot' | 'wave' }

export const draw = (k: Key): Frame => {
  const p = k.pose
  const rows = typeof p === 'string' ? front(NAMED[p] ?? so('open')) : 'facing' in p ? facing(p.facing) : front(p)
  return { rows, offset: k.offset, poof: k.poof }
}

// ---------------------------------------------------------------------------
// Outfits: headwear picked per prompt, so each prompt's Clawd is recognisable.
// The hat row sits above the head; hatAlt, if any, alternates with it.
type Outfit = { name: string; hat?: Span[]; hatAlt?: Span[] }

const HAIR = '#8B5A2B'
const BLONDE = '#F2D04B'
const PINK = '#FF7EB6'
const PURPLE = '#6A4FC8'
const RED = '#D7263D'
export const OUTFITS: Outfit[] = [
  { name: 'plain' },
  { name: 'top hat', hat: [[' ▁▟███▙▁ ', '#9A9AA0']] },
  { name: 'party hat', hat: [['    ▟▙   ', '#E0607E']] },
  { name: 'crown', hat: [['  ▙▟▙▟▙  ', '#F2C744']] },
  { name: 'girl', hat: [['  ▄▄▄▄▄', HAIR], ['▚▞', PINK]] },
  { name: 'blonde girl', hat: [['  ▄▄▄▄▄', BLONDE], ['✿ ', PINK]] },
  { name: 'pigtails', hat: [['▗▖▄▄▄▄▄▗▖', HAIR]] },
  { name: 'princess', hat: [['  ▄▄', HAIR], ['▴▲▴', '#F2C744'], ['▄▄', HAIR]] },
  { name: 'beanie', hat: [['  ▗▄█▄▖  ', '#4FA3E0']] },
  { name: 'cowboy', hat: [['▁▁▟███▙▁▁', '#A0522D']] },
  { name: 'halo', hat: [['  ╺━━━╸  ', '#F2D04B']] },
  { name: 'flower crown', hat: [['  ', 'n'], ['✿', PINK], ['❀', BLONDE], ['✿', '#B57EDC'], ['❀', PINK], ['✿', BLONDE], ['  ', 'n']] },
  { name: 'chef', hat: [['  ▟███▙  ', '#F5F5F5']] },
  { name: 'wizard', hat: [['   ▗▟▙▖', PURPLE], ['✦', BLONDE], [' ', 'n']] },
  { name: 'witch', hat: [['  ▁▁▟▙▁▁ ', PURPLE]] },
  { name: 'santa', hat: [['  ▗▄▄▄▄', RED], ['●', '#FFFFFF'], [' ', 'n']] },
  { name: 'graduate', hat: [['  ▄▄█▄▄', '#3A3A44'], ['╻', BLONDE], [' ', 'n']] },
  { name: 'headphones', hat: [['  ╭───╮  ', '#9A9AA0']] },
  { name: 'viking', hat: [[' ▚', '#F2EBD9'], ['▄▄▄▄▄', '#9A9AA0'], ['▞ ', '#F2EBD9']] },
  { name: 'ninja', hat: [['  ▄▄▄▄▄', RED], ['╲╲', RED]] },
  { name: 'pirate', hat: [['  ▄▄▄▄▄', RED], ['▚ ', RED]] },
  { name: 'bunny ears', hat: [['  ▐▌ ▐▌  ', '#F5F5F5']] },
  { name: 'cat ears', hat: [['  ▲   ▲  ', 'n']] },
  { name: 'devil horns', hat: [['  ▚   ▞  ', RED]] },
  { name: 'propeller', hat: [['   ', 'n'], ['═╪═', BLONDE], ['   ', 'n']], hatAlt: [['   ', 'n'], ['─┼─', BLONDE], ['   ', 'n']] },
  { name: 'cap', hat: [['  ▄███▄▄▄', '#4FA3E0']] },
  { name: 'sombrero', hat: [['▁▁▄███▄▁▁', '#E8A33D']] },
  { name: 'alien', hat: [['   ╿ ╿   ', '#6CC24A']] },
]

// ---------------------------------------------------------------------------
// Props are pixel art, 8×8 pixels drawn two to a cell (▀ top, ▄ bottom), so a
// prop is as crisp as Clawd. '.' is see-through. Overlays put a glyph (a note, a
// spark, a ?) on a cell. A prop sits right at Clawd's hand; dx moves it (the
// umbrella goes over Clawd's head).
type Prop = { render: (i: number) => Cell[][]; pose: (i: number) => Pose; dx?: number }
type Overlay = [number, number, string, string] // cell x, cell y, glyph, color

const PX_H = 8

// A row of cells from colored text runs, padded to the prop width (the chalkboard uses it).
const cells = (...parts: [string, string?, string?][]): Cell[] => {
  const row = parts.flatMap(([t, fg, bg]) => [...t].map((ch): Cell => ({ ch, ...(fg ? { fg } : {}), ...(bg ? { bg } : {}) })))
  return [...row, ...Array.from({ length: Math.max(0, PROP_W - row.length) }, () => ({ ch: ' ' }))].slice(0, PROP_W)
}
const EMPTY = (): string[] => Array.from({ length: PX_H }, () => '.'.repeat(PROP_W))

// Paint a piece of art onto a canvas at pixel (x, y); '.' in the piece leaves the canvas.
const stamp = (canvas: string[], piece: string[], x = 0, y = 0): string[] => {
  const out = canvas.map(r => [...r])
  piece.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      const r = out[y + dy]
      if (ch !== '.' && r && x + dx >= 0 && x + dx < r.length) r[x + dx] = ch
    }),
  )
  return out.map(r => r.join(''))
}

export const pixels = (art: string[], pal: Record<string, string>, overlay: Overlay[] = []): Cell[][] => {
  const rows: Cell[][] = Array.from({ length: PX_H / 2 }, (_, r) =>
    Array.from({ length: PROP_W }, (_, c): Cell => {
      const t = pal[art[2 * r]?.[c] ?? '.']
      const b = pal[art[2 * r + 1]?.[c] ?? '.']
      if (!t && !b) return { ch: ' ' }
      if (t && !b) return { ch: '▀', fg: t }
      if (!t && b) return { ch: '▄', fg: b }
      return t === b ? { ch: '█', fg: t } : { ch: '▀', fg: t, bg: b }
    }),
  )
  for (const [x, y, ch, fg] of overlay) {
    const row = rows[y]
    const under = row?.[x]
    if (!row || !under) continue
    row[x] = under.ch === '█' ? { ch, fg, bg: under.fg } : { ch, fg }
  }
  return rows
}

const GRAY = '#9A9AA0'
const LIGHT = '#C8C8C8'
const WHITE = '#F5F5F5'
const WOOD = '#A0522D'
const DARK = '#16232B'
const GOLD = '#F2C744'

// A laptop on a desk: syntax-colored code types itself out line by line, a key lights
// up under Clawd's hand, the cursor blinks; then the screen clears for the next bit.
const CODE: [number, number, string][] = [
  [0, 3, 'p'],
  [1, 4, 'c'],
  [1, 2, 'y'],
]
const computer: Prop = {
  pose: i => so('right', i % 2 ? 'type' : 'down'),
  render: i => {
    let art = ['gggggggg', 'gssssssg', 'gssssssg', 'gssssssg', 'gggggggg', 'kkkkkkkk', '.d....d.', '.d....d.']
    let typed = i % 13
    let cursor: [number, number] = [1, 1]
    CODE.forEach(([indent, len, color], line) => {
      const n = Math.max(0, Math.min(len, typed))
      typed -= len
      if (n > 0) {
        art = stamp(art, [color.repeat(n)], 1 + indent, 1 + line)
        cursor = [1 + indent + n, 1 + line]
      }
    })
    if (i % 2 === 0 && cursor[0] < 7) art = stamp(art, ['w'], cursor[0], cursor[1])
    art = stamp(art, ['w'], (i * 3) % 8, 5)
    return pixels(art, { g: GRAY, s: DARK, k: LIGHT, d: WOOD, w: WHITE, p: '#E0607E', c: '#4FC1E9', y: '#F2D04B' })
  },
}

// A hammer: raised high, swung, then down on a nail that sinks into the board with a spark.
const HAMMER_UP = ['...HHH..', '...HHH..', '..w.....', 'ww......', '........']
const HAMMER_MID = ['........', '........', '....HH..', 'wwwwHH..', '....HH..']
const HAMMER_HIT = ['........', '........', '........', '........', 'wwwwHH..', '....HH..']
const hammer: Prop = {
  pose: i => (i % 5 < 3 ? so('right', 'one-up') : so('right', 'down')),
  render: i => {
    const phase = i % 5
    const before = Math.floor(i / 5) % 2 ? 1 : 2
    const nail = phase >= 3 ? before - 1 : before
    let art = stamp(EMPTY(), ['..BBBBBB'], 0, 7)
    for (let k = 0; k < nail; k++) art = stamp(art, ['n'], 4, 6 - k)
    if (nail === 0) art = stamp(art, ['N'], 4, 7)
    art = stamp(art, phase < 2 ? HAMMER_UP : phase === 2 ? HAMMER_MID : HAMMER_HIT)
    const spark: Overlay[] = phase === 3 ? [[6, 2, '✦', '#F2D04B'], [7, 1, '·', '#F2D04B'], [3, 3, '·', LIGHT]] : []
    return pixels(art, { H: LIGHT, w: WOOD, n: GRAY, N: LIGHT, B: '#8B5A2B' }, spark)
  },
}

// A mug of coffee at Clawd's hand: white, a loop handle, dark coffee
// inside, one thin wisp of steam curling up. Every few beats Clawd lifts it to its
// face and sips, eyes closed (no steam while it drinks).
const MUG = ['WcW..', 'WWWh.', 'WWW.h', 'WWWh.'] // a loop handle with a hole in it
const coffee: Prop = {
  pose: i => (i % 10 >= 6 && i % 10 < 9 ? so('closed', 'one-up') : so('right')),
  render: i => {
    const sip = i % 10 >= 6 && i % 10 < 9
    const top = sip ? 2 : 4
    let art = stamp(EMPTY(), MUG, 0, top)
    if (!sip)
      for (let k = 1; k <= 3; k++) {
        const x = 1 + ((k + i) % 2) - (k === 1 ? 0 : 0)
        art = stamp(art, [k === 3 ? 'f' : 's'], x, top - k)
      }
    return pixels(art, { W: WHITE, c: '#4A2A17', h: WHITE, s: '#B8B8BE', f: '#7A7A80' })
  },
}

// A small open book in Clawd's hands: it reads; every few beats a page lifts, stands up
// and turns over.
const PAGE_FLIP = [[], [[3, 4]], [[2, 3]], [[1, 4]]]
const book: Prop = {
  pose: i => (i % 12 === 11 ? so('closed') : so('right')),
  render: i => {
    let art = stamp(EMPTY(), ['PPbPP', 'LLbLL', 'BBBBB'], 0, 5)
    for (const [x, y] of PAGE_FLIP[i % 6 < 4 ? i % 6 : 0] ?? []) art = stamp(art, ['P'], x, y)
    return pixels(art, { P: WHITE, L: GRAY, b: WOOD, B: WOOD })
  },
}

// A guitar held at Clawd's side: it strums, notes drift up and away.
const guitar: Prop = {
  pose: i => so(i % 4 < 2 ? 'closed' : 'right', i % 2 ? 'one-up' : 'down'),
  render: i => {
    const art = ['......hh', '.....n..', '....n...', '.BBn....', 'BBBB....', 'BBoB....', 'BBBB....', '.BB.....']
    const notes: Overlay[] = [0, 1].flatMap((k): Overlay[] => {
      const ph = (i + k * 3) % 6
      const y = 2 - Math.floor(ph / 2)
      return y >= 0 ? [[5 + k + (ph % 2), y, k ? '♫' : '♪', '#B57EDC']] : []
    })
    return pixels(art, { h: LIGHT, n: LIGHT, B: WOOD, o: '#3B2314' }, notes)
  },
}

// A small trophy, raised up and down in triumph, a gleam running across it.
const trophy: Prop = {
  pose: i => (i % 4 < 2 ? so('open', 'up') : so('wink', 'one-up')),
  render: i => {
    const up = i % 4 < 2
    let art = stamp(EMPTY(), ['GGGGG', 'GGGGG', '.GGG.', '..G..', '.GGG.'], 0, up ? 1 : 3)
    art = stamp(art, ['w'], i % 4, up ? 1 : 3)
    const sparkle: Overlay[] = up ? [[5, 0, '✦', WHITE]] : [[5, 1, '✧', WHITE]]
    return pixels(art, { G: GOLD, w: WHITE }, sparkle)
  },
}

// A little camera at Clawd's hand: it poses with a wink, then the flash goes off.
const camera: Prop = {
  pose: i => (i % 6 < 3 ? so('right', 'one-up') : so('wink', 'down')),
  render: i => {
    const flash = i % 6 === 4
    const art = stamp(EMPTY(), [flash ? '.WW..' : '.ff..', 'GGGGG', 'GlDlr', 'GGGGG'], 0, 3)
    const burst: Overlay[] = flash ? [[0, 0, '✦', WHITE], [2, 0, '✦', WHITE], [1, 0, '·', WHITE]] : []
    return pixels(art, { G: GRAY, f: LIGHT, W: WHITE, l: LIGHT, D: DARK, r: '#E0607E' }, burst)
  },
}

// A frying pan: the pancake goes up, turns edge-on at the top, and lands back.
const PANCAKE: [number, string[]][] = [[5, ['CCC']], [5, ['CCC']], [3, ['CCC']], [1, ['C', 'C']], [0, ['C', 'C']], [2, ['CCC']], [4, ['CCC']], [5, ['CCC']]]
const pan: Prop = {
  pose: i => so('right', i % 8 >= 2 && i % 8 < 5 ? 'one-up' : 'down'),
  render: i => {
    let art = stamp(EMPTY(), ['w.......', '.w.K...K', '..wKKKKK'], 0, 5)
    const [y, cake] = PANCAKE[i % 8] ?? [5, ['CCC']]
    art = stamp(art, cake, cake[0]?.length === 1 ? 5 : 4, y)
    return pixels(art, { w: WOOD, K: GRAY, C: '#E8A33D' })
  },
}

// A balloon on a string, bobbing above Clawd's hand.
const balloon: Prop = {
  pose: i => (i % 8 < 5 ? so('right', 'one-up') : so('open', 'up')),
  render: i => {
    const bob = i % 4 < 2 ? 0 : 1
    const art = stamp(EMPTY(), ['..RRR...', '.RWRRR..', '.RRRRR..', '..RRR...', '...R....', i % 2 ? '..s.....' : '...s....', '.s......'], 0, bob)
    return pixels(art, { R: '#E0607E', W: WHITE, s: LIGHT })
  },
}

// An umbrella held over Clawd's head.
const umbrella: Prop = {
  dx: -7,
  pose: i => so(i % 8 < 4 ? 'open' : 'right'),
  render: () => pixels(['.RRWWRR.', 'RRRWWRRR', '.......h', '.......h', '.......h', '.......h', '.......h', '......h.'], { R: '#E0607E', W: WHITE, h: GRAY }),
}

// A magnifying glass sweeping left and right, its glint moving.
const magnifier: Prop = {
  pose: i => so(i % 6 < 3 ? 'right' : 'open'),
  render: i => {
    const sweep = [0, 1, 2, 1][Math.floor(i / 2) % 4] ?? 0
    const lens = ['...rrrr.', '..rggWgr', '..rggggr', '..rggggr', '...rrrr.']
    let art = stamp(EMPTY(), lens, sweep - 1, 0)
    art = stamp(art, ['h', 'h'].map((_, k) => '.'.repeat(1 - k) + 'h'), 0, 5)
    return pixels(art, { r: '#E8A33D', g: '#BFE3F2', W: WHITE, h: WOOD })
  },
}

// A rocket: it idles, launches out of the top, then comes back down to land.
const ROCKET = ['...r....', '..rrr...', '..rwr...', '..rrr...', '..rrr...', '.frrrf..', '.f.y.f..', '...o....']
const ROCKET_Y = [0, 0, 0, 0, 0, 0, -1, -2, -3, -5, -7, -9, -9, -9, -9, -9, -8, -6, -4, -2, -1, 0, 0, 0, 0, 0]
const rocket: Prop = {
  pose: i => (i >= 6 && i < 16 ? so('open', 'up') : so('right')),
  render: i => {
    const y = ROCKET_Y[i % ROCKET_Y.length] ?? 0
    const art = stamp(EMPTY(), ROCKET.map(r => (i % 2 ? r : r.replace('y', 'o').replace(/o(?=\.\.\.\.)/, 'y'))), 0, y)
    const smoke: Overlay[] = y < 0 && y > -6 ? [[1, 3, '·', LIGHT], [4, 3, '˙', LIGHT]] : []
    return pixels(art, { r: '#E0607E', w: '#BFE3F2', f: '#B0435A', y: '#F2D04B', o: '#E8A33D' }, smoke)
  },
}

// Hearts float up past Clawd.
const heart: Prop = {
  pose: i => (i % 6 === 2 ? so('wink') : so('right')),
  render: i => {
    let art = stamp(EMPTY(), ['.H.H.', 'HHHHH', '.HHH.', '..H..'], 1, 7 - (i % 12))
    art = stamp(art, ['h.h', 'hhh', '.h.'], 5, 7 - ((i + 6) % 12))
    return pixels(art, { H: '#E0607E', h: '#FF7EB6' })
  },
}

// Music notes rise while Clawd dances.
const music: Prop = {
  pose: i => so('open', i % 4 < 2 ? 'up' : 'down', i % 2 ? 'left' : 'right'),
  render: i =>
    pixels(
      EMPTY(),
      {},
      [0, 1, 2].flatMap((k): Overlay[] => {
        const ph = (i + k * 3) % 8
        const y = 3 - Math.floor(ph / 2)
        return [[1 + k * 2 + (ph % 2), y, k % 2 ? '♫' : '♪', ['#B57EDC', '#FF7EB6', '#4FC1E9'][k] ?? '#B57EDC']]
      }),
    ),
}

// Z's drift up and grow while Clawd sleeps.
const sleep: Prop = {
  pose: () => so('closed'),
  render: i =>
    pixels(
      EMPTY(),
      {},
      [0, 1, 2].flatMap((k): Overlay[] => {
        const ph = (i + k * 4) % 12
        const y = 3 - Math.floor(ph / 3)
        return [[1 + Math.floor(ph / 3) + k, y, y <= 1 ? 'Z' : 'z', '#7FB2E5']]
      }),
    ),
}

// A thought bubble: a question, thinking dots, then an idea (and arms up).
const think: Prop = {
  pose: i => (i % 16 >= 12 ? so('open', 'up') : so(i % 8 < 4 ? 'right' : 'left')),
  render: i => {
    const glyph = i % 16 < 6 ? '?' : i % 16 < 12 ? '…' : '!'
    return pixels(['...WWWW.', '..WWWWWW', '..WWWWWW', '...WWWW.', '.W......', 'W.......', '........', '........'], { W: '#E8E8E8' }, [[4, 1, glyph, '#333333']])
  },
}

// A flower grows from a sprout to a bud to a bloom, then Clawd stops to smell it.
const FLOWER_STAGES = [
  ['........', '........', '........', '........', '........', '........', '....g...', '..ssss..'],
  ['........', '........', '........', '........', '....g...', '...Lg...', '....g...', '..ssss..'],
  ['........', '........', '....p...', '....g...', '...Lg...', '....gL..', '....g...', '..ssss..'],
  ['........', '...P.P..', '...PYP..', '....g...', '...Lg...', '....gL..', '....g...', '..ssss..'],
  ['...PPP..', '..PPYPP.', '...PPP..', '....g...', '...Lg...', '....gL..', '....g...', '..ssss..'],
]
const flower: Prop = {
  pose: i => (i >= 18 && i % 6 < 3 ? so('closed', 'one-up') : so('right')),
  render: i => {
    const stage = FLOWER_STAGES[Math.min(4, Math.floor(i / 4))] ?? []
    return pixels(stage, { g: '#6CC24A', L: '#3C9D3C', s: '#8B5A2B', p: '#B57EDC', P: '#FF7EB6', Y: '#F2D04B' })
  },
}

export const PROPS: Record<string, Prop> = { computer, hammer, coffee, book, guitar, trophy, camera, pan, balloon, umbrella, magnifier, rocket, heart, music, sleep, think, flower }
const PROP_NAMES = ['computer', 'hammer', 'magnifier', 'rocket', 'heart', 'music', 'sleep', 'flower', 'coffee', 'book', 'guitar', 'balloon', 'trophy', 'camera', 'pan']

// ---------------------------------------------------------------------------
// Scenes paint the whole row behind (or, for water, in front of) Clawd.
const SCENE_NAMES = ['swim', 'space', 'garden', 'party', 'night', 'rain', 'snow', 'sunny', 'city', 'underwater', 'fireworks', 'matrix', 'love']

export type Crew = 'family' | 'catch' | 'class'
export type Topic = { prop?: string; scene?: string; outfit?: string; crew?: Crew }

const TOPICS: [RegExp, Topic][] = [
  [/\b(learn|teach|explain|tutorial|lesson|class|course|school|study|onboard|onboarding|standup|meeting)\b/, { outfit: 'graduate', crew: 'class' }],
  [/\b(family|kids|children|parents?|mom|dad|baby|babies|team|together|friends)\b/, { crew: 'family' }],
  [/\b(play|playing|ball|catch|pair|pairing|collab|collaborate|buddy|buddies)\b/, { crew: 'catch' }],
  [/\b(christmas|xmas|santa|holidays?)\b/, { scene: 'snow', outfit: 'santa' }],
  [/\b(pirate|treasure|ahoy)\b/, { scene: 'swim', outfit: 'pirate' }],
  [/\b(wizard|magic|spell)\b/, { scene: 'space', outfit: 'wizard' }],
  [/\b(chef|cook|cooking|recipe|food|bake|breakfast|lunch|dinner)\b/, { prop: 'pan', outfit: 'chef' }],
  [/\b(coffee|morning|caffeine|tea)\b/, { prop: 'coffee' }],
  [/\b(ninja|stealth|secret|sneaky)\b/, { scene: 'night', outfit: 'ninja' }],
  [/\b(birthday|anniversary)\b/, { prop: 'balloon', scene: 'fireworks', outfit: 'party hat' }],
  [/\b(read|reading|docs?|documentation|readme|book|spec|paper|article)\b/, { prop: 'book' }],
  [/\b(screenshot|photo|image|picture|snapshot|camera)\b/, { prop: 'camera' }],
  [/\b(guitar|band|concert|rock|song|songs)\b/, { prop: 'guitar', scene: 'party' }],
  [/\b(win|won|winner|passed|passing|success|merged|milestone|shipped|done|finished|celebrate)\b/, { prop: 'trophy', scene: 'fireworks' }],
  [/\b(git|commit|push|pull|merge|rebase|branch|pr|diff|stash|checkout|cherry-pick|github|gitlab)\b/, { prop: 'computer' }],
  [/\b(code|coding|hack|hacker|matrix|algorithm|binary|terminal)\b/, { prop: 'computer', scene: 'matrix' }],
  [/\b(deploy|ship|release|launch|publish|prod|production|rollout)\b/, { prop: 'rocket', scene: 'space' }],
  [/\b(space|stars?|moon|galaxy|planet|orbit|astronaut|cosmic|alien)\b/, { prop: 'rocket', scene: 'space', outfit: 'alien' }],
  [/\b(fish|underwater|dive|diving|submarine|reef|aquarium)\b/, { scene: 'underwater' }],
  [/\b(swim|swimming|pool|beach|water|ocean|sea|surf|waves?|float|stream)\b/, { scene: 'swim' }],
  [/\b(rain|rainy|storm|weather|umbrella)\b/, { prop: 'umbrella', scene: 'rain' }],
  [/\b(snow|winter|cold|ice|freeze|frozen)\b/, { scene: 'snow' }],
  [/\b(sun|sunny|summer|vacation|weekend|trip)\b/, { scene: 'sunny', outfit: 'sombrero' }],
  [/\b(server|servers|infra|infrastructure|kubernetes|k8s|docker|cluster|city|cloud)\b/, { prop: 'computer', scene: 'city' }],
  [/\b(fireworks|new year)\b/, { prop: 'music', scene: 'fireworks' }],
  [/\b(love|heart|crush)\b|<3/, { prop: 'heart', scene: 'love' }],
  [/\b(flowers?|garden|plants?|grow|bloom|seed|tree|spring|pretty|cute|beautiful|style|styling|design|css)\b/, { prop: 'flower', scene: 'garden' }],
  [/\b(thanks|thank you|thx|nice|cool|great|awesome|perfect|congrats|yay)\b/, { prop: 'heart', scene: 'party' }],
  [/\b(dance|music|fun|party|game)\b/, { prop: 'music', scene: 'party' }],
  [/\b(later|break|sleep|tired|wait|night|pause|tomorrow)\b/, { prop: 'sleep', scene: 'night' }],
  [/\b(search|find|look|grep|research|investigate|debug|check|test|inspect|trace|why)\b/, { prop: 'magnifier' }],
  [/\b(fix|build|implement|refactor|edit|change|add|make|create|write|tool|update|install|setup|set up)\b/, { prop: 'hammer' }],
  [/\?\s*$|^\s*(how|what|why|when|where|which|can|should|is|does|do)\b/, { prop: 'think' }],
]

export const topicOf = (text: string): Topic | null => {
  const t = text.toLowerCase()
  return TOPICS.find(([re]) => re.test(t))?.[1] ?? null
}

// ---------------------------------------------------------------------------
// One lap: walk right to the middle, do the prompt's activity, walk on, turn,
// walk back to the middle, do a random trick, walk home, turn. Each lap picks a
// new trick, and for a prompt with no topic a new activity and scene.
const ACT = 36
const TRICK = 30
const TURN_R = ['right-12', 'front', 'up', 'front', 'left-12']
const TURN_L = ['left-12', 'front', 'up', 'front', 'right-12']
const turnKey = (name: string): Key => (name === 'front' ? NO : name === 'up' ? { ...NO, pose: 'arms-up' } : { ...NO, pose: { facing: name } })

// Extra figures sharing the row: tiny Clawds (kids, students), a friend, a ball, a hand up.
export type Extra =
  | { kind: 'tiny'; x: number; hop: boolean; step: number; color: number; raise?: boolean }
  | { kind: 'friend'; x: number; pose: Pose }
  | { kind: 'cells'; x: number; rows: Cell[][] }
  | { kind: 'ball'; x: number; y: number }

export type Scene = { x: number; frame: Frame; prop: { rows: Cell[][]; dx: number } | null; scene: string | null; extras: Extra[] }

const TINY_W = 5
const GAP = 8 // the throw between two Clawds playing catch
const WORDS = ['hello', 'a+b=c', '</>', 'claude', '2+2=4', 'git', 'λx.x', 'O(n)']

// A classroom board: chalk writing itself out on green.
const board = (word: string, i: number): Cell[][] => {
  const shown = word.slice(0, Math.floor(i / 3)).padEnd(6).slice(0, 6)
  const tick = i >= 3 * word.length + 3 ? '  ✓   ' : '      '
  return [
    cells(['┌──────┐', WOOD]),
    cells(['│', WOOD], [shown, WHITE, '#1F3B2D'], ['│', WOOD]),
    cells(['│', WOOD], [tick, '#6CC24A', '#1F3B2D'], ['│', WOOD]),
    cells(['└┬────┬┘', WOOD]),
  ]
}

export const scene = (range: number, b: number, seed: number, topic: Topic | null): Scene => {
  const legs = Math.max(0, range)
  // The topic sets the lap; with no topic, each lap draws its own scene, crew and prop.
  const lapGuess = Math.floor(b / Math.max(1, 2 * legs + TURN_R.length + TURN_L.length + ACT + TRICK))
  const crew: Crew | null = topic ? (topic.crew ?? null) : ([null, null, null, 'family', 'catch', 'class'] as const)[(seed + lapGuess * 5) % 6] ?? null
  const students = Math.min(4, Math.floor((range - PROP_W - 2) / (TINY_W + 1)))
  const need = crew === 'catch' ? GAP + W : crew === 'class' && students > 0 ? PROP_W + 2 + students * (TINY_W + 1) : PROP_W + 1
  const room = range >= need
  const mid = room ? Math.floor((range - need) / 2) : Math.max(0, range)
  const cycle = legs >= 2 ? 2 * legs + TURN_R.length + TURN_L.length + ACT + TRICK : ACT + TRICK
  const c = Math.floor(b / cycle)
  const trick = TRICKS[TRICK_NAMES[(seed + c) % TRICK_NAMES.length] ?? 'jump'] ?? jump
  const bg = topic ? (topic.scene ?? null) : ([null, null, ...SCENE_NAMES][(seed + c * 3) % (SCENE_NAMES.length + 2)] ?? null)
  const swim = bg === 'swim'
  const propName = topic ? topic.prop : PROP_NAMES[(seed + c * 7) % PROP_NAMES.length]
  const prop = swim ? undefined : propName ? PROPS[propName] : undefined

  // Ducklings: two tiny Clawds trail behind, hopping as they go.
  const family = (x: number, dir: 1 | -1, moving: boolean): Extra[] =>
    crew !== 'family'
      ? []
      : [0, 1].map(k => ({
          kind: 'tiny' as const,
          x: dir > 0 ? x - (TINY_W + 1) * (k + 1) : x + W + 1 + (TINY_W + 1) * k,
          hop: moving ? (b + k) % 2 === 0 : (b + k * 3) % 8 === 0,
          step: b + k,
          color: k + 2,
        }))

  const plain = (k: Key): Frame => draw(k)
  const act = (i: number, x: number): Scene => {
    const base = { x, scene: bg, extras: family(x, 1, false) }
    if (swim) return { ...base, frame: { rows: front(so(i % 6 < 3 ? 'open' : 'right', i % 4 < 2 ? 'up' : 'one-up')), offset: 0 }, prop: null }
    if (room && crew === 'catch') {
      // A ball arcs between Clawd and a friend; whoever is about to catch it puts their arms up.
      const u = i % (2 * GAP)
      const pos = u < GAP ? u : 2 * GAP - 1 - u
      const d = Math.min(pos, GAP - 1 - pos)
      return {
        ...base,
        frame: { rows: front(so('right', pos <= 1 ? 'up' : 'down')), offset: 0 },
        prop: null,
        extras: [{ kind: 'friend', x: x + W + GAP, pose: so('left', pos >= GAP - 2 ? 'up' : 'down') }, { kind: 'ball', x: x + W + pos, y: d }],
      }
    }
    if (room && crew === 'class' && students > 0) {
      // Teacher Clawd points at the board; tiny students bob, and one raises a hand at a time.
      const raised = Math.floor(i / 6) % students
      return {
        ...base,
        frame: { rows: front(so('right', i % 4 < 2 ? 'one-up' : 'down')), offset: 0 },
        prop: null,
        extras: [
          { kind: 'cells', x: x + W + 1, rows: board(WORDS[(seed + c) % WORDS.length] ?? 'hello', i) },
          ...Array.from({ length: students }, (_, k): Extra => ({
            kind: 'tiny',
            x: x + W + 1 + PROP_W + 1 + k * (TINY_W + 1),
            hop: (i + k * 3) % 9 === 0,
            step: 0,
            color: k + 1,
            raise: k === raised && i % 6 > 1,
          })),
        ],
      }
    }
    const frame: Frame = { rows: front(prop?.pose(i) ?? so('open')), offset: 0 }
    if (!room || !prop) return { ...base, frame, prop: null }
    return { ...base, frame, prop: { rows: prop.render(i), dx: prop.dx ?? 0 } }
  }
  const doTrick = (i: number, x: number): Scene => {
    const k = trick[i] ?? NO
    const at = Math.max(0, Math.min(legs, x + k.x))
    return { x: at, frame: plain(k), prop: null, scene: bg, extras: family(at, 1, false) }
  }

  let t = b % cycle
  if (legs < 2) return t < ACT ? act(t, mid) : doTrick(t - ACT, mid)

  const walkTo = (from: number, dir: 1 | -1, i: number): Scene => ({
    x: from + dir * i,
    frame: { rows: facing(dir > 0 ? 'right-30' : 'left-30', i), offset: 0 },
    prop: null,
    scene: bg,
    extras: family(from + dir * i, dir, true),
  })
  const turnAt = (x: number, names: string[], i: number, dir: 1 | -1): Scene => ({ x, frame: plain(turnKey(names[i] ?? 'front')), prop: null, scene: bg, extras: family(x, dir, false) })

  // The lap opens on the activity, so a fresh prompt shows it at once.
  const segs: [number, (i: number) => Scene][] = [
    [ACT, i => act(i, mid)],
    [legs - mid, i => walkTo(mid, 1, i)],
    [TURN_R.length, i => turnAt(legs, TURN_R, i, 1)],
    [legs - mid, i => walkTo(legs, -1, i)],
    [TRICK, i => doTrick(i, mid)],
    [mid, i => walkTo(mid, -1, i)],
    [TURN_L.length, i => turnAt(0, TURN_L, i, -1)],
    [mid, i => walkTo(0, 1, i)],
  ]
  for (const [len, f] of segs) {
    if (t < len) return f(t)
    t -= len
  }
  return { x: 0, frame: plain(NO), prop: null, scene: bg, extras: [] }
}

export const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const CONFETTI = ['*', '·', '°', '✦', '•']
const CONFETTI_COLORS = ['#E0607E', '#F2D04B', '#4FA3E0', '#6CC24A', '#B57EDC']
const FLOWER_COLORS = [PINK, BLONDE, '#B57EDC']

// The row as a grid of cells: the scene, then Clawd dressed in its outfit, then
// the prop, then anything in front (water).
export const paint = (s: Scene, width: number, outfit: Outfit, body: string, b: number, seed: number): Cell[][] => {
  const h = 4
  const g: Cell[][] = Array.from({ length: h }, () => Array.from({ length: width }, () => ({ ch: ' ' })))
  const put = (x: number, y: number, cell: Cell) => {
    const row = g[y]
    if (row && x >= 0 && x < width) row[x] = cell
  }
  const cellHash = (x: number, y: number) => hash(`${x},${y},${seed}`)

  if (s.scene === 'space' || s.scene === 'night') {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < width; x++) {
        const v = cellHash(x, y) % (s.scene === 'night' ? 41 : 27)
        if (v > 3 || (b + x) % 7 === 0) continue
        put(x, y, { ch: ['✦', '·', '✧', '⋆'][v] ?? '·', fg: v === 0 || v === 2 ? '#F2D04B' : '#9A9AA0' })
      }
    put(width - 3, 0, { ch: '☾', fg: '#F2D04B' })
  } else if (s.scene === 'garden') {
    for (let x = 0; x < width; x++) {
      const v = cellHash(x, 0) % 5
      if (v === 0) put(x, h - 1, { ch: (x + (b >> 2)) % 2 ? '✿' : '❀', fg: FLOWER_COLORS[x % FLOWER_COLORS.length] })
      else if (v === 1) put(x, h - 1, { ch: ',', fg: '#6CC24A' })
    }
  } else if (s.scene === 'rain' || s.scene === 'snow' || s.scene === 'love' || s.scene === 'underwater') {
    // Things that fall (rain, snow) or rise (hearts, bubbles), one column at a time.
    const rises = s.scene === 'love' || s.scene === 'underwater'
    const every = s.scene === 'rain' ? 3 : s.scene === 'snow' ? 4 : 6
    const speed = s.scene === 'rain' || s.scene === 'underwater' ? b : b >> 1
    for (let x = 0; x < width; x++) {
      if (cellHash(x, 5) % every) continue
      const t = (speed + cellHash(x, 6)) % (h + 2)
      const y = rises ? h - 1 - t : t
      const pick = cellHash(x, 7)
      const cell: Cell =
        s.scene === 'rain'
          ? { ch: '╎', fg: '#7FB2E5' }
          : s.scene === 'snow'
            ? { ch: ['*', '·', '❄'][pick % 3] ?? '*', fg: '#F5F5F5' }
            : s.scene === 'love'
              ? { ch: '♥', fg: [PINK, RED, '#E0607E'][pick % 3] }
              : { ch: pick % 2 ? 'o' : '°', fg: '#7FB2E5' }
      put(x, y, cell)
    }
    if (s.scene === 'snow') for (let x = 0; x < width; x++) put(x, h - 1, { ch: '▁', fg: '#F5F5F5' })
    if (s.scene === 'underwater') {
      for (let x = 0; x < width; x++) if (cellHash(x, 8) % 7 === 0) put(x, h - 1, { ch: (x + (b >> 2)) % 2 ? ')' : '(', fg: '#3CC8B4' })
      const fx = ((b >> 1) + (seed % width)) % (width + 3)
      ;[...'><>'].forEach((ch, i) => put(fx - 3 + i, 1, { ch, fg: '#E8A33D' }))
      const gx = width - (((b >> 1) + (seed >>> 3)) % (width + 3))
      ;[...'<><'].forEach((ch, i) => put(gx + i, h - 2, { ch, fg: '#F2D04B' }))
    }
  } else if (s.scene === 'sunny') {
    put(width - 3, 0, { ch: '☀', fg: '#F2C744' })
    for (let k = 0; k < 2; k++) {
      const cx = (((b >> 3) + cellHash(k, 10)) % (width + 4)) - 2
      put(cx, k, { ch: '☁', fg: '#C8D6E5' })
      put(cx + 1, k, { ch: '☁', fg: '#C8D6E5' })
    }
  } else if (s.scene === 'city') {
    // A skyline along the back, windows switching on and off.
    for (let x = 0; x < width; x++) {
      const tall = 1 + (cellHash(x >> 2, 11) % 2)
      for (let y = h - tall; y < h; y++) {
        const lit = cellHash(x, y) % 3 === 0 && cellHash(x, y + (b >> 3)) % 4 !== 0
        put(x, y, lit ? { ch: '▪', fg: '#F2D04B', bg: '#3A3F4B' } : { ch: '█', fg: '#3A3F4B' })
      }
    }
    put(width - 3, 0, { ch: '☾', fg: '#F2D04B' })
  } else if (s.scene === 'fireworks') {
    // Three bursts at a time, each one rising, opening into a ring and fading.
    for (let k = 0; k < 3; k++) {
      const t = b + k * 5
      const p = t % 14
      const cx = cellHash(k, Math.floor(t / 14)) % width
      const color = CONFETTI_COLORS[(k + Math.floor(t / 14)) % CONFETTI_COLORS.length]
      if (p < 2) put(cx, h - 1 - p, { ch: '·', fg: color })
      else if (p < 7) {
        const r = p - 1
        const sparks: [number, number, string][] = [[-r, 0, '*'], [r, 0, '*'], [-(r >> 1), -1, '·'], [r >> 1, -1, '·'], [-(r >> 1), 1, '·'], [r >> 1, 1, '·']]
        for (const [dx, dy, ch] of sparks) put(cx + dx, 1 + dy, { ch: p > 5 ? '·' : ch, fg: color })
      }
    }
  } else if (s.scene === 'matrix') {
    for (let x = 0; x < width; x++) {
      if (cellHash(x, 14) % 2) continue
      const head = (b + cellHash(x, 15)) % (h + 4)
      for (let t = 0; t < 3; t++) {
        const y = head - t
        if (y >= 0 && y < h) put(x, y, { ch: cellHash(x, y + b) % 2 ? '1' : '0', fg: t === 0 ? '#B6FFB6' : '#3C9D3C' })
      }
    }
  } else if (s.scene === 'party') {
    for (let x = 0; x < width; x++) {
      if (cellHash(x, 9) % 4) continue
      const y = (b + cellHash(x, 1)) % (h + 3)
      put(x, y, { ch: CONFETTI[cellHash(x, 2) % CONFETTI.length] ?? '*', fg: CONFETTI_COLORS[cellHash(x, 3) % CONFETTI_COLORS.length] })
    }
  }

  // A sprite: eyes get the dark only where the glyph leaves a gap; Clawd is solid,
  // so the scene does not show through its spaces.
  const sprite = (rows: Rows, x0: number, top: number, color: string) =>
    rows.forEach((spans, dy) => {
      let x = x0
      const y = top + dy
      for (const [text, kind] of spans)
        for (const ch of text) {
          if (kind === 'x') {
            x++
            continue
          }
          if (kind === 'e' && ch !== '█') put(x, y, { ch, fg: color, bg: EYE_BG })
          else if (kind === 'l') put(x, y, { ch, fg: EYE_BG, bg: color })
          else if (ch !== ' ') put(x, y, { ch, fg: kind.startsWith('#') ? kind : color })
          else put(x, y, { ch: ' ' })
          x++
        }
    })
  const crewColor = (k: number) => COLORS[(Math.max(0, COLORS.indexOf(body)) + k) % COLORS.length] ?? body

  // Friends and tiny Clawds stand behind the main one.
  for (const e of s.extras) {
    if (e.kind === 'tiny') {
      if (e.x < 0 || e.x + TINY_W > width) continue // no half-drawn kids at the edges
      const top = h - 2 - (e.hop ? 1 : 0)
      sprite(tiny(e.step), e.x, top, crewColor(e.color))
      if (e.raise) {
        put(e.x + 4, top - 1, { ch: '▐', fg: crewColor(e.color) })
        put(e.x + 5, top - 1, { ch: '?', fg: '#F2D04B' })
      }
    } else if (e.kind === 'friend') sprite(front(e.pose), e.x, h - 3, crewColor(4))
    else if (e.kind === 'cells') e.rows.forEach((r, i) => r.forEach((c, j) => put(e.x + j, h - e.rows.length + i, c)))
  }

  // Clawd, with the hat riding on its head through every sink and hop.
  const swim = s.scene === 'swim'
  const hat = outfit.hatAlt && (b >> 1) % 2 ? outfit.hatAlt : outfit.hat
  // A hat keeps its row: a small hop (offset -1) stays on the ground rather than lose it.
  const lift = hat && s.frame.offset === -1 ? 0 : s.frame.offset
  const rows = shift([hat ? pad(hat) : BLANK, ...s.frame.rows], lift + (swim ? 1 : 0), h)
  if (s.frame.poof && s.frame.offset > 0) rows[0] = [[POOF[s.frame.poof], 'n']]
  sprite(rows, s.x, 0, body)

  const prop = s.prop
  prop?.rows.forEach((r, i) =>
    r.forEach((c, j) => {
      if (c.ch !== ' ' || c.bg) put(s.x + W + prop.dx + j, i, c)
    }),
  )
  for (const e of s.extras) if (e.kind === 'ball') put(e.x, Math.max(0, h - 2 - e.y), { ch: '●', fg: '#E0607E' })

  if (swim)
    for (let x = 0; x < width; x++) put(x, h - 1, { ch: (x + (b >> 1)) % 3 === 0 ? '≈' : '~', fg: '#4FA3E0' })
  return g
}

// Cells to runs of one style, so a row is a handful of Text pieces.
const runs = (row: Cell[]) => {
  const out: Cell[] = []
  for (const c of row) {
    const last = out.at(-1)
    if (last && last.fg === c.fg && last.bg === c.bg) last.ch += c.ch
    else out.push({ ...c })
  }
  return out
}

// When each message was first drawn, so its own animation starts at the beginning.
// Keyed by message id; a fresh prompt's id changes once it is stored, so a new id
// whose text was first drawn moments ago keeps that start instead of restarting.
const firstBeat = new Map<string, { text: string; b: number }>()

export const startBeat = (id: string, text: string, b: number): number => {
  const known = firstBeat.get(id)
  if (known) return known.b
  let start = b
  for (const v of firstBeat.values()) if (v.text === text && b - v.b >= 0 && b - v.b < 20) start = v.b
  firstBeat.set(id, { text, b: start })
  return start
}

export const COLORS = ['#D77757', '#E8A33D', '#6CC24A', '#4FA3E0', '#B57EDC', '#E0607E', '#3CC8B4', '#F2D04B']

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // ponytail: one shared beat redraws every on-screen prompt each tick; rows off screen skip it.
    $.clock.every(BEAT_MS, () => update($, beat, b => (b + 1) % 1_000_000))
    return next(e)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.origin.kind !== 'composer') return next(e)
    // Seeded by the text, not the message id: a fresh prompt's id changes once it is stored,
    // which would re-roll its color and outfit a moment after you send it.
    const seed = hash(e.props.text)
    const body = COLORS[seed % COLORS.length] ?? '#D77757'
    const topic = topicOf(e.props.text)
    const outfit = OUTFITS.find(o => o.name === topic?.outfit) ?? OUTFITS[(seed >>> 12) % OUTFITS.length] ?? { name: 'plain' }
    const b = e.props.onScreen === null ? 0 : await read($, beat)

    const cols = Math.max(40, (e.viewport?.columns ?? 80) - 2)
    const longest = Math.max(...e.props.text.split('\n').map(l => l.length), 1)
    const textW = Math.min(longest + 4, cols - W - PROP_W - 4)
    const range = cols - textW - W - 1
    const start = e.props.onScreen === null ? b : startBeat(e.requestId, e.props.text, b)
    const s = scene(range, b - start, seed >>> 8, topic)
    const grid = paint(s, range + W, outfit, body, b, seed)

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="flex-start" backgroundColor={BAR_BG} paddingRight={1}>
        <Box width={2} flexShrink={0}>
          <Text dimColor>❯</Text>
        </Box>
        <Box width={textW - 2} flexShrink={0}>
          <Text color={body}>{e.props.text}</Text>
        </Box>
        <Box flexDirection="column" flexShrink={0}>
          {grid.map((row, y) => (
            <Text key={String(y)}>
              {runs(row).map((c, i) =>
                c.fg || c.bg ? (
                  <Text key={String(i)} {...(c.fg ? { color: c.fg } : {})} {...(c.bg ? { backgroundColor: c.bg } : {})}>
                    {c.ch}
                  </Text>
                ) : (
                  c.ch
                ),
              )}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
