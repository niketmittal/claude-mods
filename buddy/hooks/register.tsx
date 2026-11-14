import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const beat = atom({ plugin: 'buddy', key: 'beat' } as const, 0)

const BEAT_MS = 450

// Each shape is its dance: the frames it cycles through.
export const SHAPES = [
  ['▐▛█▜▌', '▝▛█▜▘'],
  ['▗▛█▜▖', '▝▛█▜▘'],
  ['╲▛█▜╱', '╱▛█▜╲'],
  ['▐▛██▜▌', '▐▙██▟▌'],
  ['▄▛▀▜▄', '▀▙▄▟▀'],
  ['◢▛█▜◣', '◥▛█▜◤'],
  ['▐▛▘▜▌', '▐▛▝▜▌'],
]

export const COLORS = ['#D97757', '#E8A33D', '#6CC24A', '#4FA3E0', '#B57EDC', '#E0607E', '#3CC8B4', '#F2D04B']

export const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// Same message, same buddy; a new prompt gets a new one. Beat sways it a column left and right.
export const buddy = (id: string, b: number) => {
  const seed = hash(id)
  const frames = SHAPES[seed % SHAPES.length] ?? SHAPES[0] ?? ['▐▛█▜▌']
  const frame = frames[(b + seed) % frames.length] ?? ''
  const sway = (b + (seed >> 5)) % 2 === 0
  return { text: sway ? ` ${frame}` : `${frame} `, color: COLORS[(seed >> 8) % COLORS.length] ?? '#D97757' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // ponytail: one shared beat redraws every prompt row on screen each tick; fine for a transcript, gate on onScreen if it ever lags.
    $.clock.every(BEAT_MS, () => update($, beat, b => (b + 1) % 1_000_000))
    return next(e)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.origin.kind !== 'composer') return next(e)
    const { text, color } = buddy(e.requestId, await read($, beat))
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        <Text color={color} bold>
          {text}
        </Text>
        <Text> {e.props.text}</Text>
      </Box>
    )
  })
}
