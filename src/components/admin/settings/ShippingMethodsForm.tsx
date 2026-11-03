import { useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseReaisToCents, centsToReaisInput } from '@/lib/money';
import { formatBRL } from '@/lib/format';
import ToggleSwitch from '@/components/admin/settings/ToggleSwitch';
import { SettingsCard, SettingsField } from '@/components/admin/settings/SettingsParts';
import type { ShippingMethod } from '@/types/settings';

const COLUMNS = 'id,name,description,price_cents,is_active,sort_order';

export default function ShippingMethodsForm() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('shipping_methods').select(COLUMNS).order('sort_order').order('name');
    if (error) setMessage('Não foi possível carregar as formas de envio.');
    else setMethods((data as ShippingMethod[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const cents = parseReaisToCents(price);
    if (name.trim().length < 2) return setMessage('Informe o nome da forma de envio.');
    if (cents === null) return setMessage('Informe um valor válido, por exemplo 25,90.');
    const { error } = await supabase.from('shipping_methods').insert({
      name: name.trim(),
      description: description.trim(),
      price_cents: cents,
      is_active: true,
      sort_order: methods.length + 1,
    });
    if (error) return setMessage('Não foi possível adicionar. Tente novamente.');
    setName('');
    setDescription('');
    setPrice('');
    setMessage(null);
    setLoading(true);
    await load();
  };

  const toggle = async (method: ShippingMethod, is_active: boolean) => {
    const { error } = await supabase.from('shipping_methods').update({ is_active }).eq('id', method.id).select('id').maybeSingle();
    if (error) return setMessage('Não foi possível alterar. Tente novamente.');
    setMethods((prev) => prev.map((m) => (m.id === method.id ? { ...m, is_active } : m)));
  };

  const remove = async (method: ShippingMethod) => {
    if (!window.confirm(`Remover "${method.name}"?`)) return;
    const { error } = await supabase.from('shipping_methods').delete().eq('id', method.id).select('id').maybeSingle();
    if (error) return setMessage('Não foi possível remover. Tente novamente.');
    setMethods((prev) => prev.filter((m) => m.id !== method.id));
  };

  return (
    <SettingsCard title="Formas de envio">
      {loading && <p className="text-sm text-stone-500">Carregando...</p>}
      {!loading && methods.length === 0 && <p className="text-sm text-stone-500">Nenhuma forma de envio cadastrada.</p>}
      <ul className="divide-y divide-stone-100">
        {methods.map((method) => (
          <li key={method.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium text-stone-900">{method.name}</p>
              <p className="text-sm text-stone-500">
                {formatBRL(method.price_cents)}
                {method.description ? ` · ${method.description}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ToggleSwitch checked={method.is_active} onChange={(v) => void toggle(method, v)} label={`Ativar ${method.name}`} />
              <button onClick={() => void remove(method)} aria-label={`Remover ${method.name}`} className="text-stone-400 transition hover:text-rose-700">
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-4 border-t border-stone-200 pt-5">
        <p className="text-sm font-medium text-stone-900">Nova forma de envio</p>
        <SettingsField label="Nome" value={name} onChange={setName} placeholder="Sedex" />
        <SettingsField label="Descrição (opcional)" value={description} onChange={setDescription} placeholder="Entrega em 3 a 5 dias úteis" />
        <SettingsField label="Valor (R$)" value={price} onChange={setPrice} placeholder={centsToReaisInput(1000)} />
        {message && <p className="text-sm text-rose-700">{message}</p>}
        <button type="submit" className="rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600">
          Adicionar
        </button>
      </form>
    </SettingsCard>
  );
}
