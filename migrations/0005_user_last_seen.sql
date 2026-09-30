-- 游客最近访问：IP、时间、归属地（反查缓存）
ALTER TABLE users ADD COLUMN last_ip TEXT;
ALTER TABLE users ADD COLUMN last_seen_at INTEGER;
ALTER TABLE users ADD COLUMN last_ip_geo TEXT;
