import { lazy, type ComponentType, type PropsWithChildren } from 'react';

import { nativeCallsAvailable, nativeCallsReady } from '@/lib/livekit-setup';
import { CallProvider as UnsupportedCallProvider } from './CallProvider.web';

export const CallProvider: ComponentType<PropsWithChildren> = nativeCallsAvailable
  ? lazy(async () => {
      await nativeCallsReady;
      const { CallProvider: NativeCallProvider } = await import('./CallProvider.native');
      return { default: NativeCallProvider };
    })
  : UnsupportedCallProvider;