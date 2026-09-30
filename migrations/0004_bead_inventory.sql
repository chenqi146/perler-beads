-- 豆仓：入库单 / 批次 / 出库单（余额由批次 remaining 汇总）

CREATE TABLE IF NOT EXISTS bead_inbound (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'purchase',
  status TEXT NOT NULL DEFAULT 'posted',
  created_at INTEGER NOT NULL,
  voided_at INTEGER
);

CREATE TABLE IF NOT EXISTS bead_inbound_line (
  id TEXT PRIMARY KEY,
  inbound_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  hex TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  lot_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bead_lot (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hex TEXT NOT NULL,
  inbound_id TEXT NOT NULL,
  inbound_line_id TEXT NOT NULL,
  original_qty INTEGER NOT NULL CHECK(original_qty > 0),
  remaining_qty INTEGER NOT NULL CHECK(remaining_qty >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bead_outbound (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT 'craft',
  craft_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  created_at INTEGER NOT NULL,
  voided_at INTEGER
);

CREATE TABLE IF NOT EXISTS bead_outbound_line (
  id TEXT PRIMARY KEY,
  outbound_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  hex TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0)
);

CREATE TABLE IF NOT EXISTS bead_outbound_allocation (
  id TEXT PRIMARY KEY,
  outbound_id TEXT NOT NULL,
  outbound_line_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  hex TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0)
);

CREATE INDEX IF NOT EXISTS bead_lot_user_hex_idx
  ON bead_lot(user_id, hex, created_at ASC);
CREATE INDEX IF NOT EXISTS bead_inbound_user_idx
  ON bead_inbound(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bead_outbound_user_idx
  ON bead_outbound(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bead_inbound_line_inbound_idx
  ON bead_inbound_line(inbound_id);
CREATE INDEX IF NOT EXISTS bead_outbound_line_outbound_idx
  ON bead_outbound_line(outbound_id);
CREATE INDEX IF NOT EXISTS bead_outbound_alloc_outbound_idx
  ON bead_outbound_allocation(outbound_id);
