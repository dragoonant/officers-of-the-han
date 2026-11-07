# 30 — Duels and debates (v0.1)

Two original one-on-one contests (PLAN D6). Both are simultaneous-choice games played in rounds. **Open information** (KB rule 8) holds this way: the AI commits its choice before the player chooses, from a distribution the UI shows in full (`query.duelTells`, `query.debateTells`), so the only hidden thing is the outcome of the AI's seeded draw, never its rules or its odds. Each contest has its own sfc32 stream seeded from its setup.

## 1. Duel (`src/duel`)
- `[D-DUEL-1]` Each duelist has **vigor** `40 + WAR / 2 + health / 10` and **spirit** 0 (max 100).
- `[D-DUEL-2]` Each round both pick a stance: **Strike**, **Guard**, **Feint**, or **Mighty Blow** (only at spirit 100), or **Yield** (ends the duel as a loss for the yielder).
- `[D-DUEL-3]` A hit deals `h = 6 + WAR / 8 + floor(rng() * 5)` to the other side, times the factor below. Resolution (rows: my stance; columns: theirs; the cell is what *I* deal / take):

| me \ them | Strike | Guard | Feint | Mighty |
|---|---|---|---|---|
| Strike | 1× / 1× | 0 / 0.5× (their counter) | 1.5× / 0 | 1× / 2.5× |
| Guard | 0.5× (my counter) / 0 | 0 / 0 | 0 / 1× (my guard is broken) | 0 / 1.25× |
| Feint | 0 / 1.5× | 1× / 0 | 0 / 0 | 0 / 2.5× |
| Mighty | 2.5× / 1× | 1.25× / 0 | 2.5× / 0 | 2.5× / 2.5× |

- `[D-DUEL-4]` Spirit: +15 for each round you take damage, +10 for each round you deal damage, +10 on Guard–Guard and Feint–Feint. Mighty Blow sets the user's spirit to 0.
- `[D-DUEL-5]` A duelist at 0 vigor is **knocked out** and loses. After 10 rounds with both standing the duel is a **draw**.
- `[D-DUEL-6]` **Duel AI tells** (the distribution it draws from): base Strike 40, Guard 30, Feint 30; `reckless` Strike +20, Guard −10, Feint −10; `cautious` Guard +20, Strike −10, Feint −10; `ambitious` Feint +10, Guard −10; below 30% vigor: Guard +15, Strike −15; Mighty Blow is always taken when available. It yields only when below 15% vigor and the opponent has more than 3× its vigor, and only if `cautious`.
- `[D-DUEL-7]` Outside battle (`W-ACT-DUEL`) a knockout is a yield: nobody is wounded or slain. In battle see `B-DUEL-3`.

## 2. Debate (`src/debate`)
- `[D-DEB-1]` Each debater has **composure** `40 + INT / 2 + CHA / 4`.
- `[D-DEB-2]` There is one shared deck of 24 **argument** tablets: four kinds (**Reason**, **Precedent**, **Appeal**, **Scorn**), each with powers 1–6 once. The deck is shuffled with the debate's stream. Each debater draws 4; after each round each draws back to 4 while the deck lasts. **Both hands are face up** (open information).
- `[D-DEB-3]` Each round both play one tablet. Reason beats Appeal, Appeal beats Scorn, Scorn beats Reason. Precedent beats none and loses to none.
- `[D-DEB-4]` A tablet's **force** = power + a stat bonus: Reason and Precedent `INT / 20`, Appeal and Scorn `CHA / 20`.
- `[D-DEB-5]` **Resolution:** if one kind beats the other, the winner deals `5 * force_winner` composure damage. Otherwise (same kind, or a Precedent involved), the higher force deals `5 * (difference)`; equal force deals nothing.
- `[D-DEB-6]` A debater at 0 composure loses. After 6 rounds the higher composure **share** (composure / starting composure) wins; on a tie the **defender** (the one being asked) wins.
- `[D-DEB-7]` **Modifiers from the world:** the asked side's starting composure +10% if it is the stronger faction by troops (diplomacy) and +10% per 20 friendship below 20 toward the asker (recruitment). The setup carries them; the debate engine only applies `composureBonus`.
- `[D-DEB-8]` **Debate AI tells:** for each tablet in hand, weight = expected damage dealt against a uniform choice from the opponent's visible hand, minus expected damage taken, shifted so the minimum is 1. The AI draws from those weights.

## 3. Contract
```ts
createDuel(setup: DuelSetup): DuelState;      stepDuel(state, {stance}): Result;    query.duelTells(state, side)
createDebate(setup: DebateSetup): DebateState; stepDebate(state, {tablet}): Result; query.debateTells(state, side)
autoDuel(setup): DuelOutcome;   autoDebate(setup): DebateOutcome      // both sides AI, same engine
```
The AI's choice for a round is drawn when the round opens and stored in state (`committed`), so the player's input cannot change it. Neither engine throws.

## Change log
- 2026-11-07 v0.1 written at M0.
