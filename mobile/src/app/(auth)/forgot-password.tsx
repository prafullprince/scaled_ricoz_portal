import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandSignature, Field, PageHeader, PrimaryButton } from '@/components/ui/primitives';
import { ErrorBanner } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { authService } from '@/services/auth.service';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestCode = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError('Enter a valid email address.'); return; }
    setBusy(true); setError('');
    try {
      await authService.requestPasswordReset(normalized);
      setResetEmail(normalized);
      Alert.alert('Reset code requested', 'If your account exists, a reset code has been sent to your email.');
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to request a reset code.')); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!/^\d{6}$/.test(otp.trim())) { setError('Enter the 6-digit reset code.'); return; }
    if (password.length < 8 || password !== confirmation) { setError('Use at least 8 characters and matching passwords.'); return; }
    setBusy(true); setError('');
    try {
      await authService.resetPassword(resetEmail, otp.trim(), password);
      Alert.alert('Password reset', 'Sign in with your new password.');
      router.replace('/login');
    } catch (resetError) { setError(getApiErrorMessage(resetError, 'Unable to reset your password.')); }
    finally { setBusy(false); }
  };
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 px-6 pb-10 pt-6 web:mx-auto web:w-full web:max-w-lg">
          <BrandSignature />
          <PageHeader eyebrow="Account" title="Reset password" />
          <Field icon="mail-outline" placeholder="Work email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!resetEmail} />
          {resetEmail ? <View className="gap-3">
            <Field placeholder="Reset code" keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" value={otp} onChangeText={setOtp} />
            <Field placeholder="New password" secureTextEntry value={password} onChangeText={setPassword} />
            <Field placeholder="Confirm new password" secureTextEntry value={confirmation} onChangeText={setConfirmation} />
            <PrimaryButton label="Reset password" busy={busy} onPress={() => void reset()} />
            <PrimaryButton label="Resend code" busy={busy} tone="teal" onPress={() => void requestCode()} />
            <Text onPress={() => { setResetEmail(''); setOtp(''); setError(''); }} className="py-3 text-center font-bold text-sm text-teal">Change email</Text>
          </View> : <PrimaryButton label="Send reset code" busy={busy} onPress={() => void requestCode()} />}
          {error ? <ErrorBanner message={error} /> : null}
          <Link href="/login" className="py-3 text-center font-bold text-sm text-teal">Back to sign in</Link>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}