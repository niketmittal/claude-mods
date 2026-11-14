import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { FoldAll, FoldedById } from '../types'

const byId = atom({ plugin: 'fold', key: 'byId' } as const, {})
const all = atom({ plugin: 'fold', key: 'all' } as const, null)
const summaries = atom({ plugin: 'fold', key: 'summaries' } as const, {})
const auto = atom({ plugin: 'fold', key: 'auto' } as const, true)

// Answers drawn so far this session, so a new prompt can fold the ones before it.
const seen = new Set<string>()

export const LONG = 2 // any answer of two lines or more can fold (one line has nothing to fold)
export const HREF = 'https://fold.toggle/' // the toggle link's address; never opened, the click is ours
const PENDING = '…' // a summary being written
const SUMMARY_SYSTEM =
  'Summarize this reply from an AI coding assistant in ONE line of at most 90 characters: the key result, answer or decision. Plain text, no markdown, no quotes, no lead-in.'

export const isFolded = (ids: FoldedById, everything: FoldAll, id: string) => ids[id] ?? everything ?? false

export const textKey = (text: string) => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

const firstLine = (text: string) => text.split('\n').find(l => l.trim())?.replace(/^[#>*\-\s]+/, '').trim() ?? ''

// Writes the one-line summary of an answer once, and keeps it.
async function summarize($: EngineInterface, text: string) {
  const key = textKey(text)
  const have = (await read($, summaries))[key]
  if (have) return
  await update($, summaries, m => ({ ...m, [key]: PENDING }))
  const answer = await $.model.complete({ model: 'haiku', system: SUMMARY_SYSTEM, prompt: text.slice(0, 8000), maxTokens: 60 })
  const line = answer.isAnswered ? answer.text.split('\n')[0]?.trim().replace(/^["']|["']$/g, '').slice(0, 120) : ''
  await update($, summaries, m => ({ ...m, [key]: line || firstLine(text) }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'fold', description: 'Fold every answer to a one-line summary.' })
    await $.command.register({ name: 'unfold', description: 'Open every folded answer again.' })
    await $.command.register({ name: 'autofold', description: 'Fold earlier answers whenever you send a prompt: on or off.', argumentHint: 'on|off' })
    return next(e)
  })

  // A new prompt folds every answer before it (unless turned off); the new answer opens.
  on('turn.start', async ($, e, next) => {
    if (await read($, auto)) {
      const ids = [...seen]
      await update($, all, () => null)
      await update($, byId, m => ({ ...m, ...Object.fromEntries(ids.filter(id => !(id in m)).map(id => [id, true])) }))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'autofold' }, async ($, e) => {
    const enabled = e.args.trim().toLowerCase() !== 'off'
    await update($, auto, () => enabled)
    return { text: enabled ? 'Earlier answers fold when you send a prompt.' : 'Answers stay open when you send a prompt.' }
  })

  // Each finished answer gets its summary written right away, so folding it is instant.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.answer && e.answer.split('\n').length >= LONG) $.clock.after(0, () => void summarize($, e.answer))
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'fold' }, async $ => {
    await update($, byId, () => ({}))
    await update($, all, () => true)
    // Summarize the recent answers that have none yet, one after another.
    const texts = (await $.session.messages()).filter(m => m.role === 'assistant' && m.text.split('\n').length >= LONG).map(m => m.text).slice(-30)
    $.clock.after(0, async () => {
      for (const t of texts.reverse()) await summarize($, t)
    })
    return { text: 'Answers folded to one-line summaries. Click ▸ on one to open it, or /unfold.' }
  })

  on('command.run', { command: 'unfold' }, async $ => {
    await update($, byId, () => ({}))
    await update($, all, () => false)
    return { text: 'All answers open.' }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    if (e.surface !== 'terminal' || e.props.isSummary || text.split('\n').length < LONG) return next(e)
    const id = e.requestId
    seen.add(id)
    const everything = await read($, all)
    const folded = isFolded(await read($, byId), everything, id)
    const summary = (await read($, summaries))[textKey(text)]
    const toggle = () => {
      void summarize($, text)
      void update($, byId, ids => ({ ...ids, [id]: !isFolded(ids, everything, id) }))
    }
    const { Box, Markdown, Text } = $.ui.resolve(e)
    // The toggle is a link: a plain click on a link in a reply is what the fullscreen
    // terminal hands to a plugin (a ctrl/cmd-click would open it instead).
    const line = summary && summary !== PENDING ? summary : summary === PENDING ? `${firstLine(text)}  (summarizing…)` : firstLine(text)
    const shown = folded ? `${line}  [▸ full answer](${HREF})` : `${text}\n\n[▾ fold](${HREF})`
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
