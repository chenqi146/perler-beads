import { redirect } from 'next/navigation';

/** 色板已改为编辑页弹窗，旧链接重定向到首页 */
export default function PalettePage() {
  redirect('/');
}
