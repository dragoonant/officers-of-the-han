export function drawText(buf: Buffer, width: number, x: number, y: number, text: string, scale: number, rgb: number[]): void
export function planSheets(entries: { id: string }[], rawDir: string, candidates?: number): { id: string; index: number; label: string; file: string }[][]
export function main(argv: string[], io?: { log: (s: string) => void; err: (s: string) => void }): Promise<number>
