import { ActivityIndicator, Text, View } from 'react-native';

import { BrandSignature } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-8">
      <View className="absolute left-0 top-0 h-2 w-28 bg-coral" />
      <BrandSignature />
      <Text className="mt-3 font-medium text-xs text-muted">Preparing your workspace</Text>
      <ActivityIndicator className="mt-6" color={colors.brand} size="small" />
    </View>
  );
}
