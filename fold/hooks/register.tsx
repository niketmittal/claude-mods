import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { FoldAll, FoldedById } from '../types'

const byId = atom({ plugin: 'fold', key: 'byId' } as const, {})
const all = atom({ plugin: 'fold', key: 'all' } as const, null)

export const LONG = 2 // any answer of two lines or more gets a toggle (one line has nothing to fold)
export const KEEP = 3 // lines a folded answer still shows
export const HREF = 'https://fold.toggle/' // the toggle link's address; never opened, the click is ours

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
    const { Box, Markdown, Text } = $.ui.resolve(e)
    // The toggle is a link at the end of the answer: a click on a link in a reply is what
    // the fullscreen terminal hands to a plugin (a ctrl/cmd-click would open it instead).
    const keep = Math.min(KEEP, lines.length - 1)
    const more = lines.length - keep
    const toggleLink = folded ? `[▸ ${more} more line${more === 1 ? '' : 's'}](${HREF})` : `[▾ fold](${HREF})`
    const shown = (folded ? lines.slice(0, keep).join('\n') : e.props.text) + '\n\n' + toggleLink
    return (
      <Box flexDirection="row">
        <Box width={2} flexShrink={0}>
          <Text>{e.props.isFirstOfReply ? '⏺' : ' '}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Markdown key="fold" text={shown} pressableLinks={[HREF]} onLinkPress={toggle} />
        </Box>
      </Box>
    )
  })
}
