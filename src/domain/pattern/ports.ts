import type { Pattern, PatternInput } from './types';

/** Port：图纸持久化，领域/用例只依赖此接口 */
export interface PatternRepository {
  listByOwner(): Pattern[];
  listPublic(): Pattern[];
  get(id: string): Pattern | null;
  save(input: PatternInput, patternId?: string): Pattern;
  remove(patternId: string): void;
  duplicate(patternId: string): Pattern | null;
}
