import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop'] as const
const USAGE = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

const engineBottom = (on: On, quickReply: string | null) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }) as const)
  on('session.messages', () => ({ value: [] }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', ($, e) => ({ model: 'haiku', agentId: e.description === 'find auth code' ? 'a1' : 'a2' }))
  on('model.complete', () => ({
    value: quickReply === null ? { isAnswered: false, reason: 'empty-reply', usage: USAGE } : { isAnswered: true, text: quickReply, usage: USAGE },
  }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
}

const expectBand = async ($: Engine, checks: (RegExp | null)[], absent: RegExp[] = []) => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'eta', surface, ...BAND })
    for (const re of checks) if (re) expect(await ui.find({ type: 'Text', text: re })).toBeDefined()
    for (const re of absent) expect(await ui.find({ type: 'Text', text: re })).toBeUndefined()
    await ui.unmount()
  }
}

test('no estimate means no elapsed-time line', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engineBottom(on, null)

  await $.turn.start({ text: 'refactor auth', turnId: 't0' })
  await clock.advance(30_000)
  await expectBand($, [/engine band/], [/elapsed/, /left/, /idle/])
})

test('quick guess appears right at turn start, Claude estimate replaces it', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engineBottom(on, '4')

  await $.turn.start({ text: 'add rate limiting to the api', turnId: 't1' })
  await clock.advance(0)
  await expectBand($, [/~4m00s left/, /quick guess/])

  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 10, steps: 3, step: 1, label: 'reading code' } as never)
  await clock.advance(60_000)
  await expectBand($, [/~9m00s left/, /step 1\/3/, /something else/], [/quick guess/])

  await $.turn.complete({ answer: 'done', durationMs: 15 * 60_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await expectBand($, [/engine band/], [/left/])
})

test('past overruns stretch Claude estimates', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, { ratios: [2, 2, 2] })
  engineBottom(on, null)

  await $.turn.start({ text: 'migrate db', turnId: 't2' })
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 10 } as never)
  await clock.advance(60_000)
  await expectBand($, [/~19m00s left/, /×2\.0 calibrated/])
})

test('each subagent gets its own ETA line', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engineBottom(on, '2')

  await $.turn.start({ text: 'split the work', turnId: 't3' })
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 10 } as never)
  await $.agent.spawn({ prompt: 'grep for auth', description: 'find auth code', subagentType: 'Explore' } as never)
  await $.agent.spawn({ prompt: 'write tests', description: 'add tests', subagentType: 'general-purpose' } as never)
  await clock.advance(0)
  await expectBand($, [/main ~10m00s left/, /2 subagents running/, /Explore: find auth code · ~2m00s left \(quick guess\)/, /general-purpose: add tests/])

  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 5, step: 1, steps: 2, agentId: 'a2' } as never)
  await clock.advance(60_000)
  await expectBand($, [/add tests · ~4m00s left · step 1\/2/, /everything done in ~9m00s/])

  await $.turn.complete({ answer: 'found', durationMs: 60_000, isAborted: false, turnId: 'x', reason: 'answer', agentId: 'a1' } as never)
  await expectBand($, [/1 subagent running/], [/find auth code/])
})
