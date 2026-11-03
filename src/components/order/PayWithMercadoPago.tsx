import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { startMercadoPagoCheckout } from '@/lib/payments';

export default function PayWithMercadoPago({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setLoading(true);
    setError(null);
    try {
      const checkoutUrl = await startMercadoPagoCheckout(token);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o pagamento agora.');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <p className="font-display text-xl text-stone-900">Pagamento</p>
      <p className="mt-2 text-sm text-stone-600">Seu pedido será impresso assim que o pagamento for confirmado.</p>
      <button
        onClick={() => void pay()}
        disabled={loading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {loading ? 'Abrindo Mercado Pago...' : 'Pagar com Mercado Pago'}
      </button>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
