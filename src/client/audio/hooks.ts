// The game-facing sound hooks (docs/spec/60-audio.md section 4). Small, defensive calls the screens make; each is a no-op with no audio files.
import { audio } from './index'
import { battleCues, duelRoundCue, type BattleEventLike, type TroopKind } from './moods'

export const audioHooks = {
  /** A battle beat started (the director's `start`). */
  battleEvent(ev: BattleEventLike, typeOf: (unit: string) => TroopKind | undefined): void {
    try {
      const r = battleCues(ev, typeOf)
      for (const c of r.cues) audio.play(c)
      if (r.charge) audio.chargeFor(r.charge)
    } catch {
      /* sound must never break the game */
    }
  },
  /** One duel round finished. */
  duelRound(r: { a: string; b: string; dealtByA: number; dealtByB: number }): void {
    const c = duelRoundCue(r)
    if (c) audio.play(c)
  },
  /** A tablet was set down. */
  debateTally(): void {
    audio.play('debate-tally')
  },
  /** A debate ended: a win or a loss for the player's side (no sound when the AI debated the AI). */
  debateResult(playerWon: boolean | null): void {
    if (playerWon === null) return
    audio.play(playerWon ? 'debate-win' : 'debate-loss')
  },
}
