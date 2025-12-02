import { requireAdmin } from '@/lib/auth';
import AdminSidebar from '@/components/admin/Sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-[#050B12]">
      <AdminSidebar profile={profile} />
      <main className="flex-1 lg:ml-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}

