import * as migration_20260912_131510_baseline_candidate from './20260912_131510_baseline_candidate'

export const migrations = [
  {
    up: migration_20260912_131510_baseline_candidate.up,
    down: migration_20260912_131510_baseline_candidate.down,
    name: '20260912_131510_baseline_candidate',
  },
]
