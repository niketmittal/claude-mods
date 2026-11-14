export type EstimateSource = 'quick' | 'claude'

export type Eta = {
  source: EstimateSource | null
  estimateMs: number | null
  estimatedAt: number | null
  step: number | null
  steps: number | null
  label: string | null
}

export type Run = Eta & {
  turnId: string
  startedAt: number
  quickMs: number | null
  firstClaudeMs: number | null
  firstClaudeAt: number | null
}

export type Factors = { quick: number; claude: number }

export type Agent = Eta & { id: string; task: string; kind: string; isSide: boolean; startedAt: number }

declare module 'claude-code' {
  interface PluginState {
    eta: {
      run: Run | null
      now: number
      factors: Factors
      agents: Agent[]
      isHidden: boolean
    }
  }
}
