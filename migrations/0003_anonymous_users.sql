-- 匿名 / 本机绑定账号：无邮箱密码，靠浏览器 Cookie 识别
ALTER TABLE users ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0;
