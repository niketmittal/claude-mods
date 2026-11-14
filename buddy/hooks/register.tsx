import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const beat = atom({ plugin: 'buddy', key: 'beat' } as const, 0)

const BEAT_MS = 180
const W = 9
const PROP_W = 6
const EYE_BG = '#000000'
const BAR_BG = 'userMessageBackground'

// ---------------------------------------------------------------------------
// Clawd's sprite, as Claude Code draws it.
// A span is [text, kind]: 'n' body, 'e' eye (dark background), 'l' eyelid (dark on body).
type Kind = 'n' | 'e' | 'l'
type Span = [string, Kind]
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
  return [pad([[a.r1L, 'n'], ...EYES[eyes], [a.r1R, 'n']]), [[a.r2L, 'n'], ['█████', 'e'], [a.r2R, 'n']], [[FEET[feet], 'n']]]
}

export const facing = (name: string, stride: number | null = null): Rows => {
  const rows = FACING[name] ?? FACING['right-30'] ?? []
  const row = (i: number): Span[] => {
    const [g, from, to] = rows[i] ?? ['', 0, 0]
    const cs = [...g]
    return [[cs.slice(0, from).join(''), 'n'], [cs.slice(from, to).join(''), 'e'], [cs.slice(to).join(''), 'n']]
  }
  return [row(0), row(1), stride === null ? row(2) : [[STRIDE[stride % 2] ?? '', 'n']]]
}

// Shift a 3-row sprite down (offset > 0, sinking) or up (offset < 0), clipped to 3 rows.
const shift = (rows: Rows, offset: number): Rows => {
  const o = Math.max(-3, Math.min(3, offset))
  return o >= 0 ? [...Array(o).fill(BLANK), ...rows].slice(0, 3) : [...rows.slice(-o), ...Array(-o).fill(BLANK)]
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

export const draw = (k: Key): Rows => {
  const p = k.pose
  const rows = typeof p === 'string' ? front(NAMED[p] ?? so('open')) : 'facing' in p ? facing(p.facing) : front(p)
  const out = shift(rows, k.offset)
  return k.poof && k.offset > 0 ? [[[POOF[k.poof], 'n']], ...out.slice(1)] : out
}

// ---------------------------------------------------------------------------
// What the prompt is about decides what Clawd does with a prop beside it.
type Prop = { color: string; frames: string[][]; lift?: number[]; pose: (i: number) => Pose }

export const PROPS: Record<string, Prop> = {
  computer: {
    color: '#7FB2E5',
    frames: [['▗▄▄▄▖ ', '▐▒░▒▌ ', '▀▀▀▀▀▀'], ['▗▄▄▄▖ ', '▐░▒░▌ ', '▀▀▀▀▀▀']],
    pose: i => so('right', i % 2 ? 'one-up' : 'down'),
  },
  hammer: {
    color: '#C8C8C8',
    frames: [['▄█▄   ', ' ▐    ', '   ▁▁▁'], ['      ', '▄█▄ ✦ ', ' ▐ ▁▁▁']],
    pose: i => so('right', i % 2 ? 'one-up' : 'up'),
  },
  magnifier: {
    color: '#E8A33D',
    frames: [['▗▀▖   ', '▝▄▘   ', '  ▚   '], [' ▗▀▖  ', ' ▝▄▘  ', '   ▚  ']],
    pose: i => so(i % 4 < 2 ? 'right' : 'open'),
  },
  rocket: {
    color: '#E0607E',
    frames: [[' ▗▖   ', '▐██▌  ', ' ▾▾   '], [' ▗▖   ', '▐██▌  ', ' ▿▿   ']],
    lift: [0, 0, 0, 0, 0, 0, -1, -2, -3, -3, 3, 2, 1],
    pose: i => (i % 13 >= 6 && i % 13 < 10 ? so('open', 'up') : so('right')),
  },
  think: {
    color: '#B0B0B0',
    frames: [['( ? ) ', '°     ', '      '], ['( ‥ ) ', '°     ', '      ']],
    pose: i => so(i % 6 < 3 ? 'right' : 'left'),
  },
  heart: {
    color: '#E0607E',
    frames: [['  ♥   ', '      ', '      '], [' ♥  ♥ ', '      ', '      ']],
    lift: [2, 1, 0, 0, 1, 2],
    pose: i => (i % 6 === 2 ? so('wink') : so('right')),
  },
  music: {
    color: '#B57EDC',
    frames: [['♪     ', '   ♫  ', '      '], ['   ♫  ', '♪     ', '      ']],
    pose: i => so('open', i % 4 < 2 ? 'up' : 'down', i % 2 ? 'left' : 'right'),
  },
  sleep: {
    color: '#7FB2E5',
    frames: [['   z  ', '  z   ', '      '], [' Z    ', '   z  ', '  z   ']],
    pose: () => so('closed'),
  },
}
const PROP_NAMES = Object.keys(PROPS)

const TOPICS: [RegExp, string][] = [
  [/\b(git|commit|push|pull|merge|rebase|branch|pr|diff|stash|checkout|cherry-pick|github|gitlab)\b/, 'computer'],
  [/\b(deploy|ship|release|launch|publish|prod|production|rollout)\b/, 'rocket'],
  [/\b(thanks|thank you|thx|nice|cool|great|love|awesome|perfect)\b/, 'heart'],
  [/\b(dance|play|music|fun|party|game|song)\b/, 'music'],
  [/\b(later|break|sleep|tired|wait|night|pause)\b/, 'sleep'],
  [/\b(search|find|look|grep|research|investigate|debug|check|test|inspect|trace|why)\b/, 'magnifier'],
  [/\b(fix|build|implement|refactor|edit|change|add|make|create|write|tool|update|install|setup|set up)\b/, 'hammer'],
  [/\?\s*$|^\s*(how|what|why|when|where|which|can|should|is|does|do)\b/, 'think'],
]

export const topicOf = (text: string): string | null => {
  const t = text.toLowerCase()
  return TOPICS.find(([re]) => re.test(t))?.[1] ?? null
}

// ---------------------------------------------------------------------------
// One walk cycle: walk right to the middle, do the prompt's activity, walk on,
// turn, walk back to the middle, do a random trick, walk home, turn. Each cycle
// picks a new trick (and, for a prompt with no topic, a new activity).
const ACT = 26
const TRICK = 30
const TURN_R = ['right-12', 'front', 'up', 'front', 'left-12']
const TURN_L = ['left-12', 'front', 'up', 'front', 'right-12']
const turnKey = (name: string): Key => (name === 'front' ? NO : name === 'up' ? { ...NO, pose: 'arms-up' } : { ...NO, pose: { facing: name } })

export type Scene = { x: number; rows: Rows; prop: { rows: string[]; color: string } | null }

export const scene = (range: number, b: number, seed: number, topic: string | null): Scene => {
  const room = range >= PROP_W + 1
  const mid = room ? Math.floor((range - PROP_W - 1) / 2) : Math.max(0, range)
  const legs = Math.max(0, range)
  const cycle = legs >= 2 ? 2 * legs + TURN_R.length + TURN_L.length + ACT + TRICK : ACT + TRICK
  const c = Math.floor(b / cycle)
  const trick = TRICKS[TRICK_NAMES[(seed + c) % TRICK_NAMES.length] ?? 'jump'] ?? jump
  const prop = PROPS[topic ?? PROP_NAMES[(seed + c * 7) % PROP_NAMES.length] ?? 'music']

  const act = (i: number, x: number): Scene => {
    const rows = front(prop?.pose(i) ?? so('open'))
    if (!room || !prop) return { x, rows, prop: null }
    const frame = prop.frames[Math.floor(i / 2) % prop.frames.length] ?? []
    const lift = prop.lift ? (prop.lift[i % prop.lift.length] ?? 0) : 0
    const lifted = shift(frame.map(s => [[s, 'n'] as Span]), lift).map(r => r.map(([s]) => s).join(''))
    return { x, rows, prop: { rows: lifted, color: prop.color } }
  }
  const doTrick = (i: number, x: number): Scene => {
    const k = trick[i] ?? NO
    return { x: Math.max(0, Math.min(legs, x + k.x)), rows: draw(k), prop: null }
  }

  let t = b % cycle
  if (legs < 2) return t < ACT ? act(t, mid) : doTrick(t - ACT, mid)

  const walkTo = (from: number, dir: 1 | -1, i: number): Scene => ({
    x: from + dir * i,
    rows: facing(dir > 0 ? 'right-30' : 'left-30', i),
    prop: null,
  })
  const turnAt = (x: number, names: string[], i: number): Scene => ({ x, rows: draw(turnKey(names[i] ?? 'front')), prop: null })

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
  return { x: 0, rows: draw(NO), prop: null }
}

export const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
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
    const seed = hash(e.requestId)
    const color = COLORS[seed % COLORS.length] ?? '#D77757'
    const b = e.props.onScreen === null ? 0 : await read($, beat)

    const cols = Math.max(40, (e.viewport?.columns ?? 80) - 2)
    const longest = Math.max(...e.props.text.split('\n').map(l => l.length), 1)
    const textW = Math.min(longest + 4, cols - W - PROP_W - 4)
    const range = cols - textW - W - 1
    const s = scene(range, b + (seed >>> 4), seed >>> 8, topicOf(e.props.text))

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center" backgroundColor={BAR_BG} paddingRight={1}>
        <Box width={textW} flexShrink={0}>
          <Text>
            <Text dimColor>{'❯ '}</Text>
            {e.props.text}
          </Text>
        </Box>
        <Box flexDirection="row" flexShrink={0} marginLeft={s.x}>
          <Box flexDirection="column" flexShrink={0}>
            {s.rows.map((row, i) => (
              <Text key={String(i)} color={color}>
                {row.map(([t, kind], j) =>
                  kind === 'e' ? (
                    <Text key={String(j)} backgroundColor={EYE_BG}>
                      {t}
                    </Text>
                  ) : kind === 'l' ? (
                    <Text key={String(j)} color={EYE_BG} backgroundColor={color}>
                      {t}
                    </Text>
                  ) : (
                    t
                  ),
                )}
              </Text>
            ))}
          </Box>
          {s.prop ? (
            <Box flexDirection="column" flexShrink={0} marginLeft={1}>
              {s.prop.rows.map((r, i) => (
                <Text key={String(i)} color={s.prop?.color}>
                  {r}
                </Text>
              ))}
            </Box>
          ) : null}
        </Box>
      </Box>
    )
  })
}
