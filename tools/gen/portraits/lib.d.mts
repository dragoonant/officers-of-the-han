export const STYLE: string
export const DEFAULT_FACE: number[]
export const DEFAULT_ZOOM: number
export const PROMPTS_FILE: string
export const TRAITS: Record<string, { clause: string; source: string }>
export function bannedWords(): string[]
export function lintPrompt(text: string, names?: string[]): string[]
export function seedFor(id: string): number
export function candidateSeed(seed: number, index: number): number
export function rawFileName(id: string, index: number): string
export function roleOf(o: { stats: { war: number; ldr: number; int: number; pol: number; cha: number }; wanderer: boolean }): string
export function bestTroop(a: Record<string, string>): string
export function buildPrompt(spec: Record<string, unknown>): string
export function officerSpecs(officers: unknown[], scenario: unknown): Record<string, any>[]
export function genericSpecs(count?: number): Record<string, any>[]
export interface PromptEntry { id: string; kind: 'officer' | 'generic'; seed: number; prompt: string; spec: Record<string, any> }
export interface PromptTable { version: number; model: string; aspect: string; megapixels: number; style: string; entries: PromptEntry[] }
export function buildPromptTable(officers: unknown[], scenario: unknown, names?: string[]): PromptTable
export function loadPromptTable(file?: string): PromptTable
export function cropBox(w: number, h: number, face?: number[], zoom?: number): { x: number; y: number; side: number }
export function pngSize(buf: Buffer): { width: number; height: number } | null
export function encodePng(w: number, h: number, rgb: Buffer): Buffer
export function solidPng(w: number, h: number, rgb: number[]): Buffer
export function run(cmd: string, args: string[], opts?: object): Promise<{ code: number; stdout: Buffer; stderr: string }>
export function parseGenArgs(argv: string[], entries: unknown[]): Record<string, any>
