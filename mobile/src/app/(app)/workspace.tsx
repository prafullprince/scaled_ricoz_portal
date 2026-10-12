import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/ui/primitives';
import { featuresForUser } from '@/features/registry';
import { useAppSelector } from '@/store/hooks';

export default function WorkspaceScreen() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const tools = featuresForUser(user);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-5 pb-10 pt-5 web:mx-auto web:w-full web:max-w-4xl">
        <PageHeader eyebrow="Your tools" title="Workspace" description={`${tools.length} tools matched to your current account permissions.`} />
        <View className="mt-5 flex-row flex-wrap justify-between gap-y-3">
          {tools.map((tool, index) => (
            <Pressable
              key={tool.slug}
              className="min-h-36 w-[48.5%] overflow-hidden rounded-card border border-line bg-white p-4 active:opacity-75"
              onPress={() => router.push({ pathname: '/feature/[slug]', params: { slug: tool.slug } })}
            >
              <View className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tool.accent }} />
              <View className="mb-5 mt-1 flex-row items-start justify-between">
                <View className="h-10 w-10 items-center justify-center rounded-card" style={{ backgroundColor: `${tool.accent}16` }}><Ionicons color={tool.accent} name={tool.icon} size={21} /></View>
                <Text className="font-extra text-[10px] text-gray-300">{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <Text className="font-bold text-[15px] text-ink">{tool.title}</Text>
              <Text numberOfLines={2} className="mt-1 font-sans text-[11px] leading-4 text-muted">{tool.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
