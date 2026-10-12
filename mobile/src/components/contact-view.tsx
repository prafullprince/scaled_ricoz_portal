import { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader, PrimaryButton } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { contactService } from '@/services/contact.service';
import { useAppSelector } from '@/store/hooks';

export function ContactView() {
  const user = useAppSelector((state) => state.auth.user);
  const [name, setName] = useState(user?.user_name ?? '');
  const [email, setEmail] = useState(user?.user_email ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || subject.trim().length < 3 || message.trim().length < 10) {
      Alert.alert('Contact', 'Fill in your name, a valid email, a subject and a message of at least 10 characters.');
      return;
    }
    setBusy(true);
    try {
      await contactService.submit({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });
      setSubject('');
      setMessage('');
      Alert.alert('Message sent', 'Thanks — the Ricoz team will get back to you soon.');
    } catch (error) {
      Alert.alert('Contact', getApiErrorMessage(error, 'Unable to send your message.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Contact" title="Talk to Ricoz" description="Tell us about your problem, timeline and team — we reply within one business day." />
      <TextInput className="min-h-12 rounded-card border border-line bg-white px-4 font-medium text-[15px] text-ink" onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} value={name} />
      <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="Email address" placeholderTextColor={colors.muted} className="min-h-12 rounded-card border border-line bg-white px-4 font-medium text-[15px] text-ink" value={email} />
      <TextInput className="min-h-12 rounded-card border border-line bg-white px-4 font-medium text-[15px] text-ink" onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.muted} value={subject} />
      <TextInput
        className="min-h-32 rounded-card border border-line bg-white px-4 py-3 font-medium text-[15px] text-ink"
        multiline
        onChangeText={setMessage}
        placeholder="How can we help?"
        placeholderTextColor={colors.muted}
        textAlignVertical="top"
        value={message}
      />
      <PrimaryButton busy={busy} label="Send message" onPress={submit} />
    </ScrollView>
  );
}
