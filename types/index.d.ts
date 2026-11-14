export type EstimateSource = 'quick' | 'claude'

export type Run = {
  turnId: string
  startedAt: number
  source: EstimateSource | null
  estimateMs: number | null
  estimatedAt: number | null
  step: number | null
  steps: number | null
  label: string | null
  quickMs: number | null
  firstClaudeMs: number | null
  firstClaudeAt: number | null
}

export type Factors = { quick: number; claude: number }

export type Side = { id: string; task: string; startedAt: number }

declare module 'claude-code' {
  interface PluginState {
    eta: {
      run: Run | null
      now: number
      factors: Factors
      sides: Side[]
      isHidden: boolean
    }
  }
}
