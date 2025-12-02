'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DetailerMode } from '@/lib/detailer/mode-detection';

export function useDetailerMode() {
  const [mode, setMode] = useState<DetailerMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchMode() {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMode('solo');
          setLoading(false);
          return;
        }

        // Check if detailer has an organization
        const { data: detailer } = await supabase
          .from('detailers')
          .select('organization_id')
          .eq('profile_id', user.id)
          .single();

        if (!detailer) {
          setMode('solo');
          setLoading(false);
          return;
        }

        // If organization_id is set, get organization details
        if (detailer.organization_id) {
          setMode('organization');
          
          // Get organization details
          const { data: orgData } = await supabase.rpc('get_user_organization', {
            p_profile_id: user.id,
          });
          
          if (orgData && orgData.length > 0) {
            setOrganization(orgData[0]);
          }
        } else {
          setMode('solo');
        }
      } catch (error) {
        console.error('Error fetching detailer mode:', error);
        setMode('solo'); // Default to solo on error
      } finally {
        setLoading(false);
      }
    }

    fetchMode();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchMode();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { mode, loading, organization };
}

