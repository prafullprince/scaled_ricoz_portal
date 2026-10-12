import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { colors, spacing } from '@/constants/theme';
import type { MobileFeature } from '@/features/registry';
import { getApiErrorMessage } from '@/services/api';

const recordTitle = (record: Record<string, unknown>, index: number) => {
  for (const key of ['title', 'name', 'user_name', 'summary', 'message', 'status']) {
    if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  }
  return `Record ${index + 1}`;
};

const extractRecords = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  if (!data || typeof data !== 'object') return [];
  const object = data as Record<string, unknown>;
  for (const value of Object.values(object)) {
    if (Array.isArray(value)) return extractRecords(value);
  }
  return [object];
};

const recordSummary = (record: Record<string, unknown>) =>
  Object.entries(record)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${String(value)}`)
    .join('\n');

export function FeatureDataView({ feature }: { feature: MobileFeature }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      setLoading(true);
      setError('');
      return feature.load?.();
    })
      .then((result) => active && setData(result))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, `Unable to load ${feature.title.toLowerCase()}.`)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [feature, reloadKey]);

  const records = extractRecords(data);
  return (
    <ScrollView className="bg-canvas" contentContainerStyle={styles.content}>
      <View style={[styles.icon, { backgroundColor: feature.accent }]}>
        <Ionicons color={colors.white} name={feature.icon} size={26} />
      </View>
      <PageHeader eyebrow="Workspace" title={feature.title} description={feature.description} />

      {loading ? <ActivityIndicator color={feature.accent} style={styles.loader} /> : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => setReloadKey((value) => value + 1)}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
      ) : null}
      {!loading && !error && records.length === 0 ? <Text style={styles.empty}>Nothing to show yet.</Text> : null}
      {records.map((record, index) => (
        <View key={String(record._id ?? record.id ?? index)} style={styles.card}>
          <Text style={styles.cardTitle}>{recordTitle(record, index)}</Text>
          <Text style={styles.cardBody}>{recordSummary(record) || 'Details are available in this workspace.'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  icon: { width: 48, height: 48, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.xs, marginBottom: spacing.lg },
  loader: { marginTop: spacing.xl },
  errorBox: { padding: spacing.md, backgroundColor: '#FFF5F4', borderLeftColor: colors.danger, borderLeftWidth: 4 },
  error: { color: colors.danger, lineHeight: 20 },
  retry: { color: colors.danger, fontWeight: '800', marginTop: spacing.sm },
  empty: { color: colors.muted, paddingVertical: spacing.xl, textAlign: 'center' },
  card: { padding: spacing.md, marginBottom: 10, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 20, textTransform: 'capitalize' },
});