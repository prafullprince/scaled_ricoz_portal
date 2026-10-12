import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardView } from '@/components/website-dashboard-view';
import { useAppSelector } from '@/store/hooks';

export default function DashboardScreen() {
  const user = useAppSelector((state) => state.auth.user);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-canvas">
      <DashboardView user={user} />
    </SafeAreaView>
  );
}
