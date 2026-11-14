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

const engineBottom = (on: On) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }) as const)
  on('session.messages', () => ({ value: [] }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('tool.call', { tool: 'TodoWrite' }, () => ({ result: 'ok' }) as never)
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

test('a raw guess with no history shows nothing', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engineBottom(on)
  await $.turn.start({ text: 'refactor auth', turnId: 't0' })
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 10 } as never)
  await clock.advance(30_000)
  await expectBand($, [/engine band/], [/left/])
})

test('Claude estimate is used once history says how far off it runs', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, { ratios: [2, 2, 2] })
  engineBottom(on)
  await $.turn.start({ text: 'migrate db', turnId: 't1' })
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 10 } as never)
  await clock.advance(60_000)
  await expectBand($, [/^⏱ 19m left$/])
})

test('pace of finished steps drives the ETA, with no extra text', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engineBottom(on)
  await $.turn.start({ text: 'add rate limiting', turnId: 't2' })
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 3, steps: 4 } as never)
  await clock.advance(90_000)
  await expectBand($, [/engine band/], [/left/])
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 3, step: 2 } as never)
  await expectBand($, [/^⏱ 4m 30s left$/])
  await clock.advance(60_000)
  await expectBand($, [/^⏱ 3m 30s left$/])
  await clock.advance(60_000)
  await expectBand($, [/^⏱ 3m 10s left$/])

  await $.turn.complete({ answer: 'done', durationMs: 4 * 60_000, isAborted: false, turnId: 't2', reason: 'answer' })
  await expectBand($, [/engine band/], [/left/])
})

test('a todo list is progress too', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engineBottom(on)
  await $.turn.start({ text: 'build it', turnId: 't3' })
  const todos = (done: number) => Array.from({ length: 5 }, (_, i) => ({ content: `step ${i}`, activeForm: `step ${i}`, status: i < done ? 'completed' : 'pending' }))
  await $.tool.call({ tool: 'TodoWrite', todos: todos(0) } as never)
  await clock.advance(120_000)
  await $.tool.call({ tool: 'TodoWrite', todos: todos(2) } as never)
  await expectBand($, [/^⏱ 3m 00s left$/])
})
