export type Run = {
  startedAt: number
  estimateMs: number | null
  estimatedAt: number | null
  step: number | null
  steps: number | null
  label: string | null
  firstEstimateMs: number | null
  firstEstimatedAt: number | null
}

export type Side = { id: string; task: string; startedAt: number }

declare module 'claude-code' {
  interface PluginState {
    eta: {
      run: Run | null
      now: number
      factor: number
      sides: Side[]
      isHidden: boolean
    }
  }
}
