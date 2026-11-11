import type { Metadata } from 'next';

import { ResumeContentManager } from '@/views/admin/content';

export const metadata: Metadata = {
  title: '简历管理 · JasonLuo',
  robots: { index: false, follow: false },
};

export default function AdminResumePage() {
  return <ResumeContentManager />;
}
