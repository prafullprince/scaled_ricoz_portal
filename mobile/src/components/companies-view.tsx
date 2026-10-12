import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { DataCard, EmptyHint, ErrorBanner, Loader, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { companyService } from '@/services/company.service';

export function CompaniesView() {
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [overview, setOverview] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    companyService
      .list(query.trim() ? { search: query.trim() } : {})
      .then((payload) => active && setCompanies(extractRecords(payload)))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Companies could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query, reloadKey]);

  const openCompany = async (company: Record<string, unknown>) => {
    const companyId = String(company._id ?? company.id ?? '');
    if (!companyId) return;
    setSelected(company);
    setLoadingOverview(true);
    try {
      const [detail, companyOverview] = await Promise.all([companyService.detail(companyId), companyService.overview(companyId)]);
      setOverview({ detail, overview: companyOverview });
    } catch (loadError) {
      Alert.alert('Companies', getApiErrorMessage(loadError, 'This company could not be opened.'));
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Organization" title="Companies" description="Browse managed companies and their working overview." />
      <TextInput
        className="min-h-12 rounded-card border border-line bg-white px-4 font-medium text-[15px] text-ink"
        onChangeText={setQuery}
        onSubmitEditing={() => setReloadKey((value) => value + 1)}
        placeholder="Search companies"
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        value={query}
      />
      {loading ? <Loader color={colors.teal} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          {selected ? (
            <View className="gap-3 rounded-card border border-line bg-white p-4">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 font-bold text-[16px] text-ink">{recordTitle(selected, 0)}</Text>
                <Pressable className="h-8 items-center justify-center rounded-card bg-paper px-3 active:opacity-70" onPress={() => { setSelected(null); setOverview(null); }}>
                  <Text className="font-bold text-[12px] text-ink">Close</Text>
                </Pressable>
              </View>
              {loadingOverview ? <Loader color={colors.teal} /> : null}
              {!loadingOverview && overview ? (
                <View className="gap-2">
                  {extractRecords(overview).slice(0, 8).map((record, index) => (
                    <View key={toId(record, index)} className="gap-1 rounded-card bg-paper p-3">
                      <Text className="font-bold text-[13px] text-ink">{recordTitle(record, index)}</Text>
                      <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 4)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {companies.length ? (
            <View className="gap-2.5">
              {companies.map((company, index) => (
                <Pressable key={toId(company, index)} onPress={() => void openCompany(company)}>
                  <DataCard badge={typeof company.status === 'string' ? company.status : undefined} title={recordTitle(company, index)}>
                    <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(company, 4)}</Text>
                  </DataCard>
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyHint description="Managed companies will appear here once they are onboarded." icon="business-outline" title="No companies yet" />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
