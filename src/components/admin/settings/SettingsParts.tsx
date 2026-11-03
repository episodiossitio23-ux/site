import type { ReactNode } from 'react';

export function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl text-stone-900">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  value,
  onChange,
  multiline,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const className =
    'mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300';
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {multiline ? (
        <textarea rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={className} />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </label>
  );
}
