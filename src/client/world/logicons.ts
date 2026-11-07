// One icon per LogEntry.kind (a unit test checks every kind in LOG_KINDS has one that exists in ICON_PATHS).
export const LOG_ICON: Record<string, string> = {
  work: 'leaf', travel: 'road', visit: 'person', banquet: 'coin', gift: 'coin', reward: 'coin', search: 'scroll', study: 'scroll', drill: 'sword',
  rest: 'moon', recruit: 'person', serve: 'person', join: 'person', resign: 'flag', defect: 'flag', rebel: 'flag', duel: 'sword', oath: 'knot',
  marry: 'heart', claim: 'tower', uprise: 'flag', appoint: 'scroll', transfer: 'road', mission: 'scroll', 'mission-done': 'star', 'mission-failed': 'skull',
  transport: 'road', war: 'sword', diplomacy: 'knot', propose: 'scroll', captive: 'knot', focus: 'tower', battle: 'sword', capture: 'knot', death: 'skull',
  succession: 'star', fall: 'skull', event: 'scroll', income: 'coin', unpaid: 'coin', famine: 'leaf', appear: 'person', found: 'star', end: 'tower',
}
export const iconFor = (kind: string): string => LOG_ICON[kind] ?? 'star'
