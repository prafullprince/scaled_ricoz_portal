import type { PropsWithChildren } from 'react';

import { CallContext, type CallContextValue } from '@/providers/call-context';

const unsupported = async () => { throw new Error('Calls require a Ricoz development or production build with WebRTC. Expo Go and the web preview do not support calls.'); };

const value: CallContextValue = {
  callsSupported: false,
  directCall: null,
  groupCall: null,
  activeGroupCalls: new Map(),
  syncActiveGroupCall: () => undefined,
  startDirectCall: unsupported,
  acceptDirectCall: unsupported,
  declineDirectCall: () => undefined,
  endDirectCall: () => undefined,
  startGroupCall: unsupported,
  joinGroupCall: unsupported,
  endGroupCall: async () => undefined,
};

export function CallProvider({ children }: PropsWithChildren) {
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
