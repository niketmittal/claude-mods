// Which answers are folded (per answer by its id, and all at once from /fold or /unfold),
// and the one-line summaries a folded answer shows, keyed by a hash of the answer's text.
export type FoldedById = Record<string, boolean>
export type FoldAll = boolean | null
export type Summaries = Record<string, string>

declare module 'claude-code' {
  interface PluginState {
    fold: {
      byId: FoldedById
      all: FoldAll
      summaries: Summaries
      // Fold earlier answers whenever a new prompt goes in (on by default).
      auto: boolean
    }
  }
}
