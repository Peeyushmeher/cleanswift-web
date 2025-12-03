import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  // Use regular client - proxy.ts already verified admin access and RLS allows admins
  const supabase = await createClient();
  const params = await searchParams;

  const roleFilter = params.role || null;

  // Get all users
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (roleFilter) {
    query = query.eq('role', roleFilter);
  }

  const { data: users } = await query;

  async function updateRole(formData: FormData) {
    'use server';
    const userId = formData.get('user_id') as string;
    const newRole = formData.get('role') as string;
    if (userId && newRole) {
      const supabase = await createClient();
      await supabase.rpc('update_user_role', {
        p_user_id: userId,
        p_new_role: newRole as 'user' | 'detailer' | 'admin',
      });
      redirect('/admin/users');
    }
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Users Management</h1>
          <p className="text-[#C6CFD9]">Manage user accounts and roles</p>
        </div>

        {/* Filters */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <a
              href="/admin/users"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !roleFilter
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5'
              }`}
            >
              All
            </a>
            {['user', 'detailer', 'admin'].map((role) => (
              <a
                key={role}
                href={`/admin/users?role=${role}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  roleFilter === role
                    ? 'bg-[#32CE7A] text-white'
                    : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5'
                }`}
              >
                {role}
              </a>
            ))}
          </div>
        </div>

        {/* Users Table */}
        {!users || users.length === 0 ? (
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
            <p className="text-[#C6CFD9]">No users found</p>
          </div>
        ) : (
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#050B12] border-b border-white/10">
                  <tr>
                    <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Phone</th>
                    <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Role</th>
                    <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Bookings</th>
                    <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-white text-sm">{user.full_name}</td>
                      <td className="py-3 px-4 text-white text-sm">{user.email}</td>
                      <td className="py-3 px-4 text-white text-sm">{user.phone}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className="capitalize text-[#C6CFD9]">{user.role}</span>
                      </td>
                      <td className="py-3 px-4 text-white text-sm">{user.booking_count || 0}</td>
                      <td className="py-3 px-4">
                        <form action={updateRole} className="flex gap-2">
                          <input type="hidden" name="user_id" value={user.id} />
                          <select
                            name="role"
                            defaultValue={user.role}
                            className="px-3 py-1 bg-[#050B12] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6FF0C4]"
                          >
                            <option value="user">User</option>
                            <option value="detailer">Detailer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            type="submit"
                            className="bg-[#32CE7A] hover:bg-[#2AB869] text-white text-sm font-semibold py-1 px-3 rounded transition-colors"
                          >
                            Update
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

