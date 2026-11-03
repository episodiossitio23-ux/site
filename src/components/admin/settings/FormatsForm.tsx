import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatBRL } from '@/lib/format';
import { parseReaisToCents, centsToReaisInput } from '@/lib/money';
import ToggleSwitch from '@/components/admin/settings/ToggleSwitch';
import { SettingsCard, SettingsField } from '@/components/admin/settings/SettingsParts';
import type { FormatKind } from '@/types/store';

interface FormatItem {
  id: string;
  label: string;
  kind: FormatKind;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
}

function FormatRow({ format, onChange }: { format: FormatItem; onChange: (next: FormatItem) => void }) {
  const [label, setLabel] = useState(format.label);
  const [price, setPrice] = useState(centsToReaisInput(format.price_cents));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Partial<Pick<FormatItem, 'label' | 'price_cents' | 'is_active'>>) => {
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('print_formats')
      .update(patch)
      .eq('id', format.id)
      .select('id')
      .maybeSingle();
    setSaving(false);
    if (updateError || !data) {
      setError('Não foi possível salvar. Tente novamente.');
      return;
    }
    onChange({ ...format, ...patch });
  };

  const saveTexts = () => {
    const cents = parseReaisToCents(price);
    if (label.trim().length < 2) return setError('Informe o nome do formato.');
    if (cents === null) return setError('Informe um valor válido, por exemplo 19,90.');
    void save({ label: label.trim(), price_cents: cents });
  };

  const dirty = label.trim() !== format.label || parseReaisToCents(price) !== format.price_cents;

  return (
    <li className="space-y-3 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <SettingsField label="Nome" value={label} onChange={setLabel} />
        </div>
        <div className="w-28">
          <SettingsField label="Preço (R$)" value={price} onChange={setPrice} />
        </div>
        <div className="pt-6">
          <ToggleSwitch
            checked={format.is_active}
            disabled={saving}
            onChange={(v) => void save({ is_active: v })}
            label={`Ativar ${format.label}`}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-500">
          Atual: {formatBRL(format.price_cents)} · {format.is_active ? 'À venda' : 'Oculto'}
        </span>
        {dirty && (
          <button
            onClick={saveTexts}
            disabled={saving}
            className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </li>
  );
}

export default function FormatsForm() {
  const [formats, setFormats] = useState<FormatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('print_formats')
      .select('id,label,kind,price_cents,is_active,sort_order')
      .order('sort_order')
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError('Não foi possível carregar os formatos.');
        else setFormats((data as FormatItem[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const replace = (next: FormatItem) =>
    setFormats((prev) => prev.map((f) => (f.id === next.id ? next : f)));

  return (
    <SettingsCard title="Formatos de impressão">
      {loading && <p className="text-sm text-stone-500">Carregando...</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <ul className="divide-y divide-stone-100">
        {formats.map((format) => (
          <FormatRow key={format.id} format={format} onChange={replace} />
        ))}
      </ul>
    </SettingsCard>
  );
}
