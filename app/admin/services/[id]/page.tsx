import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function AdminServiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get service
  const { data: service, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !service) {
    notFound();
  }

  // Server actions
  async function updateService(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const updates = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      price: parseFloat(formData.get('price') as string),
      duration_minutes: parseInt(formData.get('duration_minutes') as string),
    };

    await supabase.rpc('admin_update_service', {
      p_service_id: id,
      p_updates: updates,
    });
    
    revalidatePath('/admin/services');
    redirect('/admin/services');
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/services"
          className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Services
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Edit Service</h1>
        <p className="text-[#C6CFD9]">{service.name}</p>
      </div>

      {/* Edit Form */}
      <div className="max-w-2xl">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <form action={updateService} className="space-y-6">
            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Name *</label>
              <input
                type="text"
                name="name"
                required
                defaultValue={service.name}
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              />
            </div>

            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Category</label>
              <select
                name="category"
                defaultValue={service.category || ''}
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              >
                <option value="full_detail">Full Detail</option>
                <option value="interior">Interior Only</option>
                <option value="exterior">Exterior Only</option>
                <option value="paint_correction">Paint Correction</option>
                <option value="ceramic_coating">Ceramic Coating</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Description</label>
              <textarea
                name="description"
                rows={4}
                defaultValue={service.description || ''}
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Price ($) *</label>
                <input
                  type="number"
                  name="price"
                  required
                  step="0.01"
                  min="0"
                  defaultValue={service.price}
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                />
              </div>
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Duration (minutes)</label>
                <input
                  type="number"
                  name="duration_minutes"
                  min="15"
                  defaultValue={service.duration_minutes || 60}
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="text-sm text-[#C6CFD9]">
                Created: {new Date(service.created_at).toLocaleDateString()}
              </div>
              <div className="flex gap-3">
                <Link
                  href="/admin/services"
                  className="px-4 py-2 bg-[#050B12] text-[#C6CFD9] hover:text-white border border-white/10 rounded-lg transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

