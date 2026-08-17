import { compose } from '../../wailsjs/go/models';

/** Rough token estimate over a character's prose fields (~1.35 tokens/word). */
export function estimateCharTokens(c: compose.Character): number {
  const prose = [
    c.appearance, c.personality, c.backstory, c.abilities, c.relationships,
    ...(c.quotes ?? []),
  ].join(' ');
  const words = prose.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.35);
}

/** First non-empty prose field, used as the list row's summary line. */
export function charSummary(c: compose.Character): string {
  return [c.personality, c.backstory, c.appearance]
    .map(s => (s ?? '').trim())
    .find(Boolean) ?? '';
}

/** A character counts as ready once its card has a name and some prose. */
export function isCharReady(c: compose.Character): boolean {
  return Boolean(c.name?.trim()) && Boolean(charSummary(c));
}
