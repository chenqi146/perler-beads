-- 0001 已包含 email/name/password_hash；本迁移仅补索引（兼容曾跑过旧版 0002 的库）
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
