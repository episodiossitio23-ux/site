import { supabase } from '@/lib/supabase';

const PAYMENT_ERROR = 'Não foi possível abrir o pagamento agora. Tente novamente.';

export async function startMercadoPagoCheckout(accessToken: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('mercadopago-checkout', {
    body: { access_token: accessToken, site_url: window.location.origin },
  });
  const checkoutUrl = (data as { checkout_url?: unknown } | null)?.checkout_url;
  if (error || typeof checkoutUrl !== 'string') throw new Error(PAYMENT_ERROR);
  return checkoutUrl;
}
