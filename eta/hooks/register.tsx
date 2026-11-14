import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Run } from '../types'

const run = atom({ plugin: 'eta', key: 'run' } as const, null)
const now = atom({ plugin: 'eta', key: 'now' } as const, 0)
const factor = atom({ plugin: 'eta', key: 'factor' } as const, null)
const sides = atom({ plugin: 'eta', key: 'sides' } as const, [])

const TOOL = 'mcp__eta__estimate'
const PING_AFTER_MS = 90_000
const SIDE_PREFIX = /^\s*(?:\/side\s+|side:\s*)([\s\S]+)$/i
const MIN_HISTORY = 3 // past turns needed before Claude's own estimate is trusted

const GUIDANCE = `## Time estimates
The user multitasks while you work and reads a live ETA built from your progress.
- For any request that will take more than about a minute of wall-clock time, first plan it as 3-8 steps of roughly similar size, then call \`${TOOL}\` with \`steps\` (the count) and \`minutes\` (your remaining wall-clock estimate).
- At the start of each later step call it again with \`step\` (1-based) and an updated \`minutes\`. The ETA is timed from when each step starts, so call it exactly when you begin a step.
- If you keep a todo or task list instead, keeping it up to date is enough.
- Skip it for quick answers. Never mention the estimate in your reply.`

// ---------------------------------------------------------------------------
// The estimate. Nothing is shown without evidence:
// - progress: once one plan item is done, the pace of the finished items times
//   the items left (the current item is not counted as over before its average);
// - Claude's own estimate, only once past turns say how far off it runs, scaled
//   by that factor;
// - both: blended, leaning on the measured pace as more of the plan is done.

const median = (xs: number[]) => {
  const ys = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(ys.length / 2)
  const hi = ys[mid] ?? 1
  return ys.length % 2 ? hi : ((ys[mid - 1] ?? hi) + hi) / 2
}

export const toFactor = (ratios: number[]) => (ratios.length < MIN_HISTORY ? null : Math.min(5, Math.max(0.2, median(ratios))))

export const remaining = (r: Run, k: number | null, t: number): number | null => {
  let pace: number | null = null
  if (r.total >= 2 && r.done >= 1 && r.workStartAt !== null && r.lastDoneAt !== null) {
    const perItem = (r.lastDoneAt - r.workStartAt) / r.done
    const left = r.total - r.done
    const sinceLast = t - r.lastDoneAt
    pace = Math.max(perItem * left - sinceLast, perItem * (left - 1) + 10_000)
  }
  const claude = k !== null && r.claudeMs !== null && r.claudeAt !== null ? Math.max(10_000, r.claudeAt + r.claudeMs * k - t) : null
  if (pace !== null && claude !== null) {
    const w = r.done / r.total
    return w * pace + (1 - w) * claude
  }
  return pace ?? claude
}

export const fmt = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return '<1m'
  if (s < 600) {
    const r = Math.round(s / 10) * 10
    return `${Math.floor(r / 60)}m ${String(r % 60).padStart(2, '0')}s`
  }
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

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

async function loadFactor($: EngineInterface) {
  const ratios = ((await $.store.get('ratios')) as number[] | undefined) ?? []
  await update($, factor, () => toFactor(ratios))
}

async function recordRatio($: EngineInterface, ratio: number) {
  const ratios = [...(((await $.store.get('ratios')) as number[] | undefined) ?? []), ratio].slice(-20)
  await $.store.set('ratios', ratios)
}

// Progress moved: the plan has `total` items and `done` of them are finished, as of t.
async function progress($: EngineInterface, total: number, done: number, t: number) {
  await update($, run, r => {
    if (r === null) return r
    const finished = Math.max(0, Math.min(total, done))
    return {
      ...r,
      total,
      done: finished,
      workStartAt: r.workStartAt ?? t,
      lastDoneAt: finished > r.done ? t : r.lastDoneAt,
    }
  })
  await update($, now, () => t)
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
  const id = started.agentId
  await update($, sides, l => [...l, id])
  return `Side task started in the background: ${task.slice(0, 80)}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'estimate',
      description:
        'Report your plan and remaining wall-clock estimate so the user sees an accurate ETA. Call once after planning (steps + minutes), then at the start of each step (step + minutes).',
      inputSchema: {
        type: 'object',
        properties: {
          minutes: { type: 'number', description: 'Estimated remaining wall-clock minutes.' },
          steps: { type: 'number', description: 'Total number of steps in your plan.' },
          step: { type: 'number', description: 'The step you are starting now (1-based).' },
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
    await loadFactor($)
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
    await loadFactor($)
    const fresh: Run = {
      turnId: e.turnId,
      startedAt: t,
      claudeMs: null,
      claudeAt: null,
      firstClaudeMs: null,
      firstClaudeAt: null,
      total: 0,
      done: 0,
      workStartAt: null,
      lastDoneAt: null,
    }
    await update($, run, () => fresh)
    await update($, now, () => t)
    startTick($)
    return next(e)
  })

  // Claude's plan and estimate: steps give progress, minutes give its own guess.
  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId !== undefined) return { result: 'ok' }
    const args = e as unknown as Record<string, unknown>
    const minutes = num(args.minutes)
    if (minutes === null) return { result: 'minutes must be a positive number' }
    const t = await $.clock.now()
    await update($, run, r =>
      r === null
        ? r
        : {
            ...r,
            claudeMs: minutes * 60_000,
            claudeAt: t,
            firstClaudeMs: r.firstClaudeMs ?? minutes * 60_000,
            firstClaudeAt: r.firstClaudeAt ?? t,
          },
    )
    const r = await read($, run)
    const steps = num(args.steps) ?? (r && r.total > 0 ? r.total : null)
    const step = num(args.step) ?? 1
    if (steps !== null) await progress($, Math.round(steps), Math.round(step) - 1, t)
    return { result: 'ok' }
  }).catch(() => ({ result: 'ok' }))

  // A todo list is progress too: its length and how many are completed.
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && Array.isArray(e.todos) && e.todos.length >= 2)
      await progress($, e.todos.length, e.todos.filter(x => x.status === 'completed').length, await $.clock.now())
    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const result = await next(e)
    const r = await read($, run)
    if (e.agentId === undefined && r) await progress($, r.total + 1, r.done, await $.clock.now())
    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const result = await next(e)
    const r = await read($, run)
    if (e.agentId === undefined && r && e.status === 'completed') await progress($, r.total, r.done + 1, await $.clock.now())
    if (e.agentId === undefined && r && e.status === 'deleted') await progress($, Math.max(r.done, r.total - 1), r.done, await $.clock.now())
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const list = await read($, sides)
      if (list.includes(e.agentId)) {
        await update($, sides, l => l.filter(id => id !== e.agentId))
        await $.session.append({
          message: { type: 'system', content: [{ type: 'text', text: `side task done:\n\n${e.answer || '(no answer)'}` }] },
        })
        const sent = await $.ui.notify('Side task done', { title: 'Claude' })
        if (!sent.isSent) $.ui.toast('Side task done')
      }
      return next(e)
    }

    const r = await read($, run)
    await update($, run, () => null)
    stopTick()
    if (r && !e.isAborted && r.firstClaudeMs && r.firstClaudeAt) {
      await recordRatio($, ((await $.clock.now()) - r.firstClaudeAt) / r.firstClaudeMs)
    }
    if (!e.isAborted && e.durationMs >= PING_AFTER_MS) {
      const sent = await $.ui.notify('Done', { title: 'Claude' })
      if (!sent.isSent) $.ui.toast('Done')
    }
    return next(e)
  })

  // Just the time.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !e.props.isWorking) return next(e)
    const r = await read($, run)
    if (!r) return next(e)
    const left = remaining(r, await read($, factor), await read($, now))
    if (left === null) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text bold>⏱ {fmt(left)} left</Text>
  })
}
