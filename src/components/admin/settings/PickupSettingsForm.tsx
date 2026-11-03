import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { SettingsCard, SettingsField } from '@/components/admin/settings/SettingsParts';
import type { StoreSettings } from '@/types/settings';

const EMPTY: StoreSettings = { store_name: '', contact_email: '', contact_phone: '', pickup_address: '', pickup_hours: '' };

export default function PickupSettingsForm() {
  const [form, setForm] = useState<StoreSettings>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('store_settings')
      .select('store_name,contact_email,contact_phone,pickup_address,pickup_hours')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage({ ok: false, text: 'Não foi possível carregar os dados da loja.' });
        else if (data) setForm(data as StoreSettings);
      });
    return () => {
      active = false;
    };
  }, []);

  const set = (key: keyof StoreSettings) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (form.pickup_address.trim().length < 5) {
      setMessage({ ok: false, text: 'Informe o endereço para retirada na loja.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase
      .from('store_settings')
      .update({
        store_name: form.store_name.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim(),
        pickup_address: form.pickup_address.trim(),
        pickup_hours: form.pickup_hours.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select('id')
      .maybeSingle();
    setSaving(false);
    setMessage(error || !data ? { ok: false, text: 'Não foi possível salvar. Tente novamente.' } : { ok: true, text: 'Dados salvos.' });
  };

  return (
    <SettingsCard title="Loja e retirada">
      <form onSubmit={save} className="space-y-4">
        <SettingsField label="Nome da loja" value={form.store_name} onChange={set('store_name')} />
        <SettingsField label="E-mail de contato" value={form.contact_email} onChange={set('contact_email')} />
        <SettingsField label="Telefone de contato" value={form.contact_phone} onChange={set('contact_phone')} />
        <SettingsField label="Endereço para retirada na loja" value={form.pickup_address} onChange={set('pickup_address')} multiline />
        <SettingsField label="Horário de retirada" value={form.pickup_hours} onChange={set('pickup_hours')} placeholder="Seg a sex, 9h às 18h" />
        {message && <p className={`text-sm ${message.ok ? 'text-sage-700' : 'text-rose-700'}`}>{message.text}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </SettingsCard>
  );
}
