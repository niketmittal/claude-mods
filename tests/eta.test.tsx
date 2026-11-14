import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

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
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }) as const)
}

test('band counts down from the estimate with step and advice', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engineBottom(on)

  await $.turn.start({ text: 'refactor auth', turnId: 't1' })
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 10, steps: 3, step: 1, label: 'reading code' } as never)
  await clock.advance(60_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'eta', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /~9m00s left/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /step 1\/3/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /something else/ })).toBeDefined()
    await ui.unmount()
  }

  await $.turn.complete({ answer: 'done', durationMs: 15 * 60_000, isAborted: false, turnId: 't1', reason: 'answer' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'eta', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /left/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /engine band/ })).toBeDefined()
    await ui.unmount()
  }
})

test('past overruns stretch the estimate', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, { ratios: [2, 2, 2] })
  engineBottom(on)

  await $.turn.start({ text: 'migrate db', turnId: 't2' })
  await $.tool.call({ tool: 'mcp__eta__estimate', minutes: 10 } as never)
  await clock.advance(60_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'eta', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /~19m00s left/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /×2\.0 calibrated/ })).toBeDefined()
    await ui.unmount()
  }
})
