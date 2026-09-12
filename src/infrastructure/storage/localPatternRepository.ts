import type { PatternRepository } from '../../domain/pattern/ports';
import type { Pattern, PatternInput } from '../../domain/pattern/types';
import {
  listPatterns,
  listPublicPatterns,
  getPattern,
  savePattern,
  deletePattern,
  duplicatePattern,
} from '../../utils/platformStore';

/** Adapter：localStorage platformStore → PatternRepository */
export const localPatternRepository: PatternRepository = {
  listByOwner: () => listPatterns(),
  listPublic: () => listPublicPatterns(),
  get: (id) => getPattern(id) ?? null,
  save: (input, patternId) => savePattern(input, patternId),
  remove: (patternId) => deletePattern(patternId),
  duplicate: (patternId) => duplicatePattern(patternId) ?? null,
};

export type { Pattern, PatternInput };
