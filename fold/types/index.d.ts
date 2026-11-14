// Which long answers are folded: per answer by its id, and all at once from /fold or /unfold.
export type FoldedById = Record<string, boolean>
export type FoldAll = boolean | null

declare module 'claude-code' {
  interface PluginState {
    fold: {
      byId: FoldedById
      all: FoldAll
    }
  }
}
