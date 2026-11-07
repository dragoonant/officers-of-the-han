export function validateJob(body: unknown): string | null
export interface FakeFlux { url: string; port: number; stats: { requests: number; posts: number; rejected: number; running: number; maxConcurrent: number; settings: Record<string, unknown>[]; jobs: { id: string; body: Record<string, any> }[]; postedWhileExternalBusy: number }; close: () => Promise<void> }
export function startFakeFlux(o?: { port?: number; delayMs?: number; size?: number; externalBusyMs?: number; failSeeds?: number[] }): Promise<FakeFlux>
