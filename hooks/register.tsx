import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Run, Side } from '../types'

const run = atom({ plugin: 'eta', key: 'run' } as const, null)
const now = atom({ plugin: 'eta', key: 'now' } as const, 0)
const factor = atom({ plugin: 'eta', key: 'factor' } as const, 1)
const sides = atom({ plugin: 'eta', key: 'sides' } as const, [])
const isHidden = atom({ plugin: 'eta', key: 'isHidden' } as const, false)

const TOOL = 'mcp__eta__estimate'
const PING_AFTER_MS = 90_000
const QUIET_FOR_MS = 15_000
const SIDE_PREFIX = /^\s*(?:\/side\s+|side:\s*)([\s\S]+)$/i

const GUIDANCE = `## Time estimates
The user multitasks while you work and reads a live ETA from the \`${TOOL}\` tool.
- Before starting any request you expect to take more than about a minute of wall-clock time (multiple tool calls, builds, tests, research), call \`${TOOL}\` first with your honest estimate of the remaining wall-clock minutes and the number of steps.
- Call it again when you move to a new step (pass \`step\`) or when your estimate changes by more than ~50%.
- Skip it for quick answers. Never mention the estimate in your reply; the user already sees it.`

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h${m % 60}m`
}

const median = (xs: number[]) => {
  const ys = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(ys.length / 2)
  const hi = ys[mid] ?? 1
  return ys.length % 2 ? hi : ((ys[mid - 1] ?? hi) + hi) / 2
}

const toFactor = (ratios: number[]) =>
  ratios.length < 3 ? 1 : Math.min(4, Math.max(0.5, median(ratios)))

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

export const verdict = (remainingMs: number | null) => {
  if (remainingMs === null) return 'no estimate yet'
  if (remainingMs < 0) return 'running over the estimate'
  if (remainingMs <= 60_000) return 'almost done: wait'
  if (remainingMs <= 5 * 60_000) return 'good moment for a side: task or a short break'
  return "go do something else; you'll get a ping"
}

let tick: { cancel: () => void } | null = null

function stopTick() {
  tick?.cancel()
  tick = null
}

function startTick($: EngineInterface) {
  if (tick) return
  tick = $.clock.every(5000, async () => {
    const t = await $.clock.now()
    await update($, now, () => t)
  })
}

async function spawnSide($: EngineInterface, task: string) {
  const started = await $.agent.spawn({
    prompt: task,
    description: `side: ${task.slice(0, 40)}`,
    subagentType: 'general-purpose',
  })
  if (started.deny !== undefined || !started.agentId) {
    return `Side task not started: ${started.deny ?? 'no agent id'}`
  }
  const side: Side = { id: started.agentId, task, startedAt: await $.clock.now() }
  await update($, sides, list => [...list, side])
  startTick($)
  return `Side task started in the background: ${task.slice(0, 80)}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'estimate',
      description:
        'Report your wall-clock time estimate for the current request so the user can plan around it. Call before multi-step work and on each new step.',
      inputSchema: {
        type: 'object',
        properties: {
          minutes: { type: 'number', description: 'Estimated remaining wall-clock minutes.' },
          steps: { type: 'number', description: 'Total number of steps planned.' },
          step: { type: 'number', description: 'The step you are starting now (1-based).' },
          label: { type: 'string', description: 'A few words on what this step does.' },
        },
        required: ['minutes'],
      },
      isDeferred: false,
    })
    await $.command.register({
      name: 'side',
      description: 'Run a task in a background subagent without touching the main thread.',
      argumentHint: '<task>',
    })
    const ratios = ((await $.store.get('ratios')) as number[] | undefined) ?? []
    await update($, factor, () => toFactor(ratios))
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return {
      ...composed,
      sections: [...composed.sections, { id: 'eta:guidance', text: GUIDANCE, scope: 'session' as const }],
    }
  })

  on('prompt.submit', async ($, e, next) => {
    const side = SIDE_PREFIX.exec(e.text)
    if (!side) return next(e)
    return { drop: await spawnSide($, (side[1] ?? '').trim()) }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'side' }, async ($, e) => {
    const task = e.args.trim()
    if (!task) return { text: 'Usage: /side <task>  (or type "side: <task>" while Claude is busy)' }
    return { text: await spawnSide($, task) }
  })

  on('turn.start', async ($, e, next) => {
    const t = await $.clock.now()
    const fresh: Run = {
      startedAt: t,
      estimateMs: null,
      estimatedAt: null,
      step: null,
      steps: null,
      label: null,
      firstEstimateMs: null,
      firstEstimatedAt: null,
    }
    const ratios = ((await $.store.get('ratios')) as number[] | undefined) ?? []
    await update($, factor, () => toFactor(ratios))
    await update($, run, () => fresh)
    await update($, now, () => t)
    startTick($)
    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId !== undefined) return { result: 'ok' }
    const args = e as unknown as Record<string, unknown>
    const minutes = num(args.minutes)
    if (minutes === null) return { result: 'minutes must be a positive number' }
    const t = await $.clock.now()
    await update($, run, r => {
      if (r === null) return r
      return {
        ...r,
        estimateMs: minutes * 60_000,
        estimatedAt: t,
        steps: num(args.steps) ?? r.steps,
        step: num(args.step) ?? r.step,
        label: typeof args.label === 'string' ? args.label.slice(0, 60) : r.label,
        firstEstimateMs: r.firstEstimateMs ?? minutes * 60_000,
        firstEstimatedAt: r.firstEstimatedAt ?? t,
      }
    })
    await update($, now, () => t)
    return { result: 'ok' }
  }).catch(() => ({ result: 'ok' }))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const list = await read($, sides)
      const side = list.find(s => s.id === e.agentId)
      if (side) {
        await update($, sides, l => l.filter(s => s.id !== side.id))
        const took = fmt((await $.clock.now()) - side.startedAt)
        await $.session.append({
          message: {
            type: 'system',
            content: [{ type: 'text', text: `side task done (${took}): ${side.task}\n\n${e.answer || '(no answer)'}` }],
          },
        })
        const sent = await $.ui.notify(`Side task done: ${side.task.slice(0, 60)}`, { title: 'Claude' })
        if (!sent.isSent) $.ui.toast(`Side task done: ${side.task.slice(0, 60)}`)
      }
      if ((await read($, run)) === null && (await read($, sides)).length === 0) stopTick()
      return next(e)
    }

    const r = await read($, run)
    await update($, run, () => null)
    if ((await read($, sides)).length === 0) stopTick()

    if (r && !e.isAborted && r.firstEstimateMs && r.firstEstimatedAt) {
      const actual = (await $.clock.now()) - r.firstEstimatedAt
      const ratios = [...(((await $.store.get('ratios')) as number[] | undefined) ?? []), actual / r.firstEstimateMs].slice(-20)
      await $.store.set('ratios', ratios)
      await update($, factor, () => toFactor(ratios))
    }

    if (!e.isAborted && e.durationMs >= PING_AFTER_MS) {
      const sent = await $.ui.notify(`Done after ${fmt(e.durationMs)}`, { title: 'Claude' })
      if (!sent.isSent) $.ui.toast(`Done after ${fmt(e.durationMs)}`)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const r = await read($, run)
    const list = await read($, sides)
    const t = await read($, now)
    const k = await read($, factor)

    const elapsed = r ? t - r.startedAt : 0
    const showRun = r !== null && e.props.isWorking && (r.estimateMs !== null || elapsed >= QUIET_FOR_MS)
    if (!showRun && list.length === 0) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)

    let line = null
    if (showRun && r) {
      const remaining =
        r.estimateMs !== null && r.estimatedAt !== null ? r.estimatedAt + r.estimateMs * k - t : null
      const head =
        remaining === null ? `⏱ ${fmt(elapsed)} elapsed` : remaining >= 0 ? `⏱ ~${fmt(remaining)} left` : `⏱ +${fmt(-remaining)} over`
      const step = r.step && r.steps ? ` · step ${r.step}/${r.steps}` : ''
      const label = r.label ? ` · ${r.label}` : ''
      const cal = remaining !== null && Math.abs(k - 1) >= 0.15 ? ` (×${k.toFixed(1)} calibrated)` : ''
      line = (
        <Text>
          <Text bold>{head}</Text>
          <Text dimColor>
            {cal}
            {step}
            {label} · {verdict(remaining)}
          </Text>
        </Text>
      )
    }

    return (
      <Box flexDirection="column">
        <Box>
          {line ?? <Text dimColor>⏱ idle</Text>}
          <Text> </Text>
          <Button key="hide" plain label="×" onPress={() => update($, isHidden, () => true)} />
        </Box>
        {list.length > 0 ? (
          <Text dimColor>
            ↳ {list.length} side task{list.length > 1 ? 's' : ''} running:{' '}
            {list.map(s => `${s.task.slice(0, 30)} (${fmt(t - s.startedAt)})`).join(', ')}
          </Text>
        ) : null}
      </Box>
    )
  })
}
