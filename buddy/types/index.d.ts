export type Beat = number

declare module 'claude-code' {
  interface PluginState {
    buddy: {
      beat: Beat
      remarks: Record<string, string>
    }
  }
}
