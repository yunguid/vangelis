/**
 * The looks the Notes panel can take: WebGL2 styles in ./styles, loaded one
 * at a time by GlNotesView when picked. Phosphor comes in versions that share
 * its highway and differ in finish; the picker keeps them together on the
 * left of the Notes row and the other styles on the right. Kept free of
 * imports so the home page carries only these names.
 */
export const NOTES_STYLES = Object.freeze([
  { id: 'phosphor', name: 'Phosphor', family: 'phosphor' },
  { id: 'lamp', name: 'Lamp', family: 'phosphor' },
  { id: 'pencil', name: 'Pencil', family: 'phosphor' },
  { id: 'paper', name: 'Paper roll' },
  { id: 'stars', name: 'Stars' },
  { id: 'rain', name: 'Rain' }
]);

export const DEFAULT_NOTES_STYLE = 'phosphor';

export const coerceNotesStyle = (value) => (
  NOTES_STYLES.some(({ id }) => id === value) ? value : DEFAULT_NOTES_STYLE
);

export const notesStyleName = (id) => NOTES_STYLES.find((style) => style.id === id)?.name ?? id;
