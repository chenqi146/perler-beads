/** 固定管理员账号（对应 users.email / 登录「账号」字段） */
export function getAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || 'admin').trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getAdminEmail();
}
