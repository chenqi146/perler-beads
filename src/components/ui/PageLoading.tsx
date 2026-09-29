import { cn } from './cn';

/** 页面级加载态：居中旋转动效，替代纯文字 loading */
export function PageLoading({
  label = '加载中',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <main
      className={cn(
        'platform-page flex min-h-[50vh] flex-col items-center justify-center',
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-11 w-11" role="presentation">
          <span className="absolute inset-0 rounded-full border-[3px] border-[#eadfce]" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#c47a2c]" />
          <span className="absolute inset-[7px] rounded-full bg-[#c47a2c]/15 animate-pulse" />
        </div>
        <p className="text-xs tracking-wide text-[#a08060]">{label}</p>
      </div>
    </main>
  );
}
