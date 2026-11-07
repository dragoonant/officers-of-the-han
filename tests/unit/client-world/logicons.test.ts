import { describe, expect, it } from 'vitest'
import { LOG_KINDS } from '../../../src/world'
import { ICON_PATHS } from '../../../src/client/world/ui'
import { iconFor, LOG_ICON } from '../../../src/client/world/logicons'

describe('log kinds render', () => {
  it('every LogEntry.kind in LOG_KINDS has an icon that exists', () => {
    for (const k of LOG_KINDS) {
      expect(LOG_ICON[k.kind], `icon for ${k.kind}`).toBeTruthy()
      expect(ICON_PATHS[LOG_ICON[k.kind]!], `path for ${k.kind}`).toBeTruthy()
    }
  })
  it('an unknown kind falls back to a real icon', () => {
    expect(ICON_PATHS[iconFor('no-such-kind')]).toBeTruthy()
  })
})
