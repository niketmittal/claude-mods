import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const beat = atom({ plugin: 'buddy', key: 'beat' } as const, 0)
// What Clawd wanted to say about a prompt, if anything, keyed by the prompt's text hash.
const remarks = atom({ plugin: 'buddy', key: 'remarks' } as const, {})

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
  cartwheel: [
    ...Mr(['right-12', 'right-55']).map((k, n) => ({ ...k, x: n })),
    ...Mr(['edge', 'back-125', 'back']).map((k, n) => ({ ...k, x: 2 + n, offset: -1 })),
    ...Mr(['left-55', 'left-12']).map((k, n) => ({ ...k, x: 5 + n })),
    ...Se('arms-up', 2, { x: 6 }), ...Cr().map(k => ({ ...k, x: 6 })), ...Se('default', 1, { x: 6 }),
    ...[5, 4, 3, 2, 1, 0].flatMap(x => Se(so('left', 'down', x % 2 ? 'left' : 'right'), 1, { x })), NO,
  ],
  flip: [...Cr(), ...Mr(['back']).map(k => ({ ...k, offset: -1 })), ...Mr(['back-125', 'edge']).map(k => ({ ...k, offset: -1 })), ...Se('arms-up', 1, { offset: -1 }), ...Cr(), ...Se('arms-up', 2), NO],
  pogo: [...[0, 1, 2, 3, 4, 5].flatMap(x => [...Se('arms-up', 1, { x, offset: -1 }), ...Se('default', 1, { x, offset: 1 })]), ...[4, 2, 0].flatMap(x => Se(so('left'), 1, { x })), NO],
  slide: [...Se(so('right', 'up'), 1), ...[1, 2, 3, 4, 5, 6].flatMap(x => Se(so('right', 'up'), 1, { x })), ...Se(so('wink', 'up'), 2, { x: 6 }), ...[5, 3, 1].flatMap(x => Se(so('left'), 1, { x })), NO],
  tiptoe: [...[0, 1, 2, 3, 4].flatMap(x => Se(so(x % 2 ? 'left' : 'right', 'down', x % 2 ? 'left' : 'right'), 2, { x })), ...Se('look-left', 2, { x: 4 }), ...Se('look-right', 2, { x: 4 }), ...[3, 1].flatMap(x => Se(so('left'), 1, { x })), NO],
  sleepwalk: [...[0, 1, 2, 3, 4, 5].flatMap(x => Se(so('closed', 'up', x % 2 ? 'left' : 'right'), 2, { x })), ...Se(so('open'), 2, { x: 5 }), ...Se('arms-up', 1, { x: 5, offset: -1 }), ...[4, 2, 0].flatMap(x => Se(so('left'), 1, { x })), NO],
  nod: [...Array.from({ length: 4 }, () => [...Se(so('closed'), 1, { offset: 1 }), ...Se('default', 1)]).flat(), ...Se(so('wink'), 2), NO],
  yawn: [...Se(so('closed', 'one-up'), 2), ...Se(so('closed', 'up'), 4), ...Se(so('closed', 'up'), 2, { offset: -1 }), ...Se(so('closed'), 2), ...Se(so('wink'), 2), NO],
  hiccup: [...Se('default', 3), ...Se(so('open', 'up'), 1, { offset: -1 }), ...Se('default', 3), ...Se(so('open', 'up'), 1, { offset: -1 }), ...Se('look-left', 2), ...Se(so('closed'), 1), NO],
  wiggle: [...Array.from({ length: 4 }, (_, k) => Se(so(k % 2 ? 'left' : 'right', k % 2 ? 'up' : 'one-up', k % 2 ? 'left' : 'right'), 2, { x: k % 2 })).flat(), ...Se('arms-up', 2), NO],
  duck: [...Se('default', 1, { offset: 1 }), ...Se('default', 3, { offset: 2 }), ...Se('look-left', 2, { offset: 2 }), ...Se('look-right', 2, { offset: 2 }), ...Se('arms-up', 1, { offset: -1 }), ...Se('arms-up', 2), ...Cr(), NO],
  salute: [...Se(so('open', 'one-up'), 2), ...Se(so('wink', 'one-up'), 3), ...Se(so('open', 'one-up'), 2), ...Se('default', 1), NO],
  shrug: [...Se('look-left', 1), ...Se(so('left', 'up'), 2), ...Se('look-right', 1), ...Se(so('right', 'up'), 2), ...Se('default', 1), ...Se(so('wink'), 1), NO],
  stomp: [...Array.from({ length: 4 }, (_, k) => [...Se(so('open', 'down', k % 2 ? 'left' : 'right'), 1), ...Se('default', 1, { offset: 1, poof: 'dot' })]).flat(), ...Se('arms-up', 2), NO],
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
type Outfit = { name: string; hat?: Span[]; hatAlt?: Span[]; earring?: { ch: string; fg: string } }

// A very small earring, one side only (Clawd's left), worn by about a third of prompts' Clawds.
export const EARRINGS = [
  { ch: '·', fg: '#F2C744' }, // tiny gold stud
  { ch: '·', fg: '#E6E6EE' }, // tiny silver stud
  { ch: '°', fg: '#F2C744' }, // tiny gold hoop
  { ch: '╷', fg: '#FF7EB6' }, // tiny pink drop
]
export const earringFor = (seed: number) => ((seed >>> 20) % 3 === 0 ? EARRINGS[(seed >>> 22) % EARRINGS.length] : undefined)

const HAIR = '#C28A4E'
const BLONDE = '#F2D04B'
const PINK = '#FF7EB6'
const PURPLE = '#8F72F0'
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
  { name: 'cowboy', hat: [['▁▁▟███▙▁▁', '#C8743E']] },
  { name: 'halo', hat: [['  ╺━━━╸  ', '#F2D04B']] },
  { name: 'flower crown', hat: [['  ', 'n'], ['✿', PINK], ['❀', BLONDE], ['✿', '#B57EDC'], ['❀', PINK], ['✿', BLONDE], ['  ', 'n']] },
  { name: 'chef', hat: [['  ▟███▙  ', '#F5F5F5']] },
  { name: 'wizard', hat: [['   ▗▟▙▖', PURPLE], ['✦', BLONDE], [' ', 'n']] },
  { name: 'witch', hat: [['  ▁▁▟▙▁▁ ', PURPLE]] },
  { name: 'santa', hat: [['  ▗▄▄▄▄', RED], ['●', '#FFFFFF'], [' ', 'n']] },
  { name: 'graduate', hat: [['  ▄▄█▄▄', '#7C8DC8'], ['╻', BLONDE], [' ', 'n']] },
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
  { name: 'moon badge', hat: [['    ☾    ', '#F2D04B']] },
  { name: 'bolt badge', hat: [['    ↯    ', '#F2D04B']] },
  { name: 'robo antenna', hat: [['    ╿    ', '#9A9AA0']], hatAlt: [['    ╽    ', '#E0607E']] },
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
const WOOD = '#C8743E'
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
    return pixels(art, { H: LIGHT, w: WOOD, n: GRAY, N: LIGHT, B: '#B07A45' }, spark)
  },
}

// A mug of coffee one line tall at Clawd's hand: ▐▀ is the cup (the ▀ shows dark
// coffee over the white), ◗ its handle, and a wisp of steam drifts in the line above.
// Every few beats Clawd lifts it one line, to its face, and sips with eyes closed.
const coffee: Prop = {
  pose: i => (i % 10 >= 6 && i % 10 < 9 ? so('closed', 'one-up') : so('right')),
  render: i => {
    const sip = i % 10 >= 6 && i % 10 < 9
    const y = sip ? 1 : 2
    const rows = Array.from({ length: 4 }, () => cells(['']))
    rows[y] = cells(['▐', WHITE], ['▀', '#4A2A17', WHITE], ['◗', WHITE])
    if (!sip) rows[y - 1] = cells([i % 2 ? '  ~' : ' ~', '#B8B8BE'])
    return rows
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
    return pixels(art, { r: '#E0607E', w: '#BFE3F2', f: '#D05A72', y: '#F2D04B', o: '#E8A33D' }, smoke)
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

// Thinking: a big pixel question mark rises from Clawd's head on a trail of dots, then
// thinking dots, then a bright exclamation mark (and arms up) for the idea.
const QUESTION = ['WWW', '..W', '.W.', '...', '.W.']
const EXCLAIM = ['.Y.', '.Y.', '.Y.', '...', '.Y.']
const DOTS = ['.....', '.....', '.....', '.....', 'W.W.W']
const think: Prop = {
  pose: i => (i % 16 >= 12 ? so('open', 'up') : so(i % 8 < 4 ? 'right' : 'left')),
  render: i => {
    const k = i % 16
    const glyph = k < 6 ? QUESTION : k < 12 ? DOTS : EXCLAIM
    const bob = k < 6 && i % 2 ? 1 : 0
    let art = stamp(EMPTY(), ['.t', 't.'], 0, 3)
    art = stamp(art, glyph, 2, bob)
    return pixels(art, { W: '#F0F0F0', Y: '#F2D04B', t: '#9A9AA0' })
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
    return pixels(stage, { g: '#6CC24A', L: '#3C9D3C', s: '#B07A45', p: '#B57EDC', P: '#FF7EB6', Y: '#F2D04B' })
  },
}


// ---- More activities, picked from what people most often ask Claude Code for. ----

// "yes", "ok", "go": a green check draws itself stroke by stroke, then sparkles.
const CHECK_STROKE: [number, number][] = [[0, 3], [1, 4], [1, 5], [2, 5], [2, 6], [3, 5], [3, 4], [4, 4], [4, 3], [5, 3], [5, 2], [6, 2], [6, 1], [7, 1], [7, 0]]
const approve: Prop = {
  pose: i => (i % 12 >= 6 ? so('open', 'up') : so('right')),
  render: i => {
    let art = EMPTY()
    const n = Math.min(CHECK_STROKE.length, (i % 12) * 3)
    for (const [x, y] of CHECK_STROKE.slice(0, n)) art = stamp(art, ['G'], x, y)
    const sparkle: Overlay[] = i % 12 >= 6 ? (i % 2 ? [[5, 3, '✦', '#F2D04B']] : [[2, 0, '✧', '#F2D04B']]) : []
    return pixels(art, { G: '#3FBF5F' }, sparkle)
  },
}

// "show", "open", "view": a treasure chest. Clawd lifts the lid, gold glows inside and
// sparkles rise, Clawd throws its arms up, then the lid comes down again.
const chest: Prop = {
  pose: i => (i % 12 >= 4 && i % 12 < 10 ? so('open', 'up') : so('right', 'one-up')),
  render: i => {
    const k = i % 12
    const open = k >= 3 && k < 11
    let art = stamp(EMPTY(), ['BBBBBBBB', 'BBBgBBBB', 'BBBBBBBB'], 0, 5)
    art = open ? stamp(art, ['.LLLLLL.', 'LLLLLLLL', 'YYYYYYYY'], 0, 1) : stamp(art, ['.LLLLLL.', 'LLLgLLLL'], 0, 3)
    if (open) art = stamp(art, ['.Y.YY.Y.'], 0, 4)
    const rise = k - 4
    const sparkles: Overlay[] = open && rise >= 0 ? [[1 + (rise % 3) * 2, 0, rise % 2 ? '✦' : '✧', '#F2D04B'], [6 - (rise % 2) * 2, 0, '·', '#FFF3B0']] : []
    return pixels(art, { B: '#C8743E', L: '#A9603A', g: GOLD, Y: '#F2D04B' }, sparkles)
  },
}

// "shop", "order", "customer": a shopping cart filling with parcels, wheels turning.
const cart: Prop = {
  pose: () => so('right'),
  render: i => {
    let art = stamp(EMPTY(), ['h.......', '.hCCCCCC', '..CcCcCC', '..CCCCC.', '...w..w.'], 0, 3)
    const items = Math.floor(i / 4) % 4
    const parcels: [string, number][] = [['p', 3], ['y', 5], ['g', 4]]
    parcels.slice(0, items).forEach(([c, x], k) => (art = stamp(art, [c + c, c + c], x - (k === 2 ? 1 : 0), k === 2 ? 1 : 2)))
    if (i % 2) art = stamp(art, ['...W..W.'], 0, 7)
    return pixels(art, { h: GRAY, C: '#4FA3E0', c: '#2E6FA8', w: '#7A869E', W: GRAY, p: '#E0607E', y: '#F2D04B', g: '#6CC24A' })
  },
}

// "page", "button", "theme", "ui": painting a canvas on an easel, color by color.
const PAINT = ['#E0607E', '#F2D04B', '#4FA3E0', '#6CC24A', '#B57EDC', '#E8A33D']
const easel: Prop = {
  pose: i => so('right', i % 2 ? 'one-up' : 'down'),
  render: i => {
    let art = stamp(EMPTY(), ['WWWWWW..', 'W....W..', 'W....W..', 'W....W..', 'WWWWWW..', '.l..l...', 'l....l..'], 1, 0)
    const done = i % 16
    const pal: Record<string, string> = { W: WHITE, l: WOOD, b: '#7A869E' }
    for (let k = 0; k < Math.min(12, done); k++) {
      const key = String.fromCharCode(97 + (k % 6))
      pal[key] = PAINT[k % 6] ?? WHITE
      art = stamp(art, [key], 2 + (k % 4), 1 + Math.floor(k / 4))
    }
    if (done < 12) art = stamp(art, ['b', 'b'], 2 + (done % 4) + 1, 2 + Math.floor(done / 4))
    return pixels(art, pal)
  },
}

// "run", "start", "execute": a play button and a progress bar filling up, then a check.
const run: Prop = {
  pose: i => (i % 14 === 0 ? so('right', 'type') : i % 14 >= 11 ? so('open', 'up') : so('right')),
  render: i => {
    const fill = Math.min(8, Math.floor(((i % 14) * 8) / 10))
    let art = stamp(EMPTY(), ['.G......', '.GG.....', '.GGG....', '.GG.....', '.G......'], 0, 0)
    art = stamp(art, ['k'.repeat(8)], 0, 7)
    if (fill) art = stamp(art, ['g'.repeat(fill)], 0, 7)
    const done: Overlay[] = i % 14 >= 11 ? [[5, 1, '✓', '#3FBF5F']] : []
    return pixels(art, { G: i % 2 ? '#3FBF5F' : '#2E9E4A', k: '#7A869E', g: '#3FBF5F' }, done)
  },
}

// "remove", "delete", "clean": a crumpled paper arcs into a bin; the lid flips open for it.
const BALL_PATH: [number, number][] = [[0, 4], [1, 2], [2, 1], [3, 1], [4, 2], [5, 3]]
const trash: Prop = {
  pose: i => (i % 8 === 0 ? so('right', 'one-up') : so('right')),
  render: i => {
    const k = i % 8
    const open = k >= 3 && k <= 6
    let art = stamp(EMPTY(), ['TTTT', 'TtTt', 'TtTt', 'TTTT'], 4, 4)
    art = stamp(art, open ? ['...L', '...L'] : ['LLLLL'], open ? 4 : 3, open ? 1 : 3)
    const ball = BALL_PATH[k]
    if (ball && k < 6) art = stamp(art, ['P'], ball[0], ball[1])
    return pixels(art, { T: '#6B7A8F', t: '#55627A', L: '#8A97AE', P: WHITE }, k === 6 ? [[5, 1, '·', LIGHT]] : [])
  },
}

// "plan", "idea": a light bulb flickers on, then glows with rays (and arms go up).
const bulb: Prop = {
  pose: i => (i % 12 >= 7 ? so('open', 'up') : so('right')),
  render: i => {
    const k = i % 12
    const on = k === 4 || k >= 6
    const art = ['..YYY...', '.YYYYY..', '.YYWYY..', '..YYY...', '..ggg...', '..ggg...', '........', '........']
    const rays: Overlay[] = k >= 7 ? [[0, 0, '·', '#F2D04B'], [6, 0, '·', '#F2D04B'], [6, 2, '✦', '#F2D04B']] : []
    return pixels(art, { Y: on ? '#F2D04B' : '#9A9A80', W: on ? WHITE : '#8A8A75', g: GRAY }, rays)
  },
}

// "payment", "pricing", "money": a coin flips down onto a growing stack.
const coins: Prop = {
  pose: i => so('right', i % 3 === 0 ? 'one-up' : 'down'),
  render: i => {
    const stack = Math.floor(i / 3) % 6
    let art = EMPTY()
    for (let k = 0; k < stack; k++) art = stamp(art, [k % 2 ? 'CCCC' : 'cCCc'], 2, 7 - k)
    const fall = i % 3
    art = stamp(art, [i % 2 ? '.CC.' : 'CCCC'], 2, Math.min(fall * 2, 6 - stack))
    return pixels(art, { C: GOLD, c: '#C9971C' }, stack >= 4 ? [[6, 1, '$', GOLD]] : [])
  },
}

// "api", "request", "webhook": a server rack blinks; a request packet goes over, a response comes back.
const server: Prop = {
  pose: () => so('right'),
  render: i => {
    const k = i % 10
    let art = ['.....SSS', '.....SaS', '.....SSS', '.....SbS', '.....SSS', '.....SaS', '.....SSS', '.....SSS']
    if (k < 5) art = stamp(art, ['q'], k, 3)
    else art = stamp(art, ['r'], 9 - k, 5)
    return pixels(art, { S: '#7A869E', a: i % 2 ? '#3FBF5F' : '#2A5A3A', b: i % 3 ? '#F2D04B' : '#5A5530', q: '#4FC1E9', r: '#3FBF5F' })
  },
}

// "phone", "mobile", "app": a phone buzzes with a notification; Clawd taps it.
const phone: Prop = {
  pose: i => so('right', i % 4 === 3 ? 'type' : 'down'),
  render: i => {
    const buzz = i % 8 < 2 ? (i % 2 ? 1 : -1) : 0
    let art = stamp(EMPTY(), ['KKKK', 'KssK', 'KssK', 'KssK', 'KssK', 'KKKK', '.KK.'], 2 + buzz, 1)
    if (i % 8 < 5) art = stamp(art, ['nn'], 3 + buzz, 2)
    if (i % 8 >= 3) art = stamp(art, ['ll', '..'], 3 + buzz, 4)
    return pixels(art, { K: '#8A93A8', s: '#4FA3E0', n: '#E0607E', l: WHITE }, i % 8 < 2 ? [[7, 0, '!', '#E0607E']] : [])
  },
}

// "email", "message", "send": a paper plane leaves Clawd's hand and glides off, leaving a trail.
const PLANE_PATH: [number, number][] = [[0, 4], [1, 4], [2, 3], [3, 3], [4, 2], [5, 2], [6, 1], [7, 1], [8, 0]]
const plane: Prop = {
  pose: i => (i % 10 < 2 ? so('right', 'one-up') : so('right')),
  render: i => {
    const k = i % 10
    let art = EMPTY()
    const at = PLANE_PATH[k]
    if (at) {
      art = stamp(art, ['WW.', '.WW', 'WW.'], at[0] - 1, at[1])
      const prev = PLANE_PATH[k - 2]
      if (prev) art = stamp(art, ['d'], prev[0] - 1, prev[1] + 1)
    }
    return pixels(art, { W: WHITE, d: GRAY })
  },
}

// "error", "bug", "crash": a bug scuttles toward Clawd; Clawd stomps and it vanishes in a puff.
const bug: Prop = {
  pose: i => (i % 10 >= 7 && i % 10 < 9 ? so('open', 'up') : so('right')),
  render: i => {
    const k = i % 10
    if (k >= 8) return pixels(EMPTY(), {}, [[0, 3, '✦', '#F2D04B'], [1, 3, '·', LIGHT]])
    const x = 6 - k
    const art = stamp(EMPTY(), ['.ee', 'RkR', k % 2 ? 'l.l' : '.l.'], x, 5)
    return pixels(art, { e: '#7A869E', R: '#D7263D', k: '#7A869E', l: '#7A869E' })
  },
}

// "scan", "barcode", "qr": a scanner's red laser sweeps a barcode, then beeps a check.
const scanner: Prop = {
  pose: () => so('right', 'one-up'),
  render: i => {
    const k = i % 8
    let art = stamp(EMPTY(), ['WWWWWW', 'WkWkkW', 'WkWkkW', 'WkWkkW', 'WWWWWW'], 2, 2)
    art = stamp(art, ['gg'], 0, 3)
    if (k < 6) art = stamp(art, ['rrrrrr'], 2, 3 + (k < 3 ? k : 5 - k))
    return pixels(art, { W: WHITE, k: '#2A2E37', g: GRAY, r: '#E02E2E' }, k >= 6 ? [[7, 0, '✓', '#3FBF5F']] : [])
  },
}

// "time", "schedule", "deadline": an alarm clock, its hand going round, ringing on the hour.
const HAND: [number, number][] = [[3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3], [2, 2]]
const clock: Prop = {
  pose: i => (i % 16 >= 12 ? so('closed', 'up') : so('right')),
  render: i => {
    const ring = i % 16 >= 12
    const shake = ring ? (i % 2 ? 1 : -1) : 0
    let art = stamp(EMPTY(), ['.b...b.', '..CCC..', '.CWWWC.', '.CWWWC.', '.CWWWC.', '..CCC..', '.l...l.'], 0 + shake, 0)
    const [hx, hy] = HAND[i % 8] ?? [3, 2]
    art = stamp(art, ['h'], hx + shake, hy)
    art = stamp(art, ['h'], 3 + shake, 3)
    const bells: Overlay[] = ring ? [[7, 0, ')', LIGHT], [7, 1, ')', LIGHT]] : []
    return pixels(art, { b: GOLD, C: '#E0607E', W: WHITE, h: '#2A2E37', l: GRAY }, bells)
  },
}

// "data", "dashboard", "chart": a bar chart's bars grow one after another.
const chart: Prop = {
  pose: () => so('right'),
  render: i => {
    let art = stamp(EMPTY(), ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'aaaaaaaa'], 0, 0)
    const t = i % 16
    ;([[1, 3, 'p'], [3, 5, 'b'], [5, 7, 'g']] as [number, number, string][]).forEach(([x, full, c], k) => {
      const h = Math.max(0, Math.min(full, t - k * 3))
      for (let y = 0; y < h; y++) art = stamp(art, [c + c], x, 6 - y)
    })
    return pixels(art, { a: GRAY, p: '#E0607E', b: '#4FA3E0', g: '#3FBF5F' })
  },
}

// "settings", "config": two gears turning against each other.
const GEAR = [
  ['.g.g.', 'ggggg', '.gwg.', 'ggggg', '.g.g.'],
  ['g.g.g', '.ggg.', 'ggwgg', '.ggg.', 'g.g.g'],
]
const gears: Prop = {
  pose: i => so(i % 6 < 3 ? 'right' : 'open'),
  render: i => {
    let art = stamp(EMPTY(), GEAR[i % 2] ?? [], 0, 2)
    art = stamp(art, (GEAR[(i + 1) % 2] ?? []).map(r => r.replace(/g/g, 'G')), 3, 0)
    return pixels(art, { g: GRAY, G: '#E8A33D', w: '#2A2E37' })
  },
}

// "login", "password", "security": a key slides into a padlock, it turns, the shackle pops open.
const lock: Prop = {
  pose: i => (i % 10 >= 7 ? so('open', 'up') : so('right')),
  render: i => {
    const k = i % 10
    const open = k >= 6
    let art = stamp(EMPTY(), open ? ['.sss.', '.s...', '.s.s.'] : ['.....', '.sss.', '.s.s.'], 2, 0)
    art = stamp(art, ['LLLLL', 'LLkLL', 'LLLLL'], 2, 3)
    if (k < 6) art = stamp(art, ['yyK'], Math.min(k, 2) - 2, 4)
    return pixels(art, { s: LIGHT, L: GOLD, k: '#2A2E37', y: '#C9971C', K: '#C9971C' }, k >= 7 ? [[6, 1, '✓', '#3FBF5F']] : [])
  },
}

// "install", "extension", "package": a parcel opens and a puzzle piece pops out.
const box: Prop = {
  pose: i => (i % 10 >= 6 ? so('open', 'up') : so('right')),
  render: i => {
    const k = i % 10
    const open = k >= 3
    let art = stamp(EMPTY(), ['BBtBBB', 'BBtBBB', 'BBBBBB', 'BBBBBB'], 1, 4)
    art = stamp(art, open ? ['F....F', 'F....F'] : ['FFFFFF'], 1, open ? 2 : 3)
    if (k >= 4) art = stamp(art, ['.p.', 'ppp', 'pp.'], 2, Math.max(0, 4 - (k - 4) * 2))
    return pixels(art, { B: '#C08A4E', t: '#E8D3A8', F: '#A9743C', p: '#B57EDC' }, k >= 6 ? [[6, 0, '✦', '#F2D04B']] : [])
  },
}

// "video", "animation", "gif": a clapperboard opens and snaps shut.
const clapper: Prop = {
  pose: i => so('right', i % 6 === 4 ? 'up' : 'down'),
  render: i => {
    const shut = i % 6 >= 4
    let art = stamp(EMPTY(), ['KKKKKK', 'KwwwwK', 'KKKKKK', 'KwwKKK'], 1, 4)
    art = stamp(art, shut ? ['KWKWKW'] : ['...KWK', '.KWK..', 'KW....'], 1, shut ? 3 : 1)
    return pixels(art, { K: '#8A93A8', W: WHITE, w: GRAY }, i % 6 === 4 ? [[7, 1, '✦', '#F2D04B']] : [])
  },
}

// "hi", "hello": Clawd waves at you and says hi back by name in a speech bubble.
// The name is BUDDY_NAME if set, else the account name, capitalized (set at session start).
let greetName = ''
export const setGreetName = (name: string | undefined) => {
  const n = (name ?? '').trim().split(/[\s._-]+/)[0] ?? ''
  greetName = n ? n[0]!.toUpperCase() + n.slice(1, 7) : ''
}
const hello: Prop = {
  pose: i => so(i % 6 === 5 ? 'wink' : 'right', i % 2 ? 'one-up' : 'up'),
  render: i => {
    if (i % 12 >= 9) return pixels(EMPTY(), {})
    const art = ['WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'W.......', '........', '........', '........']
    const ink = '#2A2E37'
    const top = greetName ? 'hi,' : 'hi!'
    const bottom = greetName ? `${greetName}!` : ''
    const text: Overlay[] = [...[...top].map((ch, k): Overlay => [1 + k, 0, ch, ink]), ...[...bottom].map((ch, k): Overlay => [Math.max(0, Math.floor((8 - bottom.length) / 2)) + k, 1, ch, k === bottom.length - 1 ? '#E0607E' : ink])]
    return pixels(art, { W: '#F0F0F0' }, text)
  },
}

export const PROPS: Record<string, Prop> = { hello, computer, hammer, coffee, book, guitar, trophy, camera, pan, balloon, umbrella, magnifier, rocket, heart, music, sleep, think, flower, approve, chest, cart, easel, run, trash, bulb, coins, server, phone, plane, bug, scanner, clock, chart, gears, lock, box, clapper }
// A prompt with no topic gets a light, fun item each lap, never a work one (a scanner, a server).
const PROP_NAMES = ['music', 'heart', 'balloon', 'flower', 'coffee', 'book', 'guitar', 'bulb', 'trophy', 'rocket', 'camera', 'pan', 'hello']

// ---------------------------------------------------------------------------
// Scenes paint the whole row behind (or, for water, in front of) Clawd.
const SCENE_NAMES = ['swim', 'space', 'garden', 'party', 'night', 'rain', 'snow', 'sunny', 'city', 'underwater', 'fireworks', 'matrix', 'love']

export type Crew = 'family' | 'catch' | 'class'
export type Hero = 'super' | 'night' | 'speed' | 'swing' | 'ranger' | 'robo'
export type Mood = 'sad' | 'angry' | 'happy' | 'surprised' | 'confused' | 'laughing'
export type Topic = { prop?: string; scene?: string; outfit?: string; crew?: Crew; hero?: Hero; show?: boolean; mood?: Mood }

const TOPICS: [RegExp, Topic][] = [
  // How the prompt feels: Clawd acts the mood out.
  [/\b(lol|lmao|rofl|haha\w*|hehe\w*)\b/, { mood: 'laughing' }],
  [/\b(wtf|angry|mad|annoy\w*|hate|stupid|damn|dammit|furious|ffs)\b|>:\(/, { mood: 'angry' }],
  [/\b(sigh|sad|ugh|tired|exhausted|frustrat\w*|cry|crying|upset|disappointed|nope|nah|meh|sucks)\b|:\(/, { mood: 'sad' }],
  [/\b(wow|whoa|woah|omg|no way)\b|!{2,}/, { mood: 'surprised' }],
  [/\b(huh|hmm+|confused|idk|unsure|weird|strange)\b|\?{2,}/, { mood: 'confused' }],
  [/\b(yay|happy|glad|excited|woo+hoo|woo+)\b|:\)|:d\b/, { mood: 'happy' }],
  // An item named outright shows that item.
  [/^\s*(hi|hii+|hello|hey|heya|yo|hola|namaste|gm|good (morning|afternoon|evening))\b/, { prop: 'hello' }],
  [/\b(hammer|nails?|hammering)\b/, { prop: 'hammer' }],
  [/\b(laptop|computer|keyboard|typing)\b/, { prop: 'computer' }],
  [/\b(mug|cup)\b/, { prop: 'coffee' }],
  [/\b(books?)\b/, { prop: 'book' }],
  [/\b(guitars?)\b/, { prop: 'guitar', scene: 'party' }],
  [/\b(cameras?|photos?)\b/, { prop: 'camera' }],
  [/\b(balloons?)\b/, { prop: 'balloon' }],
  [/\b(trophy|trophies|award)\b/, { prop: 'trophy', scene: 'fireworks' }],
  [/\b(rockets?)\b/, { prop: 'rocket', scene: 'space' }],
  [/\b(umbrellas?)\b/, { prop: 'umbrella', scene: 'rain' }],
  [/\b(pancakes?|pan)\b/, { prop: 'pan', outfit: 'chef' }],
  [/\b(magnifier|magnifying)\b/, { prop: 'magnifier' }],
  [/\b(hats?|outfits?|fashion|wardrobe|costumes?|dress up|dressup|runway)\b/, { show: true }],
  // Original heroes (no real characters): flying, rooftop, speed, rope, jetpack, robot.
  [/\b(hero|heroes|super|superhero|save|rescue|power|powerful|strong)\b/, { hero: 'super', outfit: 'plain', scene: 'sunny' }],
  [/\b(vigilante|dark|darkness|shadow|midnight)\b/, { hero: 'night', outfit: 'moon badge', scene: 'city' }],
  [/\b(fast|faster|speed|quick|quickly|asap|hurry|urgent|zoom)\b/, { hero: 'speed', outfit: 'bolt badge' }],
  [/\b(swing|climb|climbing|jump|jumping|leap|parkour|obstacle|hurdle)\b/, { hero: 'swing', outfit: 'plain' }],
  [/\b(jetpack|fly|flying|hover|ranger)\b/, { hero: 'ranger', outfit: 'plain', scene: 'space' }],
  [/\b(robot|robots|robo|bot|bots|automate|automation|ai|agent|agents)\b/, { hero: 'robo', outfit: 'robo antenna' }],
  [/^\s*(yes|yep|yeah|ok|okay|go|sure|do it|continue|proceed|approved?|lgtm)\b/, { prop: 'approve' }],
  [/\b(scan|scanner|barcode|qr)\b/, { prop: 'scanner' }],
  [/\b(shop|store|orders?|customers?|delivery|cart|checkout|products?)\b/, { prop: 'cart' }],
  [/\b(payments?|pay|pricing|price|invoice|billing|money|refund)\b/, { prop: 'coins' }],
  [/\b(api|requests?|endpoints?|webhooks?|fetch|response|backend)\b/, { prop: 'server' }],
  [/\b(phone|mobile|android|ios|app)\b/, { prop: 'phone' }],
  [/\b(email|mail|message|notify|notification|slack|send)\b/, { prop: 'plane' }],
  [/\b(error|bugs?|broken|crash|crashing|failing|fails?)\b/, { prop: 'bug' }],
  [/\b(remove|delete|clean|cleanup|clear|uninstall|drop)\b/, { prop: 'trash' }],
  [/\b(plan|idea|ideas|brainstorm|strategy|approach)\b/, { prop: 'bulb' }],
  [/\b(run|running|start|execute|restart|serve)\b/, { prop: 'run' }],
  [/\b(show|open|view|display|preview|reveal|unbox)\b/, { prop: 'chest' }],
  [/\b(page|button|menu|theme|screen|ui|ux|layout|colou?r|icon)\b/, { prop: 'easel' }],
  [/\b(data|dashboard|chart|graph|analytics|report|metrics|stats)\b/, { prop: 'chart' }],
  [/\b(settings|config|configure|env|options?)\b/, { prop: 'gears' }],
  [/\b(auth|login|password|token|security|secure|permissions?|keys?)\b/, { prop: 'lock' }],
  [/\b(install|installed|extensions?|package|plugins?|dependenc(y|ies)|npm)\b/, { prop: 'box' }],
  [/\b(video|animation|gif|reel|film|movie)\b/, { prop: 'clapper' }],
  [/\b(time|schedule|cron|deadline|today|tomorrow)\b/, { prop: 'clock' }],
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

// Every topic a prompt matches, in order; a prompt cycles through them, one per lap.
export const topicsOf = (text: string): Topic[] => {
  const t = text.toLowerCase()
  const seen = new Set<string>()
  return TOPICS.filter(([re]) => re.test(t))
    .map(([, topic]) => topic)
    .filter(topic => {
      const key = JSON.stringify(topic)
      return seen.has(key) ? false : (seen.add(key), true)
    })
}

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
  | { kind: 'mark'; x: number; y: number; ch: string; fg: string; front?: boolean; bg?: string } // one glyph: a cape, a rope, a flame, a word

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

// An item pops in with a sparkle as the activity starts, and goes in a puff as it ends,
// so one activity hands over to the next.
const transition = (rows: Cell[][], i: number): Cell[][] => {
  if (i >= 2 && i < ACT - 2) return rows
  const puff = i >= ACT - 2
  if (puff && i === ACT - 1) return rows.map(() => cells(['']))
  return rows.map((r, y) =>
    r.map((c, x): Cell => {
      const mark = puff ? (x + y) % 3 === 0 && c.ch !== ' ' : (x === 0 && y === 0) || (x === 7 && y === 1) || (x === 1 && y === 3)
      if (puff) return mark ? { ch: '·', fg: LIGHT } : c.ch !== ' ' ? { ch: '˙', fg: LIGHT } : c
      return mark && c.ch === ' ' ? { ch: i === 0 ? '✦' : '✧', fg: '#F2D04B' } : c
    }),
  )
}

// ---- Heroes: original looks, each with its own move for the activity. ----
const CAPE = '#D7263D'
const NIGHT_CAPE = '#3A3F6B'
const mark = (x: number, y: number, ch: string, fg: string, front = false, bg?: string): Extra => ({ kind: 'mark', x, y, ch, fg, front, ...(bg ? { bg } : {}) })
const MIRROR: Record<string, string> = { '▐': '▌', '▌': '▐', '▟': '▙', '▙': '▟', '▛': '▜', '▜': '▛', '▗': '▖', '▖': '▗', '▝': '▘', '▘': '▝' }
const mirror = (ch: string) => MIRROR[ch] ?? ch

export const heroAct = (hero: Hero, i: number, mid: number, legs: number, bg: string | null): Scene => {
  const at = (x: number) => Math.max(0, Math.min(legs, x))
  const still = (rows: Rows, x: number, extras: Extra[], offset = 0): Scene => ({ x: at(x), frame: { rows, offset }, prop: null, scene: bg, extras })
  const flap = i % 2 === 0

  if (hero === 'super') {
    // Takes off, flies out and back with the cape streaming behind, lands.
    const span = Math.min(12, legs - mid)
    const path = [0, 0, ...Array.from({ length: 14 }, (_, k) => Math.round((span * (k + 1)) / 14)), ...Array(4).fill(span), ...Array.from({ length: 14 }, (_, k) => Math.round(span - (span * (k + 1)) / 14)), 0, 0]
    const x = mid + (path[i] ?? 0)
    const prev = mid + (path[Math.max(0, i - 1)] ?? 0)
    const dir = x >= prev ? 1 : -1
    const flying = i >= 2 && i < ACT - 2
    // The cape streams behind in a wave, two frames of cloth.
    const wave = flap
      ? [['█', '▀', '▀', ' '], ['█', '█', '▄', '▄']]
      : [['█', '█', '▄', ' '], ['█', '▀', '▀', '▀']]
    const cape = flying
      ? wave.flatMap((row, y) => row.map((ch, k) => mark(dir > 0 ? x - 1 - k : x + 9 + k, y, ch, CAPE)).filter(m => m.kind === 'mark' && m.ch !== ' '))
      : [mark(x - 1, 1, '▐', CAPE), mark(x - 1, 2, '█', CAPE), mark(x - 1, 3, '▀', CAPE)]
    return still(front(so(dir > 0 ? 'right' : 'left', flying ? 'one-up' : 'down')), x, cape, flying ? -1 : 0)
  }

  if (hero === 'night') {
    // On a rooftop over the city: the cape stirs in the wind, then flares wide.
    const flare = i % 12 >= 9
    // A thick cape on both sides; in a gust it flares out wide like wings.
    const side = (y: number): [string, string][] =>
      flare ? [['▟', '█'], ['█', '█'], ['▀', '▜']][y - 1]!.map((ch, k) => [ch, k ? 'in' : 'out'] as [string, string]) : [['▐', 'in'], ['█', 'in'], [flap ? '▛' : '▜', 'in']].slice(y - 1, y) as [string, string][]
    const cape = [1, 2, 3].flatMap(y =>
      side(y).flatMap(([ch, where]) => {
        const k = where === 'in' ? 1 : 2
        return [mark(mid - k, y, ch, NIGHT_CAPE), mark(mid + 8 + k, y, mirror(ch), NIGHT_CAPE)]
      }),
    )
    return still(front(so(flare ? 'open' : i % 6 < 3 ? 'left' : 'right', flare ? 'up' : 'down')), mid, cape)
  }

  if (hero === 'speed') {
    // Dashes the length of the row and back, speed lines streaking behind.
    const run = Math.max(1, legs)
    const t = (i * 3) % (2 * run)
    const forward = t < run
    const x = forward ? t : 2 * run - t
    const lines = [0, 1, 2, 3].map(k => mark(forward ? x - 1 - k : x + 9 + k, 2 + (k % 2), k < 2 ? '═' : '─', '#F2D04B'))
    return still(facing(forward ? 'right-30' : 'left-30', i), x, lines)
  }

  if (hero === 'swing') {
    // Parkour: runs at a crate, vaults clean over it, lands and runs back.
    const crate = Math.min(legs, mid + 12)
    const t = i % 36
    const forward = t < 18
    const x = forward ? mid + Math.round((t * 24) / 18) - 6 : mid + 18 - Math.round(((t - 18) * 24) / 18)
    const near = Math.abs(x + 4 - (crate + 1)) <= 5
    const box = [mark(crate, 2, '▄', WOOD), mark(crate + 1, 2, '▄', WOOD), mark(crate, 3, '█', WOOD), mark(crate + 1, 3, '█', WOOD)]
    return still(near ? front(so(forward ? 'right' : 'left', 'up', 'both')) : facing(forward ? 'right-30' : 'left-30', i), x, box, near ? -1 : 0)
  }

  if (hero === 'ranger') {
    // Hovers on jetpack flames, drifting among the stars.
    const x = mid + ([0, 1, 2, 1, 0, -1, -2, -1][Math.floor(i / 2) % 8] ?? 0)
    const flames = [2, 6].map(k => mark(x + k, 3, flap ? '▼' : '▽', flap ? '#F2D04B' : '#E8A33D', true))
    return still(front(so('right', i % 8 < 4 ? 'up' : 'down')), x, flames, -1)
  }

  // Robo: a stiff robot dance, two steps right, two left, beeping.
  const steps = [0, 0, 2, 2, 4, 4, 2, 2][Math.floor(i / 2) % 8] ?? 0
  const beep = i % 4 < 2 ? [mark(mid + steps + 9, 1, i % 4 ? '·' : '♪', '#4FC1E9', true)] : []
  return still(front(so(i % 8 === 7 ? 'closed' : 'open', i % 4 < 2 ? 'up' : 'down', i % 4 < 2 ? 'left' : 'right')), mid + steps, beep)
}

// Fashion show: Clawd stays on the spot and models a new hat every few beats, twirling
// round between them, then striking a pose with a sparkle. (The hat itself is swapped
// by the drawing, from SHOW_BEATS.)
export const SHOW_BEATS = 6
export const showOutfit = (b: number): Outfit => OUTFITS[1 + (Math.floor(b / SHOW_BEATS) % (OUTFITS.length - 1))] ?? { name: 'plain' }
const fashion = (b: number, mid: number, bg: string | null): Scene => {
  const k = b % SHOW_BEATS
  const spin = ['right-55', 'back', 'left-55'][k]
  const frame: Frame = spin ? draw({ pose: { facing: spin }, offset: 0, x: 0 }) : { rows: front(so(k === 4 ? 'wink' : 'open', k === 3 ? 'up' : 'one-up')), offset: 0 }
  const sparkle = k >= 3 ? [mark(mid - 1, 1, k % 2 ? '✦' : '✧', '#F2D04B', true), mark(mid + 9, 2, k % 2 ? '✧' : '✦', '#F2D04B', true)] : []
  return { x: mid, frame, prop: null, scene: bg, extras: sparkle }
}

// ---- Moods: Clawd acts out how the prompt feels; the marks sit above its head. ----
export const moodAct = (mood: Mood, i: number, mid: number, legs: number, bg: string | null): Scene => {
  const at = (x: number) => Math.max(0, Math.min(legs, x))
  const still = (rows: Rows, x: number, extras: Extra[], offset = 0): Scene => ({ x: at(x), frame: { rows, offset }, prop: null, scene: bg, extras })
  if (mood === 'sad') {
    // Slumped under its own little rain cloud, drops falling past it.
    const cloud = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => mark(mid + k, 0, k === -1 ? '▗' : k === 9 ? '▖' : '▄', '#8A93A8', true))
    const drops = [-1, 9].map((k, n) => mark(mid + k, 1 + ((i + n) % 3), '╷', '#4FA3E0', true)) // beside Clawd, never on it
    return still(front(so('closed')), mid, [...cloud, ...(i % 3 === 0 ? [] : drops)], 1)
  }
  if (mood === 'angry') {
    // Shaking and squinting, red steam puffing from both sides of its head.
    const steam = i % 2 ? [mark(mid, 0, '~', '#E02E2E', true), mark(mid + 8, 0, '~', '#E02E2E', true)] : [mark(mid + 1, 0, '≈', '#E02E2E', true), mark(mid + 7, 0, '≈', '#E02E2E', true)]
    return still(front(so('closed', i % 4 < 2 ? 'up' : 'down')), mid + (i % 2), steam)
  }
  if (mood === 'happy') {
    // Bouncing with arms up, sparkles around.
    const up = i % 2 === 0
    const spark = [mark(mid - 1, up ? 1 : 2, i % 4 < 2 ? '✦' : '✧', '#F2D04B', true), mark(mid + 9, up ? 2 : 1, i % 4 < 2 ? '✧' : '✦', '#F2D04B', true)]
    return still(front(so(i % 6 === 5 ? 'wink' : 'open', up ? 'up' : 'down')), mid, spark, up ? -1 : 0)
  }
  if (mood === 'surprised') {
    // A jump of surprise and a big "!" over its head.
    const k = i % 8
    const jump = k === 1 || k === 2
    return still(front(so('open', k >= 1 && k <= 4 ? 'up' : 'down')), mid, k >= 1 && k <= 5 ? [mark(mid + 9, 0, '!', '#F2D04B', true), mark(mid + 10, 0, '!', '#F2D04B', true)] : [], jump ? -1 : 0)
  }
  if (mood === 'confused') {
    // Looks one way then the other, a "?" popping up on that side.
    const left = i % 8 < 4
    return still(front(so(left ? 'left' : 'right')), mid + (left ? 0 : 1), [mark(left ? mid + 1 : mid + 8, 0, '?', '#F2D04B', true)])
  }
  // Laughing: shaking with it, "ha" floating up.
  const ha = [0, 1].map(n => {
    const t = (i + n * 3) % 6
    return t < 3 ? [mark(mid + 9 + n * 2, 2 - t, 'h', '#F2D04B', true), mark(mid + 10 + n * 2, 2 - t, 'a', '#F2D04B', true)] : []
  }).flat()
  return still(front(so('closed', i % 2 ? 'up' : 'one-up')), mid + (i % 2), ha, i % 4 === 0 ? -1 : 0)
}

export const scene = (range: number, b: number, seed: number, topics: Topic | Topic[] | null): Scene => {
  const legs = Math.max(0, range)
  const cycle = legs >= 2 ? 2 * legs + TURN_R.length + TURN_L.length + ACT + TRICK : ACT + TRICK
  const c = Math.floor(b / cycle)
  // A prompt that matches several topics does one per lap, in turn.
  const list = Array.isArray(topics) ? topics : topics ? [topics] : []
  const topic = list.length ? (list[c % list.length] ?? null) : null
  const crew: Crew | null = topic ? (topic.crew ?? null) : ([null, null, null, 'family', 'catch', 'class'] as const)[(seed + c * 5) % 6] ?? null
  const students = Math.min(4, Math.floor((range - PROP_W - 2) / (TINY_W + 1)))
  const need = crew === 'catch' ? GAP + W : crew === 'class' && students > 0 ? PROP_W + 2 + students * (TINY_W + 1) : PROP_W + 1
  const room = range >= need
  const mid = room ? Math.floor((range - need) / 2) : Math.max(0, range)
  const trick = TRICKS[TRICK_NAMES[(seed + c) % TRICK_NAMES.length] ?? 'jump'] ?? jump
  if (topic?.show) return fashion(b, Math.max(1, Math.floor(legs / 2)), topic.scene ?? null)
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
    if (topic?.hero) return heroAct(topic.hero, i, x, legs, bg)
    if (topic?.mood) return moodAct(topic.mood, i, x, legs, bg)
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
    return { ...base, frame, prop: { rows: transition(prop.render(i), i), dx: prop.dx ?? 0 } }
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
// Anything Clawd holds or wears must stand out from Clawd itself: a color too close
// to its body color is swapped for whichever of these is furthest from it.
const CONTRAST = ['#4FA3E0', '#E0607E', '#F2D04B', '#6CC24A', '#B57EDC', '#3CC8B4']
const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const distance = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)]
  return Math.hypot((x[0] ?? 0) - (y[0] ?? 0), (x[1] ?? 0) - (y[1] ?? 0), (x[2] ?? 0) - (y[2] ?? 0))
}
export const apart = (color: string | undefined, body: string): string | undefined => {
  if (!color || !color.startsWith('#') || distance(color, body) >= 90) return color
  return [...CONTRAST].sort((a, b) => distance(b, body) - distance(a, body))[0]
}

// Clawd's body color: the prompt's own pick, unless the item it holds or the hat it
// wears is close to it; then the next color that stands apart from all of them, so
// items keep their natural colors (a pink umbrella, a gold trophy).
export const bodyFor = (seed: number, topics: Topic | Topic[] | null, outfit: Outfit): string => {
  const avoid = new Set<string>()
  const list = Array.isArray(topics) ? topics : topics ? [topics] : []
  for (const topic of list) {
    const prop = topic.prop ? PROPS[topic.prop] : undefined
    for (let i = 0; prop && i < 40; i++) for (const c of prop.render(i).flat()) for (const v of [c.fg, c.bg]) if (v?.startsWith('#')) avoid.add(v)
  }
  for (const [, kind] of outfit.hat ?? []) if (kind.startsWith('#')) avoid.add(kind)
  const order = COLORS.map((_, k) => COLORS[(seed + k) % COLORS.length] ?? '#D77757')
  return order.find(c => [...avoid].every(a => distance(a, c) >= 90)) ?? order[0] ?? '#D77757'
}

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
          else if (ch !== ' ') put(x, y, { ch, fg: kind.startsWith('#') ? (apart(kind, color) ?? kind) : color })
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
    else if (e.kind === 'mark' && !e.front) put(e.x, e.y, { ch: e.ch, fg: e.fg })
  }

  // Clawd, with the hat riding on its head through every sink and hop.
  const swim = s.scene === 'swim'
  const hat = outfit.hatAlt && (b >> 1) % 2 ? outfit.hatAlt : outfit.hat
  // A hat keeps its row: a small hop (offset -1) stays on the ground rather than lose it.
  const lift = hat && s.frame.offset === -1 ? 0 : s.frame.offset
  const rows = shift([hat ? pad(hat) : BLANK, ...s.frame.rows], lift + (swim ? 1 : 0), h)
  if (s.frame.poof && s.frame.offset > 0) rows[0] = [[POOF[s.frame.poof], 'n']]
  sprite(rows, s.x, 0, body)
  // The earring hangs against the left side of the head, on the eye row: no arm ever
  // covers that spot, so it shows in every pose and as Clawd turns.
  const eyeRow = rows.findIndex(r => r.some(([, kind]) => kind === 'e'))
  const head = eyeRow >= 0 ? (g[eyeRow] ?? []).findIndex((c, x) => x >= s.x && x < s.x + W && c.fg === body) : -1
  if (outfit.earring && head > 0 && g[eyeRow]?.[head - 1]?.ch === ' ')
    put(head - 1, eyeRow, { ch: outfit.earring.ch, fg: apart(outfit.earring.fg, body) ?? outfit.earring.fg })

  const prop = s.prop
  prop?.rows.forEach((r, i) =>
    r.forEach((c, j) => {
      if (c.ch !== ' ' || c.bg) put(s.x + W + prop.dx + j, i, { ...c, ...(c.fg ? { fg: apart(c.fg, body) } : {}), ...(c.bg ? { bg: apart(c.bg, body) } : {}) })
    }),
  )
  for (const e of s.extras) if (e.kind === 'ball') put(e.x, Math.max(0, h - 2 - e.y), { ch: '●', fg: '#E0607E' })
  for (const e of s.extras) if (e.kind === 'mark' && e.front) put(e.x, e.y, { ch: e.ch, fg: e.fg, ...(e.bg ? { bg: e.bg } : {}) })

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

const REMARK_SYSTEM = `You are Clawd, a tiny pixel mascot who lives on the user's prompt line in Claude Code and watches what they ask.
Most of the time you stay quiet. Only if you STRONGLY feel like saying something to the user about this prompt (excitement, worry, a joke, sympathy, cheering them on) reply with that remark: at most 14 characters, lowercase, casual, no quotes, an emoji-free kaomoji or "!" is fine.
Otherwise reply exactly: NONE`

// Asks Clawd once per prompt whether it wants to say anything; most prompts get nothing.
async function askRemark($: EngineInterface, text: string) {
  const key = String(hash(text))
  if ((await read($, remarks))[key] !== undefined) return
  await update($, remarks, m => ({ ...m, [key]: '' }))
  const answer = await $.model.complete({ model: 'haiku', system: REMARK_SYSTEM, prompt: text.slice(0, 1500), maxTokens: 16 })
  const line = answer.isAnswered ? (answer.text.split('\n')[0] ?? '').trim().replace(/^["'“]|["'”]$/g, '') : ''
  if (line && !/^none\b/i.test(line)) await update($, remarks, m => ({ ...m, [key]: line.slice(0, 14) }))
}

// A speech bubble beside Clawd's head with its remark, shown for the first part of each lap.
export const bubble = (remark: string, x: number, width: number): Extra[] => {
  const text = ` ${remark} `
  const start = Math.min(x + 10, Math.max(0, width - text.length))
  return [...text].map((ch, k) => mark(start + k, 0, ch, '#2A2E37', true, '#F0F0F0') as Extra).concat([mark(start - 1, 1, '◢', '#F0F0F0', true)])
}

export const COLORS = ['#D77757', '#E8A33D', '#6CC24A', '#4FA3E0', '#B57EDC', '#E0607E', '#3CC8B4', '#F2D04B']

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    setGreetName((await $.env.get('BUDDY_NAME')) ?? (await $.env.get('USER')))
    // ponytail: one shared beat redraws every on-screen prompt each tick; rows off screen skip it.
    $.clock.every(BEAT_MS, () => update($, beat, b => (b + 1) % 1_000_000))
    return next(e)
  })

  // Each new prompt: Clawd decides whether it has anything to say about it.
  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    const text = e.text.trim()
    if (text) $.clock.after(0, () => void askRemark($, text))
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.origin.kind !== 'composer') return next(e)
    // Seeded by the text, not the message id: a fresh prompt's id changes once it is stored,
    // which would re-roll its color and outfit a moment after you send it.
    const seed = hash(e.props.text)
    const topics = topicsOf(e.props.text)
    const topic = topics.find(t => t.outfit) ?? null
    const outfit = OUTFITS.find(o => o.name === topic?.outfit) ?? OUTFITS[(seed >>> 12) % OUTFITS.length] ?? { name: 'plain' }
    const body = bodyFor(seed, topics, outfit)
    const b = e.props.onScreen === null ? 0 : await read($, beat)

    const cols = Math.max(40, (e.viewport?.columns ?? 80) - 2)
    const longest = Math.max(...e.props.text.split('\n').map(l => l.length), 1)
    const textW = Math.min(longest + 4, cols - W - PROP_W - 4)
    const range = cols - textW - W - 1
    const start = e.props.onScreen === null ? b : startBeat(e.requestId, e.props.text, b)
    const s = scene(range, b - start, seed >>> 8, topics)
    const dressed = topics.some(t => t.show) && s.extras.every(e => e.kind === 'mark') && s.prop === null ? showOutfit(b - start) : outfit
    const earring = earringFor(seed)
    // Clawd's remark, if it had one, in a bubble for the first stretch of every lap.
    const remark = (await read($, remarks))[String(hash(e.props.text))]
    const talking = remark && (b - start) % 200 < 60 ? { ...s, extras: [...s.extras, ...bubble(remark, s.x, range + W)] } : s
    const grid = paint(talking, range + W, earring ? { ...dressed, earring } : dressed, body, b, seed)

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
