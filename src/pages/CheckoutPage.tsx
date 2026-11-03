import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ShoppingBag } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import { useStore } from '@/context/StoreContext';
import { useFormats } from '@/hooks/useFormats';
import { useCatalog } from '@/hooks/useCatalog';
import { getCatalogUnitPrice } from '@/lib/catalogPricing';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import { formatBRL } from '@/lib/format';
import { exportPrintBlob } from '@/lib/renderPrint';
import { uploadToPrintBucket } from '@/lib/printStorage';
import { startMercadoPagoCheckout } from '@/lib/payments';
import { getEffectiveDpi, getQualityLevel } from '@/lib/printLayout';
import { EMPTY_CUSTOMER, toRpcCustomer, validateCustomer, type CustomerErrors, type CustomerForm } from '@/lib/checkoutValidation';
import type { PhotoDraft, PrintFormat } from '@/types/store';
import type { ShippingMethod, StoreSettings } from '@/types/settings';

interface DeliveryOption {
  id: string;
  label: string;
  detail: string;
  priceCents: number;
}

interface CartLine {
  photo: PhotoDraft;
  format: PrintFormat;
  variant: ReturnType<typeof useCatalog>['products'][number]['variants'][number] | null;
  unitPrice: number;
}

const FIELDS: { key: keyof CustomerForm; label: string; half?: boolean; placeholder?: string }[] = [
  { key: 'name', label: 'Nome completo' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone com DDD', half: true, placeholder: '(11) 99999-9999' },
  { key: 'cep', label: 'CEP', half: true, placeholder: '00000-000' },
  { key: 'street', label: 'Rua' },
  { key: 'number', label: 'Número', half: true },
  { key: 'complement', label: 'Complemento', half: true },
  { key: 'neighborhood', label: 'Bairro', half: true },
  { key: 'city', label: 'Cidade', half: true },
  { key: 'state', label: 'UF', half: true, placeholder: 'SP' },
];

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={field.half ? 'block' : 'block sm:col-span-2'}>
      <span className="text-sm font-medium text-stone-700">{field.label}</span>
      <input
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-clay-300 ${error ? 'border-rose-400' : 'border-stone-300'}`}
      />
      {error && <span className="mt-1 block text-xs text-rose-700">{error}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl text-stone-900">{title}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

export default function CheckoutPage() {
  const { photos, clearCart } = useStore();
  const { formats, loading } = useFormats();
  const { products } = useCatalog();
  const [form, setForm] = useState<CustomerForm>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lines: CartLine[] = photos.flatMap((photo) => {
    const format = formats.find((f) => f.id === photo.formatId);
    const variant = products.flatMap((product) => product.variants).find((item) => item.id === photo.catalogVariantId) ?? null;
    return photo.inCart && format ? [{ photo, format, variant, unitPrice: variant ? getCatalogUnitPrice(variant, photo.quantity) : format.price_cents }] : [];
  });
  const [pickup, setPickup] = useState<Pick<StoreSettings, 'pickup_address' | 'pickup_hours'> | null>(null);
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [choice, setChoice] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('store_settings').select('pickup_address,pickup_hours').eq('id', 1).maybeSingle(),
      supabase
        .from('shipping_methods')
        .select('id,name,description,price_cents,is_active,sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.rpc('mercadopago_enabled'),
    ]).then(([store, ships, payment]) => {
      if (!active) return;
      setPickup(store.data as Pick<StoreSettings, 'pickup_address' | 'pickup_hours'> | null);
      setMethods((ships.data as ShippingMethod[]) ?? []);
      setPaymentEnabled(!payment.error && payment.data === true);
      setOptionsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const subtotal = lines.reduce((sum, { photo, unitPrice }) => sum + unitPrice * photo.quantity, 0);
  const options: DeliveryOption[] = [
    ...(pickup?.pickup_address
      ? [
          {
            id: 'retirada',
            label: 'Retirada na loja',
            detail: [pickup.pickup_address, pickup.pickup_hours].filter(Boolean).join(' · '),
            priceCents: 0,
          },
        ]
      : []),
    ...methods.map((m) => ({ id: m.id, label: m.name, detail: m.description, priceCents: m.price_cents })),
  ];
  const selectedOption = options.find((o) => o.id === choice) ?? options[0] ?? null;
  const needsAddress = selectedOption !== null && selectedOption.id !== 'retirada';
  const total = subtotal + (selectedOption?.priceCents ?? 0);
  const lowQuality = lines.filter(({ photo, format }) =>
    ['baixa', 'insuficiente'].includes(
      getQualityLevel(getEffectiveDpi(photo.image.naturalWidth, photo.image.naturalHeight, photo.transform, format)),
    ),
  );

  useEffect(() => {
    const cep = form.cep.replace(/\D/g, '');
    if (!needsAddress || cep.length !== 8) {
      setCepMessage(null);
      setCepLoading(false);
      return;
    }

    let active = true;
    setCepLoading(true);
    setCepMessage(null);
    void fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(async (response) => {
        if (!response.ok) throw new Error('lookup');
        return response.json() as Promise<{ erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }>;
      })
      .then((data) => {
        if (!active) return;
        if (data.erro) {
          setCepMessage('CEP não encontrado. Confira os números ou preencha o endereço manualmente.');
          setErrors((prev) => ({ ...prev, cep: 'Confira o CEP informado.' }));
          return;
        }
        setForm((prev) => ({
          ...prev,
          street: data.logradouro ?? prev.street,
          neighborhood: data.bairro ?? prev.neighborhood,
          city: data.localidade ?? prev.city,
          state: data.uf ?? prev.state,
        }));
        setErrors((prev) => ({ ...prev, cep: undefined, street: undefined, neighborhood: undefined, city: undefined, state: undefined }));
        setCepMessage('Endereço encontrado. Confira os dados antes de continuar.');
      })
      .catch(() => {
        if (active) setCepMessage('Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.');
      })
      .finally(() => {
        if (active) setCepLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.cep, needsAddress]);

  const updateField = (key: keyof CustomerForm, value: string) => {
    const nextValue = key === 'cep'
      ? value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
      : key === 'state'
        ? value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase()
        : value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key === 'cep') setCepMessage(null);
  };

  const setItemProgress = (index: number, fraction: number) => {
    setProgress((prev) => prev.map((value, i) => (i === index ? fraction : value)));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || lines.length === 0 || !selectedOption) return;

    const validation = validateCustomer(form, needsAddress);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setProgress(lines.map(() => 0));

    try {
      const sessionId = crypto.randomUUID();
      const items = [];

      for (let index = 0; index < lines.length; index++) {
        const { photo, format } = lines[index];
        const originalPath = `sessions/${sessionId}/${photo.id}-original.${extensionOf(photo.name)}`;
        const printPath = `sessions/${sessionId}/${photo.id}-print.jpg`;

        await uploadToPrintBucket(originalPath, photo.file, photo.file.type || 'image/jpeg', (f) =>
          setItemProgress(index, f * 0.5),
        );
        const printBlob = await exportPrintBlob(photo, format);
        await uploadToPrintBucket(printPath, printBlob, 'image/jpeg', (f) => setItemProgress(index, 0.5 + f * 0.5));

        items.push({
          format_id: format.id,
          catalog_variant_id: photo.catalogVariantId,
          quantity: photo.quantity,
          caption: photo.caption.text,
          caption_style: photo.caption,
          crop_settings: photo.transform,
          original_name: photo.name,
          original_path: originalPath,
          print_path: printPath,
        });
      }

      const { data, error } = await supabase.rpc('create_order', {
        p_customer: toRpcCustomer(form),
        p_items: items,
        p_fulfillment:
          selectedOption.id === 'retirada'
            ? { type: 'retirada' }
            : { type: 'envio', shipping_method_id: selectedOption.id },
      });
      if (error) throw new Error(error.message);

      const token = (data as { access_token?: string } | null)?.access_token;
      if (!token) throw new Error('Não recebemos a confirmação do pedido. Tente novamente.');

      clearCart();
      const checkoutUrl = paymentEnabled ? await startMercadoPagoCheckout(token).catch(() => null) : null;
      if (checkoutUrl) window.location.href = checkoutUrl;
      else navigate(`/pedido/${token}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível concluir o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && lines.length === 0 && !submitting) {
    return (
      <main>
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-6 py-20 text-center animate-fade-in">
          <ShoppingBag className="mx-auto text-stone-400" />
          <p className="mt-4 font-display text-2xl text-stone-900">Não há fotos no carrinho</p>
          <button
            onClick={() => navigate('/revelar')}
            className="mt-6 rounded-full bg-clay-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
          >
            Revelar minhas fotos
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <SiteHeader />
      <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_340px] animate-fade-in">
        <div className="space-y-6">
          <h1 className="font-display text-3xl text-stone-900">Finalizar compra</h1>
          {lowQuality.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-700">
              {lowQuality.length} foto(s) com resolução baixa para o formato escolhido. A impressão pode ficar com pouca nitidez.
            </div>
          )}
          <Section title="Seus dados">
            {FIELDS.slice(0, 2).map((field) => (
              <FieldInput key={field.key} field={field} value={form[field.key]} error={errors[field.key]} onChange={(v) => updateField(field.key, v)} />
            ))}
          </Section>
          <Section title="Como receber">
            <div className="space-y-3 sm:col-span-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setChoice(option.id)}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${selectedOption?.id === option.id ? 'border-clay-500 bg-clay-50' : 'border-stone-300 hover:bg-stone-50'}`}
                >
                  <span>
                    <span className="block font-medium text-stone-900">{option.label}</span>
                    {option.detail && <span className="block text-sm text-stone-500">{option.detail}</span>}
                  </span>
                  <span className="flex-none font-medium text-stone-900">
                    {option.priceCents === 0 ? 'Grátis' : formatBRL(option.priceCents)}
                  </span>
                </button>
              ))}
              {!optionsLoading && options.length === 0 && (
                <p className="text-sm text-rose-700">Nenhuma forma de entrega está disponível no momento.</p>
              )}
            </div>
          </Section>
          {needsAddress && (
            <Section title="Endereço de entrega">
              {FIELDS.slice(2).map((field) => (
                <FieldInput key={field.key} field={field} value={form[field.key]} error={errors[field.key]} onChange={(v) => updateField(field.key, v)} />
              ))}
              {(cepLoading || cepMessage) && (
                <p className={`sm:col-span-2 text-xs ${cepMessage?.startsWith('Endereço') ? 'text-sage-700' : cepMessage?.startsWith('CEP') ? 'text-rose-700' : 'text-stone-500'}`}>
                  {cepLoading ? 'Consultando endereço pelo CEP...' : cepMessage}
                </p>
              )}
            </Section>
          )}
          {submitError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{submitError}</p>}
        </div>

        <aside className="h-fit space-y-4 rounded-3xl bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <p className="font-display text-xl text-stone-900">Resumo do pedido</p>
          <ul className="space-y-3 text-sm">
            {lines.map(({ photo, format, variant, unitPrice }, index) => (
              <li key={photo.id}>
                <div className="flex justify-between text-stone-700">
                  <span>
                    {photo.quantity}x {variant?.name ?? format.label}
                  </span>
                  <span>{formatBRL(unitPrice * photo.quantity)}</span>
                </div>
                {submitting && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full bg-clay-500 transition-all duration-300"
                      style={{ width: `${Math.round((progress[index] ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {selectedOption && (
            <div className="flex justify-between text-sm text-stone-700">
              <span>Entrega</span>
              <span>{selectedOption.priceCents === 0 ? 'Grátis' : formatBRL(selectedOption.priceCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-stone-200 pt-4 text-lg font-semibold text-stone-900">
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>
          <p className="text-xs text-stone-500">
            {paymentEnabled
              ? 'Após confirmar, você será levado ao Mercado Pago para concluir o pagamento com segurança.'
              : 'Seu pedido ficará registrado como aguardando pagamento.'}
          </p>
          <button
            type="submit"
            disabled={submitting || loading || optionsLoading || !selectedOption}
            className="w-full rounded-full bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
          >
            {submitting ? 'Enviando fotos...' : 'Confirmar pedido'}
          </button>
        </aside>
      </form>
    </main>
  );
}
