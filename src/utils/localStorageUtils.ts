/**
 * 兼容入口：色板选择与图纸草稿的持久化 + 纯转换逻辑。
 * 实现已拆至 domain / infrastructure，此处再导出以保持旧 import 可用。
 */

export type { PaletteSelections } from '../domain/palette/paletteSelections';
export {
  presetToSelections,
  presetKeysToHexSelections,
} from '../domain/palette/paletteSelections';

export {
  savePaletteSelections,
  loadPaletteSelections,
} from '../infrastructure/storage/paletteSelectionsRepository';

export type {
  ProjectDraftV1,
  SaveProjectDraftResult,
} from '../infrastructure/storage/projectDraftRepository';
export {
  saveProjectDraft,
  loadProjectDraft,
  clearProjectDraft,
} from '../infrastructure/storage/projectDraftRepository';
