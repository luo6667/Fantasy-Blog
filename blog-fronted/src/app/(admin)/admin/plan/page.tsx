import type { Metadata } from 'next';

import { PlanContentManager } from '@/views/admin/content';

export const metadata: Metadata = {
  title: '规划管理 · JasonLuo',
  robots: { index: false, follow: false },
};

export default function AdminPlanPage() {
  return <PlanContentManager />;
}
