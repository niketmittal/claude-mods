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
type Arms = 'down' | 'up' | 'one-up'
type Feet = 'both' | 'left' | 'right'
type Pose = { eyes: Eyes; arms: Arms; feet: Feet }

const ARMS: Record<Arms, { r1L: string; r1R: string; r2L: string; r2R: string }> = {
  down: { r1L: ' ▐', r1R: '', r2L: '▝▜', r2R: '█▀' },
  up: { r1L: '▗▟', r1R: '▄', r2L: ' ▜', r2R: '█▘' },
  'one-up': { r1L: ' ▐', r1R: '▄', r2L: '▝▜', r2R: '█▘' },
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
const BLANK: Span[] = [[' '.repeat(W), 'n']]

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

const jump = [...Cr(), ...Se('arms-up', 3), ...Se('default', 1), ...Cr(), ...Se('arms-up', 3), ...Se('default', 1)]
export const TRICKS: Record<string, Key[]> = {
  jump,
  look: [...Se('look-right', 5), ...Se('look-left', 5), ...Se('default', 1)],
  celebrate: [...jump, ...Se('default', 3, { offset: 1 })],
  spin: [...Se('look-left', 2), ...Se('look-right', 2), ...Se('look-left', 2), ...Se('arms-up', 3), ...Se('default', 1)],
  skip: [
    ...Se('arms-up', 2, { x: -6 }), ...Se('default', 1, { x: -6 }), ...Se('default', 1, { offset: 1, x: -6 }),
    ...Se('arms-up', 2, { x: -3 }), ...Se('default', 1, { x: -3 }), ...Se('default', 1, { offset: 1, x: -3 }),
    ...Se('arms-up', 2), ...Cr(), ...Se('default', 1),
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
  'coin-hop': [...Se('default', 2, { offset: 1 }), ...Se('arms-up', 1), ...Mr(['right-55', 'edge', 'back-125', 'back']), ...Mr(['back-125', 'edge', 'left-55']), ...Se('arms-up', 1), ...Cr(), NO],
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
// Props: what the prompt is about decides what Clawd does with a thing beside it.
// A prop draws 3 rows of PROP_W cells per beat of the activity; a space with no
// background is see-through.
type Prop = { render: (i: number) => Cell[][]; pose: (i: number) => Pose }

const cells = (...parts: [string, string?, string?][]): Cell[] => {
  const row = parts.flatMap(([t, fg, bg]) => [...t].map(ch => ({ ch, fg, bg })))
  return [...row, ...Array.from({ length: Math.max(0, PROP_W - row.length) }, () => ({ ch: ' ' }))].slice(0, PROP_W)
}

// A prop drawn from plain text frames, one color (plus per-glyph tints), optionally bobbing.
const simple = (color: string, frames: string[][], pose: Prop['pose'], tint: Record<string, string> = {}, lift: number[] = []): Prop => ({
  pose,
  render: i => {
    const rows = (frames[Math.floor(i / 2) % frames.length] ?? []).map(r => [...r].map(ch => ({ ch, fg: tint[ch] ?? color })))
    const o = lift.length ? (lift[i % lift.length] ?? 0) : 0
    const blank = () => cells([''])
    const shifted = o >= 0 ? [...Array.from({ length: o }, blank), ...rows].slice(0, 3) : [...rows.slice(-o), ...Array.from({ length: -o }, blank)].slice(0, 3)
    return shifted.map(r => cells(...r.map(c => [c.ch, c.fg] as [string, string])))
  },
})

const GRAY = '#9A9AA0'
const SCREEN = '#16232B'
const WOOD = '#A0522D'

export const PROPS: Record<string, Prop> = {
  // A laptop: commits appear one by one on a dark screen as Clawd types; keys flash.
  computer: {
    pose: i => so('right', i % 2 ? 'one-up' : 'down'),
    render: i => {
      const typed = Math.floor(i / 2) % 9
      const graph = '●─●─●─'.slice(0, Math.min(6, typed))
      const cursor = i % 2 ? '_' : ' '
      const screen = (graph + cursor).padEnd(6).slice(0, 6)
      const key = 1 + ((i * 5) % 6)
      return [
        cells(['▗▄▄▄▄▄▄▖', GRAY]),
        cells(['▐', GRAY], [screen, '#6CC24A', SCREEN], ['▌', GRAY]),
        cells(['▀'.repeat(key), GRAY], ['▀', '#FFFFFF'], ['▀'.repeat(7 - key), GRAY]),
      ]
    },
  },
  // A hammer: raised in Clawd's hand, then down on a nail that sinks into the board, with a spark.
  hammer: {
    pose: i => (i % 4 < 2 ? so('right', 'one-up') : so('right', 'down')),
    render: i => {
      const up = i % 4 < 2
      const nail = Math.floor(i / 4) % 3 // 0 tall, 1 short, 2 driven in
      const board = cells(['  ', ''], ['▀▀▀▀▀▀', WOOD])
      if (up)
        return [
          cells(['━━━━', WOOD], ['▐█▌', '#C8C8C8']),
          nail === 2 ? cells(['']) : cells(['     ', ''], [nail === 0 ? '┃' : '╻', GRAY]),
          board,
        ]
      return [cells(['       ', ''], [i % 4 === 2 ? '✦' : ' ', '#F2D04B']), cells(['━━━━', WOOD], ['▐█▌', '#C8C8C8']), board]
    },
  },
  magnifier: simple('#E8A33D', [['▗▀▖     ', '▝▄▘     ', '  ▚     '], [' ▗▀▖    ', ' ▝▄▘    ', '   ▚    ']], i => so(i % 4 < 2 ? 'right' : 'open')),
  rocket: simple(
    '#E0607E',
    [[' ▗▖     ', '▐██▌    ', ' ▾▾     '], [' ▗▖     ', '▐██▌    ', ' ▿▿     ']],
    i => (i % 13 >= 6 && i % 13 < 10 ? so('open', 'up') : so('right')),
    { '▾': '#F2D04B', '▿': '#E8A33D' },
    [0, 0, 0, 0, 0, 0, -1, -2, -3, -3, 3, 2, 1],
  ),
  think: simple('#B0B0B0', [['( ? )   ', '°       ', '        '], ['( ‥ )   ', '°       ', '        ']], i => so(i % 6 < 3 ? 'right' : 'left')),
  heart: simple('#E0607E', [['  ♥     ', '        ', '        '], [' ♥  ♥   ', '        ', '        ']], i => (i % 6 === 2 ? so('wink') : so('right')), {}, [2, 1, 0, 0, 1, 2]),
  music: simple('#B57EDC', [['♪       ', '   ♫    ', '        '], ['   ♫    ', '♪       ', '        ']], i => so('open', i % 4 < 2 ? 'up' : 'down', i % 2 ? 'left' : 'right')),
  sleep: simple('#7FB2E5', [['   z    ', '  z     ', '        '], [' Z      ', '   z    ', '  z     ']], () => so('closed')),
  flower: simple(
    '#6CC24A',
    [['        ', '  .     ', '  ┃     '], ['  o     ', '  ┃     ', '  ┃     '], ['  ❀     ', ' ╲┃     ', '  ┃     '], ['  ✿     ', ' ╲┃╱    ', '  ┃     ']],
    i => (i % 8 === 7 ? so('closed', 'one-up') : so('right', 'one-up')),
    { '✿': PINK, '❀': PINK, o: '#F2D04B' },
  ),
}
const PROP_NAMES = ['computer', 'hammer', 'magnifier', 'rocket', 'heart', 'music', 'sleep', 'flower']

// ---------------------------------------------------------------------------
// Scenes paint the whole row behind (or, for water, in front of) Clawd.
const SCENE_NAMES = ['swim', 'space', 'garden', 'party', 'night', 'rain', 'snow', 'sunny', 'city', 'underwater', 'fireworks', 'matrix', 'love']

export type Topic = { prop?: string; scene?: string; outfit?: string }

const TOPICS: [RegExp, Topic][] = [
  [/\b(christmas|xmas|santa|holidays?)\b/, { scene: 'snow', outfit: 'santa' }],
  [/\b(pirate|treasure|ahoy)\b/, { scene: 'swim', outfit: 'pirate' }],
  [/\b(wizard|magic|spell)\b/, { scene: 'space', outfit: 'wizard' }],
  [/\b(chef|cook|cooking|recipe|food|bake)\b/, { prop: 'hammer', outfit: 'chef' }],
  [/\b(ninja|stealth|secret|sneaky)\b/, { scene: 'night', outfit: 'ninja' }],
  [/\b(learn|study|course|school|tutorial|teach|explain)\b/, { prop: 'think', outfit: 'graduate' }],
  [/\b(birthday|anniversary)\b/, { prop: 'heart', scene: 'fireworks', outfit: 'party hat' }],
  [/\b(git|commit|push|pull|merge|rebase|branch|pr|diff|stash|checkout|cherry-pick|github|gitlab)\b/, { prop: 'computer' }],
  [/\b(code|coding|hack|hacker|matrix|algorithm|binary|terminal)\b/, { prop: 'computer', scene: 'matrix' }],
  [/\b(deploy|ship|release|launch|publish|prod|production|rollout)\b/, { prop: 'rocket', scene: 'space' }],
  [/\b(space|stars?|moon|galaxy|planet|orbit|astronaut|cosmic|alien)\b/, { prop: 'rocket', scene: 'space', outfit: 'alien' }],
  [/\b(fish|underwater|dive|diving|submarine|reef|aquarium)\b/, { scene: 'underwater' }],
  [/\b(swim|swimming|pool|beach|water|ocean|sea|surf|waves?|float|stream)\b/, { scene: 'swim' }],
  [/\b(rain|rainy|storm|weather|umbrella)\b/, { scene: 'rain' }],
  [/\b(snow|winter|cold|ice|freeze|frozen)\b/, { scene: 'snow' }],
  [/\b(sun|sunny|summer|vacation|weekend|trip)\b/, { scene: 'sunny', outfit: 'sombrero' }],
  [/\b(server|servers|infra|infrastructure|kubernetes|k8s|docker|cluster|city|cloud)\b/, { prop: 'computer', scene: 'city' }],
  [/\b(fireworks|new year|milestone|shipped|done|finished|celebrate)\b/, { prop: 'music', scene: 'fireworks' }],
  [/\b(love|heart|crush)\b|<3/, { prop: 'heart', scene: 'love' }],
  [/\b(flowers?|garden|plants?|grow|bloom|seed|tree|spring|pretty|cute|beautiful|style|styling|design|css)\b/, { prop: 'flower', scene: 'garden' }],
  [/\b(thanks|thank you|thx|nice|cool|great|awesome|perfect|congrats|yay)\b/, { prop: 'heart', scene: 'party' }],
  [/\b(dance|play|music|fun|party|game|song)\b/, { prop: 'music', scene: 'party' }],
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
const ACT = 26
const TRICK = 30
const TURN_R = ['right-12', 'front', 'up', 'front', 'left-12']
const TURN_L = ['left-12', 'front', 'up', 'front', 'right-12']
const turnKey = (name: string): Key => (name === 'front' ? NO : name === 'up' ? { ...NO, pose: 'arms-up' } : { ...NO, pose: { facing: name } })

export type Scene = { x: number; frame: Frame; prop: Cell[][] | null; scene: string | null }

export const scene = (range: number, b: number, seed: number, topic: Topic | null): Scene => {
  const room = range >= PROP_W + 1
  const mid = room ? Math.floor((range - PROP_W - 1) / 2) : Math.max(0, range)
  const legs = Math.max(0, range)
  const cycle = legs >= 2 ? 2 * legs + TURN_R.length + TURN_L.length + ACT + TRICK : ACT + TRICK
  const c = Math.floor(b / cycle)
  const trick = TRICKS[TRICK_NAMES[(seed + c) % TRICK_NAMES.length] ?? 'jump'] ?? jump
  const bg = topic ? (topic.scene ?? null) : ([null, null, ...SCENE_NAMES][(seed + c * 3) % (SCENE_NAMES.length + 2)] ?? null)
  const swim = bg === 'swim'
  const propName = topic ? topic.prop : PROP_NAMES[(seed + c * 7) % PROP_NAMES.length]
  const prop = swim ? undefined : propName ? PROPS[propName] : undefined

  const plain = (k: Key): Frame => draw(k)
  const act = (i: number, x: number): Scene => {
    if (swim) return { x, frame: { rows: front(so(i % 6 < 3 ? 'open' : 'right', i % 4 < 2 ? 'up' : 'one-up')), offset: 0 }, prop: null, scene: bg }
    const frame: Frame = { rows: front(prop?.pose(i) ?? so('open')), offset: 0 }
    if (!room || !prop) return { x, frame, prop: null, scene: bg }
    return { x, frame, prop: prop.render(i), scene: bg }
  }
  const doTrick = (i: number, x: number): Scene => {
    const k = trick[i] ?? NO
    return { x: Math.max(0, Math.min(legs, x + k.x)), frame: plain(k), prop: null, scene: bg }
  }

  let t = b % cycle
  if (legs < 2) return t < ACT ? act(t, mid) : doTrick(t - ACT, mid)

  const walkTo = (from: number, dir: 1 | -1, i: number): Scene => ({
    x: from + dir * i,
    frame: { rows: facing(dir > 0 ? 'right-30' : 'left-30', i), offset: 0 },
    prop: null,
    scene: bg,
  })
  const turnAt = (x: number, names: string[], i: number): Scene => ({ x, frame: plain(turnKey(names[i] ?? 'front')), prop: null, scene: bg })

  const segs: [number, (i: number) => Scene][] = [
    [mid, i => walkTo(0, 1, i)],
    [ACT, i => act(i, mid)],
    [legs - mid, i => walkTo(mid, 1, i)],
    [TURN_R.length, i => turnAt(legs, TURN_R, i)],
    [legs - mid, i => walkTo(legs, -1, i)],
    [TRICK, i => doTrick(i, mid)],
    [mid, i => walkTo(mid, -1, i)],
    [TURN_L.length, i => turnAt(0, TURN_L, i)],
  ]
  for (const [len, f] of segs) {
    if (t < len) return f(t)
    t -= len
  }
  return { x: 0, frame: plain(NO), prop: null, scene: bg }
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
  const h = outfit.hat ? 4 : 3
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

  // Clawd, with the hat riding on its head through every sink and hop.
  const swim = s.scene === 'swim'
  const hat = outfit.hatAlt && (b >> 1) % 2 ? outfit.hatAlt : outfit.hat
  const sprite: Rows = hat ? [pad(hat), ...s.frame.rows] : s.frame.rows
  const rows = shift(sprite, s.frame.offset + (swim ? 1 : 0), h)
  if (s.frame.poof && s.frame.offset > 0) rows[0] = [[POOF[s.frame.poof], 'n']]
  rows.forEach((spans, y) => {
    let x = s.x
    for (const [text, kind] of spans)
      for (const ch of text) {
        if (kind === 'e' && ch !== '█') put(x, y, { ch, fg: body, bg: EYE_BG })
        else if (kind === 'l') put(x, y, { ch, fg: EYE_BG, bg: body })
        else if (kind === 'e') put(x, y, { ch, fg: body })
        else if (ch !== ' ') put(x, y, { ch, fg: kind.startsWith('#') ? kind : body })
        else put(x, y, { ch: ' ' }) // Clawd is solid: the scene does not show through
        x++
      }
  })

  s.prop?.forEach((r, i) =>
    r.forEach((c, j) => {
      put(s.x + W + 1 + j, h - 3 + i, c)
    }),
  )

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
    const s = scene(range, b + (seed >>> 4), seed >>> 8, topic)
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
