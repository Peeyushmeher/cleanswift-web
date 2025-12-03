import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeleteButton } from '@/components/admin/DeleteButton';

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="px-2 py-1 rounded-md text-xs font-medium bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/30">
      Active
    </span>
  ) : (
    <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
      Inactive
    </span>
  );
}

export default async function AdminServicesPage() {
  const supabase = await createClient();

  // Get all services (including inactive ones for admin)
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .order('display_order');

  // Get all addons (including inactive ones for admin)
  const { data: addons, error: addonsError } = await supabase
    .from('service_addons')
    .select('*')
    .order('display_order');

  if (servicesError) console.error('Services error:', servicesError);
  if (addonsError) console.error('Addons error:', addonsError);

  // Server Actions for Services
  async function createService(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string);
    const duration = parseInt(formData.get('duration_minutes') as string) || 60;
    
    if (!name || !price) return;

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from('services')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    await supabase.from('services').insert({
      name,
      description: description || null,
      price,
      duration_minutes: duration,
      display_order: (maxOrder?.display_order || 0) + 1,
      is_active: true,
    });
    
    revalidatePath('/admin/services');
  }

  async function updateService(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string);
    const duration = parseInt(formData.get('duration_minutes') as string);
    const isActive = formData.get('is_active') === 'true';
    
    if (!id || !name || !price) return;

    await supabase
      .from('services')
      .update({
        name,
        description: description || null,
        price,
        duration_minutes: duration,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    revalidatePath('/admin/services');
  }

  async function toggleService(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    const currentStatus = formData.get('current_status') === 'true';
    
    if (!id) return;

    await supabase
      .from('services')
      .update({ 
        is_active: !currentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    revalidatePath('/admin/services');
  }

  async function deleteService(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    if (!id) return;

    await supabase.from('services').delete().eq('id', id);
    revalidatePath('/admin/services');
  }

  // Server Actions for Add-ons
  async function createAddon(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string);
    
    if (!name || !price) return;

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from('service_addons')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    await supabase.from('service_addons').insert({
      name,
      description: description || null,
      price,
      display_order: (maxOrder?.display_order || 0) + 1,
      is_active: true,
    });
    
    revalidatePath('/admin/services');
  }

  async function updateAddon(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string);
    const isActive = formData.get('is_active') === 'true';
    
    if (!id || !name || !price) return;

    await supabase
      .from('service_addons')
      .update({
        name,
        description: description || null,
        price,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    revalidatePath('/admin/services');
  }

  async function toggleAddon(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    const currentStatus = formData.get('current_status') === 'true';
    
    if (!id) return;

    await supabase
      .from('service_addons')
      .update({ 
        is_active: !currentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    revalidatePath('/admin/services');
  }

  async function deleteAddon(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    if (!id) return;

    await supabase.from('service_addons').delete().eq('id', id);
    revalidatePath('/admin/services');
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Services & Pricing</h1>
        <p className="text-[#C6CFD9]">
          Manage service packages and add-ons • {services?.length || 0} services • {addons?.length || 0} add-ons
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content - Services */}
        <div className="xl:col-span-2 space-y-6">
          {/* Create Service Form */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Create New Service</h2>
            <form action={createService} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                  placeholder="e.g., Premium Detail"
                />
              </div>
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Price ($) *</label>
                <input
                  type="number"
                  name="price"
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                  placeholder="99.00"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-[#C6CFD9] mb-1 block">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50 resize-none"
                  placeholder="What's included in this service..."
                />
              </div>
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Duration (minutes)</label>
                <input
                  type="number"
                  name="duration_minutes"
                  defaultValue="60"
                  min="15"
                  step="15"
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
                >
                  Create Service
                </button>
              </div>
            </form>
          </div>

          {/* Services List */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Services ({services?.length || 0})</h2>
            </div>
            
            {!services || services.length === 0 ? (
              <div className="p-8 text-center text-[#C6CFD9]">
                No services created yet. Add your first service above.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {services.map((service: any) => (
                  <details key={service.id} className="group">
                    <summary className="p-4 hover:bg-white/5 transition-colors cursor-pointer list-none">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">{service.name}</span>
                            <StatusBadge isActive={service.is_active} />
                            <svg className="w-4 h-4 text-[#C6CFD9] group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {service.description && (
                            <p className="text-sm text-[#C6CFD9] mb-2">{service.description}</p>
                          )}
                          <div className="text-sm text-[#C6CFD9]">
                            {service.duration_minutes} minutes
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-[#32CE7A]">${Number(service.price).toFixed(2)}</span>
                          <div className="flex gap-1">
                            <form action={toggleService}>
                              <input type="hidden" name="id" value={service.id} />
                              <input type="hidden" name="current_status" value={String(service.is_active)} />
                              <button
                                type="submit"
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                  service.is_active
                                    ? 'text-yellow-400 hover:bg-yellow-500/10'
                                    : 'text-[#32CE7A] hover:bg-[#32CE7A]/10'
                                }`}
                              >
                                {service.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </form>
                            <DeleteButton 
                              action={deleteService} 
                              id={service.id} 
                              itemName="service"
                            />
                          </div>
                        </div>
                      </div>
                    </summary>
                    
                    {/* Edit Form */}
                    <div className="p-4 bg-[#050B12] border-t border-white/5">
                      <form action={updateService} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="hidden" name="id" value={service.id} />
                        <div>
                          <label className="text-xs text-[#C6CFD9] mb-1 block">Name</label>
                          <input
                            type="text"
                            name="name"
                            defaultValue={service.name}
                            required
                            className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#C6CFD9] mb-1 block">Price ($)</label>
                          <input
                            type="number"
                            name="price"
                            defaultValue={service.price}
                            required
                            step="0.01"
                            className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#C6CFD9] mb-1 block">Description</label>
                          <textarea
                            name="description"
                            defaultValue={service.description || ''}
                            rows={2}
                            className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#C6CFD9] mb-1 block">Duration (minutes)</label>
                          <input
                            type="number"
                            name="duration_minutes"
                            defaultValue={service.duration_minutes}
                            min="15"
                            step="15"
                            className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              name="is_active"
                              value="true"
                              defaultChecked={service.is_active}
                              className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A]/50"
                            />
                            <span className="text-sm text-[#C6CFD9]">Active</span>
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Add-ons */}
        <div className="space-y-6">
          {/* Create Addon Form */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Create Add-on</h2>
            <form action={createAddon} className="space-y-4">
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                  placeholder="e.g., Engine Bay Clean"
                />
              </div>
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50 resize-none"
                  placeholder="What's included..."
                />
              </div>
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Price ($) *</label>
                <input
                  type="number"
                  name="price"
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                  placeholder="19.99"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
              >
                Create Add-on
              </button>
            </form>
          </div>

          {/* Addons List */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Add-ons ({addons?.length || 0})</h2>
            </div>
            
            {!addons || addons.length === 0 ? (
              <div className="p-4 text-center text-[#C6CFD9]">
                No add-ons created yet
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {addons.map((addon: any) => (
                  <details key={addon.id} className="group">
                    <summary className="p-4 hover:bg-white/5 transition-colors cursor-pointer list-none">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{addon.name}</span>
                          <StatusBadge isActive={addon.is_active} />
                          <svg className="w-4 h-4 text-[#C6CFD9] group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {addon.description && (
                        <p className="text-xs text-[#C6CFD9] mb-2">{addon.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[#32CE7A] font-semibold">${Number(addon.price).toFixed(2)}</span>
                        <div className="flex gap-1">
                          <form action={toggleAddon}>
                            <input type="hidden" name="id" value={addon.id} />
                            <input type="hidden" name="current_status" value={String(addon.is_active)} />
                            <button
                              type="submit"
                              className={`px-2 py-1 text-xs rounded transition-colors ${
                                addon.is_active
                                  ? 'text-yellow-400 hover:bg-yellow-500/10'
                                  : 'text-[#32CE7A] hover:bg-[#32CE7A]/10'
                              }`}
                            >
                              {addon.is_active ? 'Disable' : 'Enable'}
                            </button>
                          </form>
                          <DeleteButton 
                            action={deleteAddon} 
                            id={addon.id} 
                            itemName="add-on"
                            size="sm"
                          />
                        </div>
                      </div>
                    </summary>
                    
                    {/* Edit Form */}
                    <div className="p-4 bg-[#050B12] border-t border-white/5">
                      <form action={updateAddon} className="space-y-3">
                        <input type="hidden" name="id" value={addon.id} />
                        <div>
                          <label className="text-xs text-[#C6CFD9] mb-1 block">Name</label>
                          <input
                            type="text"
                            name="name"
                            defaultValue={addon.name}
                            required
                            className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#C6CFD9] mb-1 block">Description</label>
                          <textarea
                            name="description"
                            defaultValue={addon.description || ''}
                            rows={2}
                            className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#C6CFD9] mb-1 block">Price ($)</label>
                          <input
                            type="number"
                            name="price"
                            defaultValue={addon.price}
                            required
                            step="0.01"
                            className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                          />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="is_active"
                            value="true"
                            defaultChecked={addon.is_active}
                            className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A]"
                          />
                          <span className="text-sm text-[#C6CFD9]">Active</span>
                        </label>
                        <button
                          type="submit"
                          className="w-full px-3 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white text-sm rounded-lg transition-colors"
                        >
                          Save Changes
                        </button>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
