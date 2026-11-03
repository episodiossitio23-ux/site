import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import ToggleSwitch from '@/components/admin/settings/ToggleSwitch';
import { SettingsCard, SettingsField } from '@/components/admin/settings/SettingsParts';
import type { SmtpSettings } from '@/types/settings';

const EMPTY: SmtpSettings = { is_active: false, host: '', port: 587, secure: false, username: '', from_name: '', from_email: '' };

export default function SmtpSettingsForm() {
  const [form, setForm] = useState<SmtpSettings>(EMPTY);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('smtp_settings')
      .select('is_active,host,port,secure,username,from_name,from_email')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage({ ok: false, text: 'Não foi possível carregar as configurações de e-mail.' });
        else if (data) setForm(data as SmtpSettings);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const port = Number(form.port);
    if (form.is_active && (!form.host.trim() || !form.from_email.trim())) {
      setMessage({ ok: false, text: 'Para ativar, informe o servidor e o e-mail de envio.' });
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setMessage({ ok: false, text: 'Informe uma porta válida.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const patch: Record<string, unknown> = {
      is_active: form.is_active,
      host: form.host.trim(),
      port,
      secure: form.secure,
      username: form.username.trim(),
      from_name: form.from_name.trim(),
      from_email: form.from_email.trim(),
      updated_at: new Date().toISOString(),
    };
    if (password) patch.password = password;
    const { data, error } = await supabase.from('smtp_settings').update(patch).eq('id', 1).select('id').maybeSingle();
    setSaving(false);
    if (error || !data) {
      setMessage({ ok: false, text: 'Não foi possível salvar. Tente novamente.' });
      return;
    }
    setPassword('');
    setMessage({ ok: true, text: 'Configurações de e-mail salvas.' });
  };

  const set = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <SettingsCard title="E-mail de recuperação de senha">
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">Envio de e-mails ativo</span>
          <ToggleSwitch checked={form.is_active} onChange={(v) => set('is_active', v)} label="Ativar envio de e-mails" />
        </div>
        <SettingsField label="Servidor SMTP" value={form.host} onChange={(v) => set('host', v)} placeholder="smtp.exemplo.com" />
        <SettingsField label="Porta" value={String(form.port)} onChange={(v) => set('port', Number(v) || 0)} type="number" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">Conexão segura (SSL, porta 465)</span>
          <ToggleSwitch checked={form.secure} onChange={(v) => set('secure', v)} label="Conexão segura" />
        </div>
        <SettingsField label="Usuário" value={form.username} onChange={(v) => set('username', v)} />
        <SettingsField label="Senha do e-mail" value={password} onChange={setPassword} type="password" placeholder="Deixe em branco para manter a atual" />
        <SettingsField label="Nome do remetente" value={form.from_name} onChange={(v) => set('from_name', v)} placeholder="Paracolor" />
        <SettingsField label="E-mail do remetente" value={form.from_email} onChange={(v) => set('from_email', v)} />
        {message && <p className={`text-sm ${message.ok ? 'text-sage-700' : 'text-rose-700'}`}>{message.text}</p>}
        <button type="submit" disabled={saving} className="rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </SettingsCard>
  );
}
