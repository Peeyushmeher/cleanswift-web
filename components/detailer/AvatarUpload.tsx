'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AvatarUploadProps {
  profileId: string;
  currentAvatarUrl: string | null | undefined;
  fullName: string;
  onAvatarUpdated?: (newAvatarUrl: string | null) => void;
}

export default function AvatarUpload({
  profileId,
  currentAvatarUrl,
  fullName,
  onAvatarUpdated,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const supabase = createClient();

  // Get initials for placeholder
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a valid image file (JPEG, PNG, or WebP)';
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return 'File size must be less than 5MB';
    }

    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate profileId
    if (!profileId) {
      setError('Profile ID is missing. Please refresh the page and try again.');
      e.target.value = '';
      return;
    }

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      // Clear the input
      e.target.value = '';
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Generate file path: {profile_id}/{timestamp}.{ext}
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const fileName = `${timestamp}.${fileExt}`;
      const filePath = `${profileId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false, // Don't overwrite existing files
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        
        // If file already exists, try with a different timestamp
        const errorMessage = uploadError.message || JSON.stringify(uploadError);
        if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
          const newTimestamp = Date.now();
          const newFileName = `${newTimestamp}.${fileExt}`;
          const newFilePath = `${profileId}/${newFileName}`;
          
          const { error: retryError } = await supabase.storage
            .from('avatars')
            .upload(newFilePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (retryError) {
            console.error('Retry upload error:', retryError);
            throw new Error(retryError.message || 'Failed to upload file. Please try again.');
          }

          // Get public URL for the new file
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(newFilePath);

          // Update detailer profile via RPC
          await updateDetailerAvatar(publicUrl);
        } else {
          // Throw a more descriptive error
          throw new Error(uploadError.message || `Storage error: ${JSON.stringify(uploadError)}`);
        }
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Update detailer profile via RPC
        await updateDetailerAvatar(publicUrl);
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      
      // Extract error message from different error types
      let errorMessage = 'Failed to upload avatar. Please try again.';
      
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
          // Check for specific error messages
          if (error.message.includes('not found') || error.message.includes('Detailer profile not found')) {
            errorMessage = 'Detailer profile not found. Please complete your onboarding first.';
          }
        } else if (error.error) {
          errorMessage = error.error;
        } else if (error.statusText) {
          errorMessage = error.statusText;
        } else if (error.toString && error.toString() !== '[object Object]') {
          errorMessage = error.toString();
        } else {
          // Log the full error for debugging
          console.error('Full error object:', JSON.stringify(error, null, 2));
          errorMessage = 'Upload failed. Please check your connection and try again.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
      // Clear the input
      e.target.value = '';
    }
  };

  const updateDetailerAvatar = async (avatarUrl: string) => {
    // Verify current user matches profileId
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated. Please log in and try again.');
    }

    if (user.id !== profileId) {
      console.error('Profile ID mismatch:', { userId: user.id, profileId });
      throw new Error('Profile ID mismatch. Please refresh the page and try again.');
    }

    // Update detailer record directly using RLS policy
    // The "Detailers can update their own profile" RLS policy allows this
    const { data, error } = await supabase
      .from('detailers')
      .update({ 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', profileId)
      .select()
      .single();

    if (error) {
      console.error('Error updating detailer avatar:', error);
      throw new Error(error.message || 'Failed to update profile picture. Please try again.');
    }

    if (!data) {
      throw new Error('Detailer profile not found. Please ensure you have completed your detailer onboarding.');
    }

    console.log('Avatar updated successfully:', data);

    // Update preview
    setPreviewUrl(avatarUrl);
    
    // Notify parent component
    if (onAvatarUpdated) {
      onAvatarUpdated(avatarUrl);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Delete old avatar from storage if it exists
      if (currentAvatarUrl) {
        try {
          // Extract file path from URL
          const urlParts = currentAvatarUrl.split('/avatars/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            await supabase.storage.from('avatars').remove([filePath]);
          }
        } catch (storageError) {
          // Log but don't fail if storage deletion fails
          console.warn('Could not delete old avatar from storage:', storageError);
        }
      }

      // Update detailer record directly to remove avatar URL
      const { error: updateError } = await supabase
        .from('detailers')
        .update({ 
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('profile_id', profileId);

      if (updateError) {
        throw updateError;
      }

      // Update preview
      setPreviewUrl(null);
      
      // Notify parent component
      if (onAvatarUpdated) {
        onAvatarUpdated(null);
      }
    } catch (error: any) {
      console.error('Error removing avatar:', error);
      
      // Extract error message from different error types
      let errorMessage = 'Failed to remove avatar. Please try again.';
      
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.error) {
          errorMessage = error.error;
        } else if (error.statusText) {
          errorMessage = error.statusText;
        } else if (error.toString && error.toString() !== '[object Object]') {
          errorMessage = error.toString();
        }
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        {/* Avatar Display */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-[#32CE7A]/20 flex items-center justify-center flex-shrink-0 border-2 border-white/10">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <span className="text-[#32CE7A] font-bold text-2xl">
                {getInitials(fullName || 'U')}
              </span>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#32CE7A] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 space-y-2">
          <div className="flex gap-3">
            <label className={`px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors inline-block ${
              uploading 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer'
            }`}>
              {uploading ? 'Uploading...' : 'Upload Photo'}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {previewUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="px-4 py-2 bg-[#050B12] border border-white/5 hover:border-red-500/50 text-[#C6CFD9] hover:text-red-400 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <p className="text-xs text-[#C6CFD9]">
            JPG, PNG, or WebP. Max 5MB.
          </p>
        </div>
      </div>
    </div>
  );
}

