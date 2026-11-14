import { expect, mock, test } from 'claude-code/testing'

import { buddy } from '../hooks/register'

test('same prompt keeps its buddy, the beat makes it dance', () => {
  const a0 = buddy('msg-1', 0)
  const a1 = buddy('msg-1', 1)
  expect(buddy('msg-1', 0)).toEqual(a0)
  expect(a1.color).toBe(a0.color)
  expect(a1.text).not.toBe(a0.text)
})

test('prompts get varied buddies', () => {
  const looks = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify([buddy(`m${i}`, 0).color, buddy(`m${i}`, 0).text.trim()])))
  expect(looks.size).toBeGreaterThan(10)
})

test('typed prompt row shows buddy and text', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const ui = await $.ui.mount({
    plugin: 'buddy',
    surface: 'terminal',
    component: 'UserMessage',
    requestId: 'msg-1',
    props: { text: 'fix the login bug', origin: { kind: 'composer' }, isExpanded: true },
  } as never)
  expect(await ui.find({ type: 'Text', text: /fix the login bug/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▛/ })).toBeDefined()
  await ui.unmount()
})
