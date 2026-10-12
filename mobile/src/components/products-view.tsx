import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { productService } from '@/services/product.service';
import { useAppSelector } from '@/store/hooks';

const DEPARTMENTS = ['PRODUCT', 'MARKETING', 'FINANCE', 'SALES', 'PROJECTS', 'SUPPORT', 'HR', 'DESIGN', 'ENGINEERING'] as const;
const STATUSES = ['unassigned', 'development', 'production'] as const;

export function ProductsView() {
  const isAdmin = useAppSelector((state) => state.auth.user?.roles.includes('ADMIN') ?? false);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [progress, setProgress] = useState<unknown>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [dispatchDepartment, setDispatchDepartment] = useState<string>('PRODUCT');
  const [dispatchDeadline, setDispatchDeadline] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');

  const load = useCallback(async () => {
    if (isAdmin) {
      try {
        const payload = await productService.adminList();
        return extractRecords(payload);
      } catch (adminError) {
        const status = (adminError as { response?: { status?: number } }).response?.status;
        if (status !== 403) throw adminError;
      }
    }
    return extractRecords(await productService.list());
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    load()
      .then((payload) => active && setProducts(payload))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Products could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [load, reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (loadError) {
      Alert.alert('Products', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const openProgress = async (productId: string) => {
    if (expanded === productId) {
      setExpanded(null);
      setProgress(null);
      return;
    }
    setExpanded(productId);
    setProgress(null);
    try {
      setProgress(await productService.progress(productId));
    } catch (loadError) {
      Alert.alert('Products', getApiErrorMessage(loadError, 'Progress could not be loaded.'));
    }
  };

  const submitDispatch = async (productId: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dispatchDeadline)) {
      Alert.alert('Dispatch', 'Use a deadline in YYYY-MM-DD format.');
      return;
    }
    await run(() => productService.dispatch(productId, { department: dispatchDepartment, deadline: dispatchDeadline, note: dispatchNote.trim() || undefined }));
    setDispatching(null);
    setDispatchNote('');
    setDispatchDeadline('');
  };

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Delivery" title="Products" description="Ricoz product catalogue, progress and dispatch controls." />
      {loading ? <Loader color={colors.teal} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        products.length ? (
          <View className="gap-2.5">
            {products.map((product, index) => {
              const productId = String(product._id ?? product.id ?? index);
              const status = typeof product.status === 'string' ? product.status : undefined;
              const isOpen = expanded === productId;
              return (
                <View key={productId}>
                  <DataCard
                    actions={
                      <>
                        <ActionChip label={isOpen ? 'Hide progress' : 'View progress'} onPress={() => void openProgress(productId)} tone="primary" />
                        {isAdmin ? (
                          <>
                            {STATUSES.map((value) => (
                              <ActionChip
                                disabled={busy}
                                key={value}
                                label={`Mark ${value}`}
                                onPress={() => void run(() => productService.update(productId, { status: value }))}
                              />
                            ))}
                            <ActionChip label={dispatching === productId ? 'Close dispatch' : 'Dispatch'} onPress={() => setDispatching(dispatching === productId ? null : productId)} />
                          </>
                        ) : null}
                      </>
                    }
                    badge={status}
                    subtitle={typeof product.developer === 'string' ? product.developer : undefined}
                    title={recordTitle(product, index)}
                  >
                    <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(product, 3)}</Text>
                    {isOpen && progress ? (
                      <View className="mt-2 gap-1.5 rounded-card bg-paper p-3">
                        {extractRecords(progress).slice(0, 6).map((row, rowIndex) => (
                          <Text key={toId(row, rowIndex)} className="font-sans text-xs leading-4 text-muted">{recordSummary(row, 4)}</Text>
                        ))}
                      </View>
                    ) : null}
                    {dispatching === productId ? (
                      <View className="mt-2 gap-2">
                        <SectionLabel>Dispatch to department</SectionLabel>
                        <View className="flex-row flex-wrap gap-1.5">
                          {DEPARTMENTS.map((department) => (
                            <Pressable
                              key={department}
                              className={`rounded-card border px-2.5 py-1.5 ${dispatchDepartment === department ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
                              onPress={() => setDispatchDepartment(department)}
                            >
                              <Text className={`font-bold text-[11px] ${dispatchDepartment === department ? 'text-white' : 'text-ink'}`}>{department}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <TextInput
                          className="min-h-11 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink"
                          onChangeText={setDispatchDeadline}
                          placeholder="Deadline YYYY-MM-DD"
                          placeholderTextColor={colors.muted}
                          value={dispatchDeadline}
                        />
                        <TextInput
                          className="min-h-11 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink"
                          onChangeText={setDispatchNote}
                          placeholder="Note (optional)"
                          placeholderTextColor={colors.muted}
                          value={dispatchNote}
                        />
                        <ActionChip disabled={busy} label="Confirm dispatch" onPress={() => void submitDispatch(productId)} tone="primary" />
                      </View>
                    ) : null}
                  </DataCard>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyHint description="Products will appear here once the catalogue is populated." icon="cube-outline" title="No products yet" />
        )
      ) : null}
    </ScrollView>
  );
}
