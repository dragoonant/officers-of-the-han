// W-ACT-UPRISE: a rebel army of the actor and up to four companions fights the city's garrison at month end.
import type { Army } from '../contracts/world'
import { C, O, type Ctx, bestType } from './core'
import { clearPrefect } from './people'

export function uprisingArmy(c: Ctx, actorId: string, companions: string[], cityId: string): Army {
  const ids = [actorId, ...companions]
  const army: Army = {
    id: `a${c.s.nextId++}`,
    faction: null,
    from: cityId,
    to: cityId,
    uprising: true,
    rice: 0,
    units: ids.map((id, i) => ({ officer: id, troops: 300 + O(c, id).stats.cha * 5, type: bestType(c, id), commander: i === 0 })),
  }
  for (const id of ids) {
    clearPrefect(c, id)
    O(c, id).status = 'army'
  }
  C(c, cityId)
  c.s.armies.push(army)
  return army
}
