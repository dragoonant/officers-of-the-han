// Every LogEntry.kind the world emits, with a sample line (a test checks no unknown kind appears in sims).
export interface LogKindInfo {
  kind: string
  sample: string
  /** Stored even when the player is not involved (the world chronicle). */
  chronicle: boolean
}

export const LOG_KINDS: LogKindInfo[] = [
  { kind: 'work', sample: 'Zhang Fei raised the farms of Xiapi.', chronicle: false },
  { kind: 'travel', sample: 'Guan Yu travelled to Luoyang.', chronicle: false },
  { kind: 'visit', sample: 'Liu Bei visited Zhang Fei.', chronicle: false },
  { kind: 'banquet', sample: 'Liu Bei gave a banquet.', chronicle: false },
  { kind: 'gift', sample: 'Liu Bei gave gold to Guan Yu.', chronicle: false },
  { kind: 'reward', sample: 'Cao Cao rewarded Xiahou Dun.', chronicle: false },
  { kind: 'search', sample: 'Zhao Yun searched Luoyang and found a hidden officer.', chronicle: false },
  { kind: 'study', sample: 'Zhuge Liang studied.', chronicle: false },
  { kind: 'drill', sample: 'Lu Bu drilled.', chronicle: false },
  { kind: 'rest', sample: 'Liu Bei rested.', chronicle: false },
  { kind: 'recruit', sample: 'Liu Bei asked Zhao Yun to join.', chronicle: false },
  { kind: 'serve', sample: 'Zhao Yun asked to serve Liu Bei.', chronicle: false },
  { kind: 'join', sample: 'Zhao Yun joined Liu Bei.', chronicle: true },
  { kind: 'resign', sample: 'Zhao Yun resigned.', chronicle: true },
  { kind: 'defect', sample: 'Zhang He left Yuan Shao.', chronicle: true },
  { kind: 'rebel', sample: 'Zhang Yang rebelled at Shangdang.', chronicle: true },
  { kind: 'duel', sample: 'Lu Bu defeated Zhang Fei in a duel.', chronicle: false },
  { kind: 'oath', sample: 'Liu Bei and Guan Yu swore an oath.', chronicle: true },
  { kind: 'marry', sample: 'Sun Ce married Da Qiao.', chronicle: true },
  { kind: 'claim', sample: 'Liu Bei claimed Xiapi.', chronicle: true },
  { kind: 'uprise', sample: 'Zhang Jiao raised an uprising at Julu.', chronicle: true },
  { kind: 'appoint', sample: 'Cao Cao appointed Xun Yu prefect of Xuchang.', chronicle: false },
  { kind: 'transfer', sample: 'Cao Cao sent Xun Yu to Xuchang.', chronicle: false },
  { kind: 'mission', sample: 'Cao Cao gave Xun Yu a mission.', chronicle: false },
  { kind: 'mission-done', sample: 'Xun Yu completed a mission.', chronicle: false },
  { kind: 'mission-failed', sample: 'Xun Yu failed a mission.', chronicle: false },
  { kind: 'transport', sample: 'Cao Cao moved supplies to Xuchang.', chronicle: false },
  { kind: 'war', sample: 'Cao Cao sent an army from Xuchang against Runan.', chronicle: true },
  { kind: 'diplomacy', sample: 'Cao Cao and Liu Bei agreed a truce.', chronicle: true },
  { kind: 'propose', sample: 'Xun Yu proposed a truce.', chronicle: false },
  { kind: 'captive', sample: 'Cao Cao released Lu Bu.', chronicle: false },
  { kind: 'focus', sample: 'Xun Yu set the focus of Xuchang.', chronicle: false },
  { kind: 'battle', sample: 'Cao Cao took Runan.', chronicle: true },
  { kind: 'capture', sample: 'Lu Bu was taken prisoner at Xiapi.', chronicle: true },
  { kind: 'death', sample: 'Dong Zhuo died.', chronicle: true },
  { kind: 'succession', sample: 'Sun Ce succeeded Sun Jian.', chronicle: true },
  { kind: 'fall', sample: 'The house of Dong Zhuo fell.', chronicle: true },
  { kind: 'event', sample: 'The coalition against Dong Zhuo was sworn.', chronicle: true },
  { kind: 'income', sample: 'The harvest came in.', chronicle: false },
  { kind: 'unpaid', sample: 'Xiapi could not pay its officers.', chronicle: false },
  { kind: 'famine', sample: 'Xiapi could not feed its troops.', chronicle: true },
  { kind: 'appear', sample: 'Zhuge Liang came of age.', chronicle: true },
  { kind: 'found', sample: 'Hidden officer found.', chronicle: false },
  { kind: 'end', sample: 'One house holds every city.', chronicle: true },
]

export const LOG_KIND_SET: Set<string> = new Set(LOG_KINDS.map((k) => k.kind))
export const CHRONICLE_KINDS: Set<string> = new Set(LOG_KINDS.filter((k) => k.chronicle).map((k) => k.kind))
