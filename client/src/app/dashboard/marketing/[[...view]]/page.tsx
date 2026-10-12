import { notFound } from 'next/navigation';
import { MarketingWorkspace, type MarketingView } from '@/components/dashboard/marketing/MarketingWorkspace';

const views = new Set<MarketingView>(['dashboard', 'work', 'calendar', 'approvals', 'requests', 'module', 'campaigns', 'content', 'leads', 'social', 'creative', 'publishing', 'budget', 'attribution', 'analytics', 'reports', 'assistant']);
export default async function MarketingPage({ params }: { params: Promise<{ view?: string[] }> }) {
  const segments = (await params).view;
  if (segments && segments.length > 1) notFound();
  const view = (segments?.[0] ?? 'dashboard') as MarketingView;
  if (!views.has(view)) notFound();
  return <MarketingWorkspace view={view}/>;
}
