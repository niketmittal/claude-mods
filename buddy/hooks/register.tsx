import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const beat = atom({ plugin: 'buddy', key: 'beat' } as const, 0)

const BEAT_MS = 220
const W = 9
const EYE_BG = '#000000'

// Clawd's own sprite, as Claude Code draws it: arms, eyes, feet and turn frames.
// A span is [text, isEye]: eye spans get the dark background that makes the eyes show.
type Span = [string, boolean]
type Frame = [Span[], Span[], Span[]]

const ARMS = {
  down: { r1L: ' ▐', r1R: '', r2L: '▝▜', r2R: '█▀' },
  up: { r1L: '▗▟', r1R: '▄', r2L: ' ▜', r2R: '█▘' },
}
const EYES = { open: '▛███▛█', left: '▟███▟█', right: '█▟███▟' }
const FEET = { both: ' ▝▝   ▝▝ ', left: ' ▝▝      ', right: '      ▝▝ ' }

// [glyphs, eyeFrom, eyeTo] per row; the bottom row is feet.
const FACING: Record<string, [string, number, number][]> = {
  'right-12': [[' ▐█▜██▛█ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
  'right-30': [['  █▛██▛▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
  'left-12': [[' ▐▛███▜█ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
  'left-30': [['  ▛██▛█▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
}
// Walking strides for the side views: one foot, then the other.
const STRIDE = ['  ▘▘     ', '      ▘▘ ']

const pad = (spans: Span[]): Span[] => {
  const len = spans.reduce((n, [t]) => n + [...t].length, 0)
  return len < W ? [...spans, [' '.repeat(W - len), false]] : spans
}

export const front = (arms: keyof typeof ARMS, eyes: keyof typeof EYES, feet: keyof typeof FEET): Frame => {
  const a = ARMS[arms]
  return [pad([[a.r1L, false], [EYES[eyes], true], [a.r1R, false]]), [[a.r2L, false], ['█████', true], [a.r2R, false]], [[FEET[feet], false]]]
}

export const facing = (name: string, step: number | null): Frame => {
  const rows = FACING[name] ?? FACING['right-30'] ?? []
  const row = (i: number): Span[] => {
    const [g, from, to] = rows[i] ?? ['', 0, 0]
    const cs = [...g]
    return [[cs.slice(0, from).join(''), false], [cs.slice(from, to).join(''), true], [cs.slice(to).join(''), false]]
  }
  const feet: Span[] = step === null ? row(2) : [[STRIDE[step % 2] ?? '', false]]
  return [row(0), row(1), feet]
}

export const COLORS = ['#D77757', '#E8A33D', '#6CC24A', '#4FA3E0', '#B57EDC', '#E0607E', '#3CC8B4', '#F2D04B']

export const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const TURN_RIGHT_TO_LEFT = ['right-12', 'front', 'up', 'front', 'left-12']
const TURN_LEFT_TO_RIGHT = ['left-12', 'front', 'up', 'front', 'right-12']
const DANCE = ['front', 'up', 'front', 'look-left', 'front', 'up', 'front', 'look-right']

const pose = (name: string, blink: boolean): Frame =>
  name === 'up'
    ? front('up', 'open', 'both')
    : name === 'look-left'
      ? front('down', 'left', 'both')
      : name === 'look-right'
        ? front('down', 'right', 'both')
        : name === 'front'
          ? blink
            ? front('down', 'open', 'both').map((r, i) => (i === 0 ? pad([[' ▐', false], ['▂███▂█', true]]) : r)) as Frame
            : front('down', 'open', 'both')
          : facing(name, null)

// Where Clawd stands in a lane `range` columns wide at beat b, and how it looks.
export const walk = (range: number, b: number): { x: number; frame: Frame } => {
  const blink = b % 23 === 0
  if (range < 2) return { x: Math.max(0, range), frame: pose(DANCE[b % DANCE.length] ?? 'front', blink) }
  const turn = TURN_RIGHT_TO_LEFT.length
  const cycle = 2 * (range + turn)
  const t = b % cycle
  if (t < range) return { x: t, frame: facing('right-30', t) }
  if (t < range + turn) return { x: range, frame: pose(TURN_RIGHT_TO_LEFT[t - range] ?? 'front', blink) }
  const back = t - range - turn
  if (back < range) return { x: range - back, frame: facing('left-30', back) }
  return { x: 0, frame: pose(TURN_LEFT_TO_RIGHT[back - range] ?? 'front', blink) }
}

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

    const cols = Math.max(30, (e.viewport?.columns ?? 80) - 2)
    const longest = Math.max(...e.props.text.split('\n').map(l => l.length), 1)
    const textW = Math.min(longest + 4, cols - W - 2)
    const range = cols - textW - W
    const { x, frame } = walk(range, b + (seed >>> 4))

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center">
        <Box width={textW} flexShrink={0}>
          <Text>
            <Text dimColor>{'> '}</Text>
            {e.props.text}
          </Text>
        </Box>
        <Box flexDirection="column" flexShrink={0} marginLeft={x}>
          {frame.map((row, i) => (
            <Text key={String(i)} color={color}>
              {row.map(([t, isEye], j) =>
                isEye ? (
                  <Text key={String(j)} backgroundColor={EYE_BG}>
                    {t}
                  </Text>
                ) : (
                  t
                ),
              )}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
