import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { FoldAll, FoldedById } from '../types'

const byId = atom({ plugin: 'fold', key: 'byId' } as const, {})
const all = atom({ plugin: 'fold', key: 'all' } as const, null)

export const LONG = 10 // an answer this many lines or longer gets a toggle
export const KEEP = 3 // lines a folded answer still shows

export const isFolded = (ids: FoldedById, everything: FoldAll, id: string) => ids[id] ?? everything ?? false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'fold', description: 'Fold every long answer to its first lines.' })
    await $.command.register({ name: 'unfold', description: 'Open every folded answer again.' })
    return next(e)
  })

  on('command.run', { command: 'fold' }, async $ => {
    await update($, byId, () => ({}))
    await update($, all, () => true)
    return { text: 'Long answers folded. /unfold to open them, or click one to open just it.' }
  })

  on('command.run', { command: 'unfold' }, async $ => {
    await update($, byId, () => ({}))
    await update($, all, () => false)
    return { text: 'All answers open.' }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const lines = e.props.text.split('\n')
    if (e.surface !== 'terminal' || e.props.isSummary || lines.length < LONG) return next(e)
    const id = e.requestId
    const everything = await read($, all)
    const folded = isFolded(await read($, byId), everything, id)
    const toggle = () => update($, byId, ids => ({ ...ids, [id]: !isFolded(ids, everything, id) }))
    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const bullet = e.props.isFirstOfReply ? '⏺' : ' '
    if (folded)
      // Folded: the whole preview is one button; a click anywhere on it opens the answer.
      return (
        <Box flexDirection="row">
          <Box width={2} flexShrink={0}>
            <Text>{bullet}</Text>
          </Box>
          <Button key="fold" plain onPress={toggle}>
            {lines.slice(0, KEEP).join('\n')}
            {'\n'}
            <Text dimColor>▸ {lines.length - KEEP} more lines</Text>
          </Button>
        </Box>
      )
    // Open: the bullet and the line at the end fold it (the formatted body itself cannot take a click).
    return (
      <Box flexDirection="row">
        <Box width={2} flexShrink={0}>
          {e.props.isFirstOfReply ? <Button key="bullet" plain label="⏺" onPress={toggle} /> : <Text> </Text>}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Markdown text={e.props.text} />
          <Button key="fold" plain label="▾ fold" onPress={toggle} />
        </Box>
      </Box>
    )
  })
}
