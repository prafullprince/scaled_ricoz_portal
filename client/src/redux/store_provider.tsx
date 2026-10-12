'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore, AppStore } from './store';
import { setStoreRef } from './store.reference';
import { AuthService } from '@/services/auth.service';
import { finishAuthCheckUnauthenticated, setSession } from './slice/auth.slice';
import { setActiveCompanyId } from '@/lib/company';

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store] = useState<AppStore>(() => makeStore());

  useEffect(() => {
    setStoreRef(store);
    let active = true;

    AuthService.refresh()
      .then((data) => {
        if (active && data?.access_token && data.user) {
          setActiveCompanyId(data.user.company?.id ?? null);
          store.dispatch(setSession({ accessToken: data.access_token, user: data.user }));
        } else if (active) {
          store.dispatch(finishAuthCheckUnauthenticated());
        }
      })
      .catch(() => {
        if (active) store.dispatch(finishAuthCheckUnauthenticated());
      });

    return () => {
      active = false;
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
