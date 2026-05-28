import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
};

export function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const baseField =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-500';

type TextInputProps = {
  label: string;
  hint?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ label, hint, error, id, className, ...props }: TextInputProps) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <input id={fieldId} className={(className ?? '') + ' ' + baseField} {...props} />
    </FieldShell>
  );
}

type TextareaProps = {
  label: string;
  hint?: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ label, hint, error, id, className, ...props }: TextareaProps) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <textarea id={fieldId} className={(className ?? '') + ' ' + baseField} {...props} />
    </FieldShell>
  );
}

type SelectProps = {
  label: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ label, hint, error, options, id, className, ...props }: SelectProps) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <select id={fieldId} className={(className ?? '') + ' ' + baseField} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  description?: string;
};

export function Toggle({ label, checked, onChange, disabled, description }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        )}
      </span>
    </label>
  );
}

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
};

export function SubmitButton({ label, pendingLabel, pending, disabled }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

type FormMessageProps = {
  type: 'error' | 'success';
  children: React.ReactNode;
};

export function FormMessage({ type, children }: FormMessageProps) {
  const styles =
    type === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`rounded-lg border ${styles} p-3 text-sm`}>
      {children}
    </div>
  );
}
