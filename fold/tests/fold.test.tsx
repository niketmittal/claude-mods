import { expect, mock, test } from 'claude-code/testing'

const long = Array.from({ length: 14 }, (_, i) => `line ${i + 1}`).join('\n')
import type { Engine } from 'claude-code/testing'

const mount = ($: Engine, text: string, requestId = 'a1') =>
  $.ui.mount({ plugin: 'fold', surface: 'terminal', component: 'AssistantMessage', requestId, props: { text, isFirstOfReply: true } } as never)

test('one-line answers are left alone', async ($, on) => {
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
  expect(JSON.stringify(await ui.drawn())).toContain('▾ fold')
  await ui.press({ key: 'fold', link: { href: 'https://fold.toggle/' } })
  expect(JSON.stringify(await ui.drawn())).toContain('11 more lines')
  expect(JSON.stringify(await ui.drawn())).not.toContain('line 4')
  await ui.press({ key: 'fold', link: { href: 'https://fold.toggle/' } })
  expect(JSON.stringify(await ui.drawn())).toContain('line 14')
  await ui.unmount()
})

test('a short answer of a few lines folds too', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await mount($, 'first\nsecond', 's1')
  expect(JSON.stringify(await ui.drawn())).toContain('▾ fold')
  await ui.press({ key: 'fold', link: { href: 'https://fold.toggle/' } })
  expect(JSON.stringify(await ui.drawn())).toContain('1 more line')
  await ui.unmount()
})
