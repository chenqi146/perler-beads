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
      className={`flex items-center justify-between gap-3 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {description ? (
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</span>
        ) : null}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-6 w-11 rounded-full bg-[#e8dcc8] peer-checked:bg-[#c47a2c] peer-focus-visible:ring-2 peer-focus-visible:ring-[#e8b86a] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#fffaf3]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-[#e0d0bc] bg-[#fffaf3] transition-transform peer-checked:translate-x-5 motion-reduce:transition-none"
        />
      </span>
    </label>
  );
}
