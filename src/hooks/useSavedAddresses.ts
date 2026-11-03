import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface SavedAddress {
  id: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type SavedAddressInput = Omit<SavedAddress, 'id'>;

const ADDRESS_COLUMNS = 'id,label,cep,street,number,complement,neighborhood,city,state';

export function useSavedAddresses() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select(ADDRESS_COLUMNS)
      .order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) {
      setState('error');
      return;
    }
    setAddresses(data as SavedAddress[]);
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (id: string | null, input: SavedAddressInput): Promise<boolean> => {
    const { error } = id
      ? await supabase.from('customer_addresses').update(input).eq('id', id)
      : await supabase.from('customer_addresses').insert(input);
    if (error) return false;
    await load();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
    if (error) return false;
    await load();
    return true;
  };

  return { addresses, state, save, remove, reload: load };
}
