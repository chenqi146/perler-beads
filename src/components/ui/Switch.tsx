type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label
      className={`flex items-center justify-between gap-3 touch-manipulation ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {description ? (
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</span>
        ) : null}
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        {/* 用 checked 显式样式，避免 iOS 上 peer-checked + sr-only 视觉不刷新 */}
        <span
          aria-hidden="true"
          className={`h-7 w-12 rounded-full transition-colors ${
            checked ? 'bg-[#c47a2c]' : 'bg-[#e8dcc8]'
          }`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full border border-[#e0d0bc] bg-[#fffaf3] shadow-sm transition-transform motion-reduce:transition-none ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </label>
  );
}
