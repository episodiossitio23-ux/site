import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PrintFormat } from '@/types/store';

export function useFormats() {
  const [formats, setFormats] = useState<PrintFormat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('print_formats')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError('Não foi possível carregar os formatos.');
        else setFormats((data as PrintFormat[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { formats, error, loading };
}
