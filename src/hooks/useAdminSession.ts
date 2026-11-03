import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AdminSessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'forbidden'; email: string }
  | { status: 'admin'; email: string };

export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    const resolve = async (session: Session | null) => {
      if (!session) {
        if (active) setState({ status: 'signed-out' });
        return;
      }
      const email = session.user.email ?? '';
      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !data) setState({ status: 'forbidden', email });
      else setState({ status: 'admin', email });
    };

    supabase.auth.getSession().then(({ data }) => {
      void resolve(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        await resolve(session);
      })();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
