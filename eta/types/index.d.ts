// One main-thread turn and the evidence for how long it has left.
export type Run = {
  turnId: string
  startedAt: number
  // Claude's latest remaining-minutes estimate (raw) and when it gave it.
  claudeMs: number | null
  claudeAt: number | null
  // Claude's first estimate this turn, kept to learn how far off its estimates run.
  firstClaudeMs: number | null
  firstClaudeAt: number | null
  // Progress: items in the plan (estimate steps, todos or tasks) and how many are done.
  total: number
  done: number
  workStartAt: number | null
  lastDoneAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    eta: {
      run: Run | null
      now: number
      // How much longer than estimated Claude's work really takes (median of past turns), once known.
      factor: number | null
      sides: string[]
    }
  }
}
