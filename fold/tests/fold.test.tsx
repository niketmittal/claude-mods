import { expect, mock, test } from 'claude-code/testing'

const long = Array.from({ length: 14 }, (_, i) => `line ${i + 1}`).join('\n')
import type { Engine } from 'claude-code/testing'

const mount = ($: Engine, text: string, requestId = 'a1') =>
  $.ui.mount({ plugin: 'fold', surface: 'terminal', component: 'AssistantMessage', requestId, props: { text, isFirstOfReply: true } } as never)

test('short answers are left alone', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await mount($, 'just one line')
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a long answer folds and unfolds with its toggle', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await mount($, long)
  expect(await ui.find({ type: 'Button', text: /fold/ })).toBeDefined()
  await ui.press({ key: 'fold' })
  expect(await ui.find({ type: 'Button', text: /11 more lines/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /line 1/ })).toBeDefined() // the preview itself is the click target
  expect(JSON.stringify(await ui.drawn())).not.toContain('line 4')
  await ui.press({ key: 'fold' })
  expect(JSON.stringify(await ui.drawn())).toContain('line 14')
  await ui.unmount()
})

test('clicking the bullet folds an open answer', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await mount($, long, 'b2')
  await ui.press({ key: 'bullet' })
  expect(await ui.find({ type: 'Button', text: /more lines/ })).toBeDefined()
  await ui.unmount()
})
