import { Link } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  Text,
  View,
} from "react-native";
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';
import { SafeAreaView } from "react-native-safe-area-context";

import {
  BrandSignature,
  cn,
  Field,
  PrimaryButton,
} from "@/components/ui/primitives";
import { getApiErrorMessage } from "@/services/api";
import { authService } from "@/services/auth.service";
import { setSession } from "@/store/auth.slice";
import { useAppDispatch } from "@/store/hooks";

export default function SignupScreen() {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const sendCode = async () => {
    if (name.trim().length < 3 || !email.includes("@") || password.length < 8) {
      setError("Enter your name, a valid email, and an 8-character password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authService.sendOtp(email.trim().toLowerCase());
      setStep("verify");
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Unable to send verification code."),
      );
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit verification code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authService.signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword: password,
        otp,
      });
      if (!("access_token" in result)) {
        setSubmitted(true);
        return;
      }
      dispatch(
        setSession({ accessToken: result.access_token, user: result.user }),
      );
    } catch (signupError) {
      setError(
        getApiErrorMessage(signupError, "Unable to create your account."),
      );
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-canvas px-6">
        <View className="mx-auto w-full max-w-lg gap-5">
          <BrandSignature />
          <Text className="font-extra text-[30px] leading-9 text-ink">
            Email verified
          </Text>
          <Text className="font-sans text-[15px] leading-6 text-muted">
            Your standard account is awaiting organization review. No department or work role has been assigned.
          </Text>
          <Link href="/login" asChild>
            <Pressable className="h-12 items-center justify-center rounded-card bg-coral">
              <Text className="font-bold text-white">Back to sign in</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1">
        <View className="absolute left-0 top-24 h-24 w-2 bg-coral" />
        <ScrollView
          contentContainerClassName="flex-grow px-6 pb-10 pt-5 web:mx-auto web:w-full web:max-w-lg"
          keyboardShouldPersistTaps="handled"
        >
          <BrandSignature />
          <View className="mt-10 flex-row gap-2">
            <View className="h-1.5 flex-1 rounded-full bg-coral" />
            <View
              className={cn(
                "h-1.5 flex-1 rounded-full",
                step === "verify" ? "bg-coral" : "bg-line",
              )}
            />
          </View>
          <View className="mb-7 mt-8 gap-3">
            <Text className="font-extra text-[11px] uppercase text-teal">
              {step === "details"
                ? "Create account · 1 of 2"
                : "Verify email · 2 of 2"}
            </Text>
            <Text className="font-extra text-[34px] leading-10 text-ink">
              {step === "details" ? "Join the workspace." : "One final check."}
            </Text>
            <Text className="font-sans text-[15px] leading-6 text-muted">
              {step === "details"
                ? "Create a standard account. Organization access is reviewed separately."
                : `Enter the six-digit code sent to ${email}.`}
            </Text>
          </View>

          <View className="gap-3">
            {step === "details" ? (
              <>
                <Field
                  icon="person-outline"
                  onChangeText={setName}
                  placeholder="Full name"
                  value={name}
                />
                <Field
                  autoCapitalize="none"
                  icon="mail-outline"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Email address"
                  value={email}
                />
                <Field
                  autoCapitalize="none"
                  icon="lock-closed-outline"
                  onChangeText={setPassword}
                  placeholder="Password · 8+ characters"
                  secureTextEntry
                  value={password}
                />
              </>
            ) : (
              <Field
                className="h-20"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setOtp}
                placeholder="000000"
                textAlign="center"
                value={otp}
              />
            )}
            {error ? (
              <View className="border-l-2 border-danger bg-red-50 px-3 py-2">
                <Text className="font-medium text-sm leading-5 text-danger">
                  {error}
                </Text>
              </View>
            ) : null}
            <PrimaryButton
              busy={busy}
              icon="arrow-forward"
              label={
                step === "details" ? "Send verification code" : "Create account"
              }
              onPress={step === "details" ? sendCode : createAccount}
            />
            {step === "verify" ? (
              <Pressable
                className="h-11 items-center justify-center"
                onPress={() => setStep("details")}
              >
                <Text className="font-semibold text-sm text-teal">
                  Change account details
                </Text>
              </Pressable>
            ) : null}
            <Link href="/login" asChild>
              <Pressable className="h-11 items-center justify-center">
                <Text className="font-semibold text-sm text-teal">
                  Already registered? Sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
