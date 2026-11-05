// The General ladder. Used for two things:
//  1. AI strategists (Ask the General): an editorial estimate of model strength, Rural → Empire.
//  2. Players (Field Challenge): the rank earned from the final score.
export const RANKS = [
  { id: 'rural', zh: '鄉', en: 'Rural General', min: 0, blurb: 'A village captain: quick, free and willing, best for simple skirmishes.' },
  { id: 'county', zh: '縣', en: 'County General', min: 40, blurb: 'Holds a county: solid on everyday conflicts, light on nuance.' },
  { id: 'prefecture', zh: '郡', en: 'Prefecture General', min: 55, blurb: 'Commands a prefecture: reliable plans, good reading of people.' },
  { id: 'province', zh: '州', en: 'Province General', min: 70, blurb: 'Governs a province: strong judgment across work and family battles.' },
  { id: 'kingdom', zh: '國', en: 'Kingdom General', min: 85, blurb: 'Marshal of a kingdom: deep strategy, subtle and precise.' },
  { id: 'empire', zh: '帝', en: 'Empire General', min: 95, blurb: 'Grand marshal of the empire: the sharpest counsel available.' },
];
export const UNRANKED = { id: 'mercenary', zh: '傭', en: 'Mercenary', level: 0, blurb: 'A self-hosted or unknown model: rank not assessed.' };
export const rankById = (id) => RANKS.find((r) => r.id === id) || UNRANKED;
export const rankLevel = (r) => (r.id === 'mercenary' ? 0 : RANKS.indexOf(r) + 1);

/** Player rank from a 0–100 score. */
export const rankForScore = (pct) => [...RANKS].reverse().find((r) => pct >= r.min) || RANKS[0];

/** Editorial rank of an AI provider + model (ordered rules: first match wins). */
const MODEL_RULES = [
  [/opus|fable|mythos/i, 'empire'],
  [/sonnet|muse-spark|gemini-[\d.]+-pro|gemini-pro|gpt-5(?!-nano|-mini)|gpt-4\.1(?!-)|o3\b/i, 'kingdom'],
  [/haiku|deepseek-(r1|v3|chat)|qwen3-235|gpt-oss-120b|gemini-flash(?!-lite)|gemini-[\d.]+-flash(?!-lite)|nemotron-super|gpt-4\.1-mini|mistral-medium/i, 'province'],
  [/70b|72b|llama-3\.3|qwen2\.5-72|gemma-3-27b|gpt-oss-20b|mistral-small|qwen-3-32b/i, 'prefecture'],
  [/flash-lite|8b|nemo|mini|nano|gemma|3b|1b|phi/i, 'county'],
];
export function generalRank(providerId, model = '') {
  if (providerId === 'puter' && !model) return rankById('rural'); // Puter's default model
  if (providerId === 'webllm') return rankById('rural'); // small on-device models
  for (const [re, id] of MODEL_RULES) if (re.test(model)) return rankById(id);
  if (providerId === 'custom') return UNRANKED;
  return rankById('county');
}

export const stars = (r) => {
  const lvl = rankLevel(r);
  return lvl ? '★'.repeat(lvl) + '☆'.repeat(6 - lvl) : '—';
};
