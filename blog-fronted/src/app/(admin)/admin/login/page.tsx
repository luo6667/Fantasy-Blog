import type { Metadata } from 'next';

import { BgOrbs } from '@/components/common';
import LoginForm from '@/views/admin/LoginForm';

export const metadata: Metadata = {
  title: '管理员登录 · Fantasy',
  robots: { index: false, follow: false },
};

/** 管理员登录页（/admin/login） */
export default function AdminLoginPage() {
  return (
    <main className="relative min-h-screen">
      <BgOrbs />
      <section className="relative z-[1] flex min-h-screen items-center justify-center px-6 py-16">
        <LoginForm />
      </section>
    </main>
  );
}
