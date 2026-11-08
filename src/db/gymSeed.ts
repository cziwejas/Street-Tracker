import type { Exercise } from './types'

/** Added in v5; keep the original v2 catalogue unchanged for older migrations. */
export const gymExercises: readonly Exercise[] = ([
  ['hip-thrust', 'Hip thrust'],
  ['glute-bridge', 'Most biodrowy (glute bridge)'],
  ['romanian-deadlift', 'Martwy ciąg rumuński'],
  ['sumo-deadlift', 'Martwy ciąg sumo'],
  ['goblet-squat', 'Przysiad goblet'],
  ['step-up', 'Wejścia na podwyższenie'],
  ['leg-press', 'Wypychanie nóg na suwnicy'],
  ['leg-curl', 'Uginanie nóg na maszynie'],
  ['hip-abduction', 'Odwodzenie nóg na maszynie'],
  ['cable-kickback', 'Prostowanie nogi w tył na wyciągu'],
] satisfies [string, string][]).map(([id, name]): Exercise => ({
  id: `builtin:${id}`,
  name,
  category: 'legs',
  trackingType: 'reps_weight',
  supportsAddedWeight: true,
  variants: [],
  isCustom: false,
}))
