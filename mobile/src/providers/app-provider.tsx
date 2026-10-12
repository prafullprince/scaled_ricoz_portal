import { useEffect, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { Provider } from 'react-redux';

import { tokenVault } from '@/lib/token-vault';
import { onAuthenticationFailure, refreshMobileSession } from '@/services/api';
import { clearSession, setSession } from '@/store/auth.slice';
import { store } from '@/store';

function SessionBootstrap({ children }: PropsWithChildren) {
  useEffect(() => {
    const unsubscribe = onAuthenticationFailure(() => store.dispatch(clearSession()));

    (async () => {
      try {
        const refreshToken = await tokenVault.getRefreshToken();
        if (Platform.OS === 'web' && !refreshToken) {
          store.dispatch(clearSession());
          return;
        }
        const session = await refreshMobileSession();
        store.dispatch(setSession({ accessToken: session.access_token, user: session.user }));
      } catch {
        await tokenVault.clear();
        store.dispatch(clearSession());
      }
    })();

    return unsubscribe;
  }, []);

  return children;
}

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <SessionBootstrap>{children}</SessionBootstrap>
    </Provider>
  );
}