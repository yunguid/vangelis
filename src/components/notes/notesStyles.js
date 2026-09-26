/**
 * The looks the Notes panel can take. "radar" is the original Canvas 2D view
 * (BirdsEyeRadar); the others are WebGL2 styles in ./styles, loaded one at a
 * time by GlNotesView when picked. Kept free of imports so the home page
 * carries only these names.
 */
export const NOTES_STYLES = Object.freeze([
  { id: 'radar', name: 'Radar' },
  { id: 'paper', name: 'Paper roll' },
  { id: 'stars', name: 'Stars' },
  { id: 'embers', name: 'Embers' },
  { id: 'rain', name: 'Rain' },
  { id: 'phosphor', name: 'Phosphor' }
]);

export const DEFAULT_NOTES_STYLE = 'radar';

export const coerceNotesStyle = (value) => (
  NOTES_STYLES.some(({ id }) => id === value) ? value : DEFAULT_NOTES_STYLE
);
