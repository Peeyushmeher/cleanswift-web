import { requireDetailer, getDetailerMode } from '@/lib/auth';
import Sidebar from '@/components/detailer/Sidebar';
import Header from '@/components/detailer/Header';

export default async function DetailerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireDetailer();
  const mode = await getDetailerMode();

  return (
    <div className="min-h-screen bg-[#050B12] text-white flex">
      <Sidebar mode={mode} profile={profile} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

