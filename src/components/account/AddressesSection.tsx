import { useState, type FormEvent } from 'react';
import { MapPin, Pencil, Plus, Trash2, X, Loader2 } from 'lucide-react';
import { useSavedAddresses, type SavedAddress, type SavedAddressInput } from '@/hooks/useSavedAddresses';

const EMPTY_ADDRESS: SavedAddressInput = {
  label: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
};

const inputClass =
  'mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-clay-300';

function validateAddress(input: SavedAddressInput): string | null {
  if (input.cep.replace(/\D/g, '').length !== 8) return 'O CEP deve ter 8 números.';
  if (input.street.trim().length < 2) return 'Informe a rua.';
  if (input.number.trim().length < 1) return 'Informe o número.';
  if (input.neighborhood.trim().length < 2) return 'Informe o bairro.';
  if (input.city.trim().length < 2) return 'Informe a cidade.';
  if (!/^[A-Za-z]{2}$/.test(input.state.trim())) return 'Use a sigla do estado (ex.: SP).';
  return null;
}

function toInput(address: SavedAddress): SavedAddressInput {
  return {
    label: address.label,
    cep: address.cep,
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
  };
}

function AddressForm({
  addressId,
  initial,
  onSave,
  onCancel,
}: {
  addressId: string | null;
  initial: SavedAddressInput;
  onSave: (id: string | null, input: SavedAddressInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SavedAddressInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof SavedAddressInput) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      noValidate
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        const problem = validateAddress(form);
        if (problem) {
          setError(problem);
          return;
        }
        setSubmitting(true);
        const ok = await onSave(addressId, {
          ...form,
          cep: form.cep.replace(/\D/g, ''),
          state: form.state.trim().toUpperCase(),
        });
        setSubmitting(false);
        if (!ok) setError('Não foi possível salvar o endereço. Tente novamente.');
      }}
      className="space-y-4 rounded-2xl border border-clay-200 bg-clay-50/40 p-5 animate-fade-in"
    >
      <p className="font-display text-lg text-stone-900">{addressId ? 'Editar endereço' : 'Novo endereço'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-stone-700">Apelido (opcional)</span>
          <input value={form.label} placeholder="Casa, trabalho..." onChange={(e) => set('label')(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">CEP</span>
          <input value={form.cep} placeholder="00000-000" onChange={(e) => set('cep')(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">UF</span>
          <input value={form.state} placeholder="SP" maxLength={2} onChange={(e) => set('state')(e.target.value)} className={inputClass} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-stone-700">Rua</span>
          <input value={form.street} onChange={(e) => set('street')(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Número</span>
          <input value={form.number} onChange={(e) => set('number')(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Complemento</span>
          <input value={form.complement} onChange={(e) => set('complement')(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Bairro</span>
          <input value={form.neighborhood} onChange={(e) => set('neighborhood')(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Cidade</span>
          <input value={form.city} onChange={(e) => set('city')(e.target.value)} className={inputClass} />
        </label>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-100">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Salvar endereço
        </button>
      </div>
    </form>
  );
}

export default function AddressesSection() {
  const { addresses, state, save, remove } = useSavedAddresses();
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleRemove = async (address: SavedAddress) => {
    if (!window.confirm(`Remover o endereço "${address.street}, ${address.number}"?`)) return;
    setRemoveError(null);
    const ok = await remove(address.id);
    if (!ok) setRemoveError('Não foi possível remover o endereço. Tente novamente.');
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-stone-900">Endereços de entrega</h2>
          <p className="mt-1 text-sm text-stone-500">Salve endereços para usar no checkout com um toque.</p>
        </div>
        {editing === null && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-clay-600"
          >
            <Plus size={16} /> Novo endereço
          </button>
        )}
      </div>

      {removeError && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{removeError}</p>}

      {editing !== null && (
        <div className="mt-6">
          <AddressForm
            key={editing === 'new' ? 'new' : editing.id}
            addressId={editing === 'new' ? null : editing.id}
            initial={editing === 'new' ? EMPTY_ADDRESS : toInput(editing)}
            onSave={async (id, input) => {
              const ok = await save(id, input);
              if (ok) setEditing(null);
              return ok;
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-3 py-10 text-stone-500">
          <Loader2 className="animate-spin" size={18} /> Carregando endereços...
        </div>
      )}
      {state === 'error' && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Não foi possível carregar seus endereços.</p>}
      {state === 'ready' && addresses.length === 0 && editing === null && (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-stone-300 py-10 text-center">
          <MapPin className="text-stone-400" size={28} />
          <p className="mt-3 font-medium text-stone-800">Nenhum endereço salvo</p>
          <p className="mt-1 text-sm text-stone-500">Seu próximo pedido pode usar um endereço já cadastrado.</p>
        </div>
      )}

      {state === 'ready' && addresses.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 p-4 transition hover:border-stone-300">
              <div className="text-sm text-stone-700">
                {address.label && <p className="font-medium text-stone-900">{address.label}</p>}
                <p>
                  {address.street}, {address.number}
                  {address.complement ? ` - ${address.complement}` : ''}
                </p>
                <p>
                  {address.neighborhood} - {address.city}/{address.state}
                </p>
                <p className="text-stone-500">CEP {address.cep}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(address)}
                  className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium transition hover:bg-stone-100"
                >
                  <Pencil size={14} /> Editar
                </button>
                <button
                  onClick={() => void handleRemove(address)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                >
                  <X size={14} /> Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
