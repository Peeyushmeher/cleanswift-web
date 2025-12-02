'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/detailer/dashboard-utils';
import type { JobPhoto } from '@/types/detailer';

interface PhotoUploadProps {
  bookingId: string;
  initialPhotos: JobPhoto[];
}

export default function PhotoUpload({ bookingId, initialPhotos }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<JobPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState<'before' | 'after'>('before');
  const supabase = createClient();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${bookingId}/${photoType}_${Date.now()}.${fileExt}`;
      const filePath = `job-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(filePath);

      // Create database record
      const { data, error } = await supabase
        .from('job_photos')
        .insert({
          booking_id: bookingId,
          photo_url: publicUrl,
          photo_type: photoType,
        })
        .select()
        .single();

      if (error) throw error;

      setPhotos([...photos, data]);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!confirm('Delete this photo?')) return;

    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/job-photos/');
      const filePath = urlParts[1];

      // Delete from storage
      await supabase.storage.from('job-photos').remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('job_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      setPhotos(photos.filter(p => p.id !== photoId));
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo');
    }
  };

  const beforePhotos = photos.filter(p => p.photo_type === 'before');
  const afterPhotos = photos.filter(p => p.photo_type === 'after');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Job Photos</h3>

      {/* Upload controls */}
      <div className="flex gap-4 items-center">
        <select
          value={photoType}
          onChange={(e) => setPhotoType(e.target.value as 'before' | 'after')}
          className="px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
        >
          <option value="before">Before</option>
          <option value="after">After</option>
        </select>
        <label className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg cursor-pointer transition-colors">
          {uploading ? 'Uploading...' : 'Upload Photo'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Before photos */}
      {beforePhotos.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-2">Before Photos</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {beforePhotos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.photo_url}
                  alt="Before"
                  className="w-full h-48 object-cover rounded-lg border border-white/5"
                />
                <button
                  onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                  className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <div className="text-xs text-[#C6CFD9] mt-1">
                  {formatDate(photo.uploaded_at, 'short')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* After photos */}
      {afterPhotos.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-2">After Photos</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {afterPhotos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.photo_url}
                  alt="After"
                  className="w-full h-48 object-cover rounded-lg border border-white/5"
                />
                <button
                  onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                  className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <div className="text-xs text-[#C6CFD9] mt-1">
                  {formatDate(photo.uploaded_at, 'short')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <p className="text-[#C6CFD9] text-sm">No photos uploaded yet</p>
      )}
    </div>
  );
}

