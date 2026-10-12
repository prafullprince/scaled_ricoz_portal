import { Redirect } from 'expo-router';

import { useAppSelector } from '@/store/hooks';

export default function IndexScreen() {
  const isAuthenticated = useAppSelector((state) => state.auth.status === 'authenticated');
  return <Redirect href={isAuthenticated ? '/(app)' : '/login'} />;
}