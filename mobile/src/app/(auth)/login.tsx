import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import {
  BrandSignature,
  Field,
  PrimaryButton,
} from "@/components/ui/primitives";
import { colors } from "@/constants/theme";
import { getApiErrorMessage } from "@/services/api";
import { authService } from "@/services/auth.service";
import { setSession } from "@/store/auth.slice";
import { useAppDispatch } from "@/store/hooks";

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const session = await authService.login({
        email: email.trim().toLowerCase(),
        password,
      });
      dispatch(
        setSession({ accessToken: session.access_token, user: session.user }),
      );
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, "Unable to sign in."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1">
        <View className="absolute right-0 top-0 h-40 w-3 bg-teal" />
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow justify-between gap-8 px-6 pb-8 pt-5 web:mx-auto web:w-full web:max-w-lg">
          <BrandSignature />
          <View className="gap-7">
            <View className="gap-3">
              <Text className="font-extra text-[11px] uppercase text-coral">
                Workspace access
              </Text>
              <Text className="font-extra text-[38px] leading-[44px] text-ink">
                Good to see you.
              </Text>
              <Text className="max-w-sm font-sans text-[15px] leading-6 text-muted">
                Sign in to your role-aware Ricoz workspace and continue where
                you left off.
              </Text>
            </View>
            <View className="gap-3">
              <Field
                autoCapitalize="none"
                autoComplete="email"
                icon="mail-outline"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Work email"
                value={email}
              />
              <View className="relative">
                <Field
                  autoCapitalize="none"
                  autoComplete="password"
                  className="pr-14"
                  icon="lock-closed-outline"
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  placeholder="Password"
                  secureTextEntry={secure}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={
                    secure ? "Show password" : "Hide password"
                  }
                  className="absolute right-1 top-0.5 h-11 w-11 items-center justify-center"
                  onPress={() => setSecure(!secure)}
                >
                  <Ionicons
                    name={secure ? "eye-outline" : "eye-off-outline"}
                    color={colors.muted}
                    size={21}
                  />
                </Pressable>
              </View>
              <Link href="/forgot-password" className="self-end py-2 font-semibold text-sm text-teal">
                Forgot password?
              </Link>
              {error ? (
                <View className="border-l-2 border-danger bg-red-50 px-3 py-2">
                  <Text className="font-medium text-sm leading-5 text-danger">
                    {error}
                  </Text>
                </View>
              ) : null}
              <PrimaryButton
                busy={submitting}
                icon="arrow-forward"
                label="Sign in"
                onPress={handleLogin}
              />
              <Link href="/signup" asChild>
                <Pressable className="h-12 items-center justify-center">
                  <Text className="font-semibold text-sm text-teal">
                    Create a new account
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons
              color={colors.teal}
              name="shield-checkmark-outline"
              size={16}
            />
            <Text className="font-medium text-[11px] text-muted">
              Encrypted mobile workspace
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
