import { NativeModules } from "react-native";

export const nativeCallsAvailable = Boolean(NativeModules.WebRTCModule);

export const nativeCallsReady = nativeCallsAvailable
	? import("@livekit/react-native").then(({ registerGlobals }) => { registerGlobals(); })
	: Promise.resolve();