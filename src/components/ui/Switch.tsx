type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
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
          className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-gray-700 dark:peer-focus-visible:ring-offset-gray-800"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform peer-checked:translate-x-5 motion-reduce:transition-none"
        />
      </span>
    </label>
  );
}
