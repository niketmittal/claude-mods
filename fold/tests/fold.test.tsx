import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const USAGE = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
const long = Array.from({ length: 14 }, (_, i) => `line ${i + 1}`).join('\n')
const LINK = { key: 'fold', link: { href: 'https://fold.toggle/' } }

const bottom = (on: On) => {
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Added a fold toggle to every answer.', usage: USAGE } }) as never)
}
const mount = ($: Engine, text: string, requestId = 'a1') =>
  $.ui.mount({ plugin: 'fold', surface: 'terminal', component: 'AssistantMessage', requestId, props: { text, isFirstOfReply: true } } as never)

test('one-line answers are left alone', async ($, on) => {
  mock.clock(on, { now: 0 })
  bottom(on)
  const ui = await mount($, 'just one line')
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('folding shows a one-line summary of the whole answer; unfolding brings it all back', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  bottom(on)
  const ui = await mount($, long)
  expect(JSON.stringify(await ui.drawn())).toContain('▾ fold')
  await ui.press(LINK)
  await clock.advance(10)
  const folded = JSON.stringify(await ui.drawn())
  expect(folded).toContain('Added a fold toggle to every answer.')
  expect(folded).toContain('▸ full answer')
  expect(folded).not.toContain('line 2')
  await ui.press(LINK)
  expect(JSON.stringify(await ui.drawn())).toContain('line 14')
  await ui.unmount()
})
