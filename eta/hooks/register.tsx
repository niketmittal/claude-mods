import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, Eta, Factors, Run } from '../types'

const run = atom({ plugin: 'eta', key: 'run' } as const, null)
const now = atom({ plugin: 'eta', key: 'now' } as const, 0)
const factors = atom({ plugin: 'eta', key: 'factors' } as const, { quick: 1, claude: 1 })
const agents = atom({ plugin: 'eta', key: 'agents' } as const, [])
const isHidden = atom({ plugin: 'eta', key: 'isHidden' } as const, false)

const TOOL = 'mcp__eta__estimate'
const QUICK_MODEL = 'haiku'
const PING_AFTER_MS = 90_000
const SIDE_PREFIX = /^\s*(?:\/side\s+|side:\s*)([\s\S]+)$/i
const MAX_AGENT_ROWS = 6
const ENDED = new Set(['completed', 'failed', 'killed'])
const AGENT_HINT = `\n\n(Time tracking: if this task will take more than about a minute, call \`${TOOL}\` first with your wall-clock estimate in minutes, and again on each new step. Never mention it.)`
const NO_ETA: Eta = { source: null, estimateMs: null, estimatedAt: null, step: null, steps: null, label: null }

const GUIDANCE = `## Time estimates
The user multitasks while you work and reads a live ETA from the \`${TOOL}\` tool.
- For any request that will take more than about a minute of wall-clock time (multiple tool calls, builds, tests, research), make \`${TOOL}\` your very first tool call, before reading anything: a fast gut estimate of the wall-clock minutes and the number of steps is better than a late precise one.
- Call it again when you move to a new step (pass \`step\`) or when your estimate changes by more than ~50%.
- Skip it for quick answers. Never mention the estimate in your reply; the user already sees it.`

const QUICK_SYSTEM = `You estimate how long an AI coding agent (Claude Code) will take, in wall-clock minutes, to finish the user's latest request. The agent reads files, runs commands, edits code and runs tests. Typical: a direct answer 0.2; a one-file fix 1-3; a feature across files 5-15; a deep investigation or large refactor 15-40. Reply with one number of minutes and nothing else.`

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
  ratios.length < 3 ? 1 : Math.min(4, Math.max(0.25, median(ratios)))

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

export const parseMinutes = (text: string) => {
  const m = /\d+(?:\.\d+)?/.exec(text)
  const v = m ? Number(m[0]) : NaN
  return Number.isFinite(v) && v > 0 && v < 600 ? v : null
}

export const verdict = (remainingMs: number) => {
  if (remainingMs < 0) return 'running over the estimate'
  if (remainingMs <= 60_000) return 'almost done: wait'
  if (remainingMs <= 5 * 60_000) return 'good moment for a side: task or a short break'
  return "go do something else; you'll get a ping"
}

const claudeEta = (x: Eta, minutes: number, t: number, args: Record<string, unknown>): Eta => ({
  source: 'claude',
  estimateMs: minutes * 60_000,
  estimatedAt: t,
  steps: num(args.steps) ?? x.steps,
  step: num(args.step) ?? x.step,
  label: typeof args.label === 'string' ? args.label.slice(0, 60) : x.label,
})

export const remainingOf = (x: Eta, f: Factors, t: number) =>
  x.source === null || x.estimateMs === null || x.estimatedAt === null ? null : x.estimatedAt + x.estimateMs * f[x.source] - t

const left = (ms: number) => (ms >= 0 ? `~${fmt(ms)} left` : `+${fmt(-ms)} over`)

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
    if ((await read($, agents)).length === 0) return
    // Agents that ended without a turn.complete (killed, failed) drop out here.
    const ended = new Set((await $.agent.list()).filter(a => ENDED.has(a.status)).map(a => a.id))
    if (ended.size) await update($, agents, l => l.filter(a => !ended.has(a.id)))
  })
}

async function loadFactors($: EngineInterface) {
  const quick = ((await $.store.get('quickRatios')) as number[] | undefined) ?? []
  const claude = ((await $.store.get('ratios')) as number[] | undefined) ?? []
  const next: Factors = { quick: toFactor(quick), claude: toFactor(claude) }
  await update($, factors, () => next)
}

async function recordRatio($: EngineInterface, key: 'quickRatios' | 'ratios', ratio: number) {
  const ratios = [...(((await $.store.get(key)) as number[] | undefined) ?? []), ratio].slice(-20)
  await $.store.set(key, ratios)
}

async function quickGuess($: EngineInterface, prompt: string) {
  const answer = await $.model.complete({ model: QUICK_MODEL, system: QUICK_SYSTEM, prompt, maxTokens: 8 })
  return answer.isAnswered ? parseMinutes(answer.text) : null
}

async function quickEstimate($: EngineInterface, turnId: string, request: string) {
  const recent = (await $.session.messages()).slice(-6, -1)
  const context = recent
    .map(m => `${m.role}: ${m.text.slice(0, 300)}${m.toolUses.length ? ` [tools: ${m.toolUses.map(u => u.tool).join(', ')}]` : ''}`)
    .join('\n')
  const minutes = await quickGuess(
    $,
    `${context ? `Recent conversation:\n${context}\n\n` : ''}Latest request:\n${request.slice(0, 2000)}\n\nMinutes:`,
  )
  if (minutes === null) return
  await update($, run, r =>
    r === null || r.turnId !== turnId || r.source === 'claude'
      ? r
      : { ...r, source: 'quick' as const, estimateMs: minutes * 60_000, estimatedAt: r.startedAt, quickMs: minutes * 60_000 },
  )
}

async function quickEstimateAgent($: EngineInterface, id: string, task: string) {
  const minutes = await quickGuess($, `A subagent was given this task:\n${task.slice(0, 2000)}\n\nMinutes:`)
  if (minutes === null) return
  await update($, agents, l =>
    l.map(a =>
      a.id !== id || a.source === 'claude' ? a : { ...a, source: 'quick' as const, estimateMs: minutes * 60_000, estimatedAt: a.startedAt },
    ),
  )
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
  const t = await $.clock.now()
  // The agent.spawn hook usually tracked it already; mark it as a side task.
  await update($, agents, l =>
    l.some(a => a.id === id)
      ? l.map(a => (a.id === id ? { ...a, isSide: true, task } : a))
      : [...l, { ...NO_ETA, id, task, kind: 'side', isSide: true, startedAt: t }],
  )
  startTick($)
  return `Side task started in the background: ${task.slice(0, 80)}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'estimate',
      description:
        'Report your wall-clock time estimate for the current request so the user can plan around it. Call first, before multi-step work, and on each new step.',
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
    await loadFactors($)
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

  on('agent.spawn', async ($, e, next) => {
    const started = await next({ ...e, prompt: e.prompt + AGENT_HINT })
    if (started.deny !== undefined || !started.agentId || started.teammateId) return started
    const id = started.agentId
    const task = e.description || e.prompt.slice(0, 60)
    const t = await $.clock.now()
    await update($, agents, l =>
      l.some(a => a.id === id) ? l : [...l, { ...NO_ETA, id, task, kind: e.subagentType, isSide: false, startedAt: t }],
    )
    startTick($)
    $.clock.after(0, () => void quickEstimateAgent($, id, `${e.description}\n${e.prompt}`))
    return started
  })

  on('command.run', { command: 'side' }, async ($, e) => {
    const task = e.args.trim()
    if (!task) return { text: 'Usage: /side <task>  (or type "side: <task>" while Claude is busy)' }
    return { text: await spawnSide($, task) }
  })

  on('turn.start', async ($, e, next) => {
    const t = await $.clock.now()
    await loadFactors($)
    const fresh: Run = {
      turnId: e.turnId,
      startedAt: t,
      ...NO_ETA,
      quickMs: null,
      firstClaudeMs: null,
      firstClaudeAt: null,
    }
    await update($, run, () => fresh)
    await update($, now, () => t)
    await update($, isHidden, () => false)
    startTick($)
    const request = e.text.trim()
    if (request) $.clock.after(0, () => void quickEstimate($, e.turnId, request))
    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const args = e as unknown as Record<string, unknown>
    const minutes = num(args.minutes)
    if (minutes === null) return { result: 'minutes must be a positive number' }
    const t = await $.clock.now()
    const agentId = e.agentId
    if (agentId !== undefined) {
      await update($, agents, l => l.map(a => (a.id === agentId ? { ...a, ...claudeEta(a, minutes, t, args) } : a)))
    } else {
      await update($, run, r =>
        r === null
          ? r
          : {
              ...r,
              ...claudeEta(r, minutes, t, args),
              firstClaudeMs: r.firstClaudeMs ?? minutes * 60_000,
              firstClaudeAt: r.firstClaudeAt ?? t,
            },
      )
    }
    await update($, now, () => t)
    return { result: 'ok' }
  }).catch(() => ({ result: 'ok' }))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const agent = (await read($, agents)).find(a => a.id === e.agentId)
      if (agent) {
        await update($, agents, l => l.filter(a => a.id !== agent.id))
        if (agent.isSide) {
          const took = fmt((await $.clock.now()) - agent.startedAt)
          await $.session.append({
            message: {
              type: 'system',
              content: [{ type: 'text', text: `side task done (${took}): ${agent.task}\n\n${e.answer || '(no answer)'}` }],
            },
          })
          const sent = await $.ui.notify(`Side task done: ${agent.task.slice(0, 60)}`, { title: 'Claude' })
          if (!sent.isSent) $.ui.toast(`Side task done: ${agent.task.slice(0, 60)}`)
        }
      }
      if ((await read($, run)) === null && (await read($, agents)).length === 0) stopTick()
      return next(e)
    }

    const r = await read($, run)
    await update($, run, () => null)
    if ((await read($, agents)).length === 0) stopTick()

    if (r && !e.isAborted) {
      const t = await $.clock.now()
      if (r.quickMs) await recordRatio($, 'quickRatios', (t - r.startedAt) / r.quickMs)
      if (r.firstClaudeMs && r.firstClaudeAt) await recordRatio($, 'ratios', (t - r.firstClaudeAt) / r.firstClaudeMs)
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
    const list = await read($, agents)
    const t = await read($, now)
    const f = await read($, factors)

    const mainLeft = r && e.props.isWorking ? remainingOf(r, f, t) : null
    if (mainLeft === null && list.length === 0) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const hide = <Button key="hide" plain label="×" onPress={() => update($, isHidden, () => true)} />

    let main = null
    if (r && r.source && mainLeft !== null) {
      const k = f[r.source]
      const cal = Math.abs(k - 1) >= 0.15 ? ` (×${k.toFixed(1)} calibrated)` : ''
      const step = r.step && r.steps ? ` · step ${r.step}/${r.steps}` : ''
      const label = r.label ? ` · ${r.label}` : ''
      main = (
        <Text>
          <Text bold>⏱ main {left(mainLeft)}</Text>
          <Text dimColor>
            {r.source === 'quick' ? ' (quick guess)' : ''}
            {cal}
            {step}
            {label} · {verdict(mainLeft)}
          </Text>
        </Text>
      )
    }

    const rows = Math.max(1, Math.min(MAX_AGENT_ROWS, e.props.maxRows - (main ? 2 : 1)))
    const shown = list.slice(0, rows)
    const lefts = list.map(a => remainingOf(a, f, t))
    const allDone = [mainLeft, ...lefts].reduce<number | null>((m, x) => (x === null ? m : m === null ? x : Math.max(m, x)), null)

    return (
      <Box flexDirection="column">
        {main ? (
          <Box>
            {main}
            <Text> </Text>
            {hide}
          </Box>
        ) : null}
        {list.length > 0 ? (
          <Box>
            <Text dimColor>
              ⑂ {list.length} subagent{list.length > 1 ? 's' : ''} running
              {allDone !== null && allDone > 0 ? ` · everything done in ~${fmt(allDone)}` : ''}
            </Text>
            {main ? null : <Text> </Text>}
            {main ? null : hide}
          </Box>
        ) : null}
        {shown.map((a, i) => {
          const rem = lefts[i] ?? null
          const step = a.step && a.steps ? ` · step ${a.step}/${a.steps}` : ''
          return (
            <Text key={a.id} dimColor>
              {'  '}↳ {a.isSide ? 'side' : a.kind}: {a.task.slice(0, 40)} ·{' '}
              {rem === null ? 'estimating…' : `${left(rem)}${a.source === 'quick' ? ' (quick guess)' : ''}`}
              {step}
            </Text>
          )
        })}
        {list.length > shown.length ? <Text dimColor>{'  '}+{list.length - shown.length} more</Text> : null}
      </Box>
    )
  })
}
