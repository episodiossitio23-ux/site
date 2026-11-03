import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import ToggleSwitch from '@/components/admin/settings/ToggleSwitch';
import { SettingsCard, SettingsField } from '@/components/admin/settings/SettingsParts';

interface PaymentSettingsView {
  mp_enabled: boolean;
  has_token: boolean;
}

export default function PaymentSettingsForm() {
  const [enabled, setEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc('admin_get_payment_settings').then(({ data, error }) => {
      if (!active) return;
      const view = data as PaymentSettingsView | null;
      if (error || !view || typeof view.mp_enabled !== 'boolean') {
        setMessage({ ok: false, text: 'Não foi possível carregar as configurações de pagamento.' });
      } else {
        setEnabled(view.mp_enabled);
        setHasToken(view.has_token);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('admin_save_payment_settings', {
      p_enabled: enabled,
      p_access_token: token.trim() || null,
    });
    setSaving(false);
    if (error) {
      setMessage({ ok: false, text: error.message || 'Não foi possível salvar. Tente novamente.' });
      return;
    }
    if (token.trim()) setHasToken(true);
    setToken('');
    setMessage({ ok: true, text: 'Configurações de pagamento salvas.' });
  };

  return (
    <SettingsCard title="Pagamento com Mercado Pago">
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">Receber pagamentos pelo Mercado Pago</span>
          <ToggleSwitch checked={enabled} onChange={setEnabled} label="Receber pagamentos pelo Mercado Pago" />
        </div>
        <p className="text-sm text-stone-500">
          {loading
            ? 'Carregando...'
            : hasToken
              ? 'Access Token configurado. Para trocar, informe um novo abaixo.'
              : 'Nenhum Access Token configurado ainda.'}
        </p>
        <SettingsField
          label="Access Token de produção"
          value={token}
          onChange={setToken}
          type="password"
          placeholder={hasToken ? 'Deixe em branco para manter o atual' : 'APP_USR-...'}
        />
        <p className="text-xs text-stone-500">
          O token fica guardado com segurança no servidor e não é exibido novamente depois de salvo.
        </p>
        {message && <p className={`text-sm ${message.ok ? 'text-sage-700' : 'text-rose-700'}`}>{message.text}</p>}
        <button
          type="submit"
          disabled={saving || loading}
          className="rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </SettingsCard>
  );
}
