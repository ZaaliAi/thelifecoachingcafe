'use server';
/**
 * @fileOverview Service for uploading images to Firebase Storage.
 * - uploadProfileImage - Uploads a profile image and returns its download URL.
 */
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Uploads an image file to Firebase Storage and returns its public URL.
 * @param file The image file to upload.
 * @param userId The ID of the user, used for creating a unique path.
 * @param existingImageUrl Optional. If provided, the old image at this URL will be deleted.
 * @returns The public URL of the uploaded image.
 */
export async function uploadProfileImage(file: File, userId: string, existingImageUrl?: string | null): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required for uploading profile image.');
  }
  if (!file) {
    throw new Error('File is required for uploading.');
  }

  // Optional: Delete the old image if it exists
  if (existingImageUrl) {
    try {
      const oldImageRef = ref(storage, existingImageUrl);
      await deleteObject(oldImageRef);
      console.log('Old profile image deleted successfully.');
    } catch (error: any) {
      // If the old image doesn't exist or deletion fails, log it but don't block the new upload.
      // Common error is 'storage/object-not-found' which is fine if it's a new upload or URL was invalid.
      if (error.code !== 'storage/object-not-found') {
        console.warn('Could not delete old profile image:', error);
      }
    }
  }

  const filePath = `profile-images/${userId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, filePath);

  try {
    const snapshot = await uploadBytes(storageRef, file);
    console.log('Uploaded a blob or file!', snapshot);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw new Error('Image upload failed. Please try again.');
  }
}
