import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session };

export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    const apply = (session: Session | null) => {
      if (!active) return;
      setState(session ? { status: 'signed-in', session } : { status: 'signed-out' });
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
