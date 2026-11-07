export interface Io { log: (s: string) => void; err: (s: string) => void }
export function classifyStatus(job: unknown): 'done' | 'failed' | 'pending'
export function jobImageNames(job: unknown): string[]
export function buildJobBody(table: object, entry: { prompt: string; seed: number }, index: number): Record<string, any>
export function main(argv: string[], io?: Io, hooks?: { current: { base: string; id: string } | null }): Promise<number>
