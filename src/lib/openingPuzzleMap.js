/**
 * Opening → puzzle mapping utility.
 *
 * Chess openings are organized as `<base>: <variation>` (e.g. "King's Indian
 * Defense: Fianchetto Variation"). All variations of a family should share one
 * puzzle pool, so anything downstream that wants puzzles for an opening must
 * normalize to the base name first. Lichess puzzle `OpeningTags` are always
 * present for the base family alongside any variation tag, so filtering by the
 * base tag captures every puzzle in the family.
 */

const BASE_NAME_OVERRIDES = {
  // Normalize legacy / alternate spellings the app may produce to the tag
  // stored in the puzzle dataset.
  Petrovs_Defense: 'Russian_Game',
  Petrov_Defense: 'Russian_Game',
  Petroff_Defense: 'Russian_Game',
  Kings_Knight_Opening: 'Kings_Pawn_Game',
  Queens_Knight_Opening: 'Queens_Pawn_Game',
};

const VARIATION_WORDS = new Set([
  'variation', 'attack', 'defense', 'defence', 'gambit', 'system',
  'line', 'opening', 'accepted', 'declined', 'countergambit'
]);

const DIACRITIC_REGEX = /[̀-ͯ]/g;
const APOSTROPHE_REGEX = /['‘’ʼ]/g;

function stripDiacritics(input) {
  return String(input || '').normalize('NFD').replace(DIACRITIC_REGEX, '');
}

/**
 * Return the family/base name for a chess opening. Strips variation suffixes
 * introduced with ":" and, when no colon is present, trailing variation
 * phrases after a comma.
 *
 * Examples:
 *   "King's Indian Defense: Fianchetto Variation" -> "King's Indian Defense"
 *   "Alekhine Defense: Brooklyn, Everglades"      -> "Alekhine Defense"
 *   "Sicilian Defense"                            -> "Sicilian Defense"
 */
export function getBaseOpeningName(fullName) {
  if (!fullName) return '';
  let str = String(fullName).trim();

  const colonIdx = str.indexOf(':');
  if (colonIdx !== -1) str = str.slice(0, colonIdx).trim();

  const commaIdx = str.indexOf(',');
  if (commaIdx !== -1) {
    const head = str.slice(0, commaIdx).trim();
    const tailFirstWord = str.slice(commaIdx + 1).trim().split(/\s+/)[0] || '';
    if (head && VARIATION_WORDS.has(tailFirstWord.toLowerCase())) {
      str = head;
    }
  }

  return str;
}

/**
 * Convert an opening name (base or full) into the `OpeningTag` format used by
 * the Lichess puzzle dataset: ASCII, apostrophes removed, spaces replaced with
 * underscores, hyphens preserved.
 */
export function openingNameToPuzzleTag(name) {
  if (!name) return '';
  const base = getBaseOpeningName(name);
  const ascii = stripDiacritics(base);
  const cleaned = ascii
    .replace(APOSTROPHE_REGEX, '')
    .replace(/&/g, 'and')
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_\-]/g, '');
  return BASE_NAME_OVERRIDES[cleaned] || cleaned;
}

/**
 * Accepts either a name string or an opening object ({ name, fullName }) and
 * returns the best puzzle tag for the family.
 */
export function getPuzzleTagForOpening(opening) {
  if (!opening) return '';
  const name = typeof opening === 'string'
    ? opening
    : (opening.name || opening.fullName || '');
  return openingNameToPuzzleTag(name);
}
