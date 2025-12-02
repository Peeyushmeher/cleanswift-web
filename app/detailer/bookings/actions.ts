'use server';

import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canAssignJobs } from '@/lib/detailer/permissions';
import { assignBookingToDetailer } from '@/lib/services/bookings';

/**
 * Assign a job to a detailer
 */
export async function assignJobToDetailer(bookingId: string, detailerId: string) {
  await requireDetailer();

  const mode = await getDetailerMode();
  if (mode === 'organization') {
    const organization = await getDetailerOrganization();
    if (organization) {
      const role = await getOrganizationRole(organization.id);
      if (!canAssignJobs(role)) {
        throw new Error('You do not have permission to assign jobs');
      }
    }
  }

  await assignBookingToDetailer(bookingId, detailerId);

  return { success: true };
}

