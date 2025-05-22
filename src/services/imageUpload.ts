
// Removed 'use server'; directive to make this a client-side module
/**
 * @fileOverview Service for uploading images to Firebase Storage.
 * - uploadProfileImage - Uploads a profile image and returns its download URL.
 */
import { ref, uploadBytes, getDownloadURL, deleteObject, StorageError } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase'; // Import the initialized storage and auth instances

/**
 * Uploads an image file to Firebase Storage and returns its public URL.
 * This function is intended to be called from the client-side.
 * @param file The image file to upload.
 * @param userId The ID of the user, used for creating a unique path. 
 *               It's vital this matches the currently authenticated user's UID for rules to pass.
 * @param existingImageUrl Optional. If provided, the old image at this URL will be deleted.
 * @returns The public URL of the uploaded image.
 */
export async function uploadProfileImage(file: File | undefined, userId: string, existingImageUrl?: string | null): Promise<string> {
  // On the client, auth.currentUser should be available and correct if the user is logged in.
  // console.log('[imageUpload.ts Client-Side] Auth UID from auth.currentUser:', auth.currentUser?.uid);
  // console.log('[imageUpload.ts Client-Side] UserID param passed to function:', userId);

  // It's crucial that auth.currentUser?.uid matches the userId param for rules to pass.
  if (auth.currentUser?.uid !== userId) {
    console.error('Mismatch between authenticated user and userId parameter. Aborting upload.');
    throw new Error('User authentication mismatch. Cannot upload image for another user.');
  }

  if (!userId) {
    console.error('UploadProfileImage: User ID parameter is required.');
    throw new Error('User ID parameter is required for image operations.');
  }
  
  if (existingImageUrl && typeof file === 'undefined') {
    // console.log(`UploadProfileImage: Attempting to delete image as file is undefined: ${existingImageUrl}`);
    try {
      const oldImageRef = ref(storage, existingImageUrl); 
      await deleteObject(oldImageRef);
      // console.log('UploadProfileImage: Image deleted successfully (called with undefined file).');
      return ""; 
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
        // console.warn('UploadProfileImage: Could not delete image (called with undefined file):', error.code, error.message);
        // Keep this console.error for actual deletion failures not related to object-not-found
        console.error('UploadProfileImage: Error deleting image (when file is undefined):', error);
        if (error instanceof StorageError) {
          throw new Error(`Image deletion failed: ${error.code} - ${error.message}`);
        } 
        throw new Error('Image deletion failed.');
      }
      // console.log('UploadProfileImage: Image not found for deletion (called with undefined file), nothing to delete.');
      return ""; 
    }
  }

  if (!file) {
    console.error('UploadProfileImage: File is required for uploading.');
    throw new Error('File is required for uploading.');
  }

  // console.log(`UploadProfileImage: Attempting to upload for userId: ${userId}, filename: ${file.name}`);

  if (existingImageUrl) {
    try {
      // console.log(`UploadProfileImage: Attempting to delete old image before new upload: ${existingImageUrl}`);
      const oldImageRef = ref(storage, existingImageUrl); 
      await deleteObject(oldImageRef);
      // console.log('UploadProfileImage: Old profile image deleted successfully before new upload.');
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
        // console.warn('UploadProfileImage: Could not delete old profile image (may not exist or other issue):', error.code, error.message);
      } else {
        // console.log('UploadProfileImage: Old profile image not found for deletion, nothing to delete.');
      }
    }
  }

  const filePath = `profile-images/${userId}/${Date.now()}-${file.name}`;
  const storageRefInstance = ref(storage, filePath); 

  try {
    // console.log(`UploadProfileImage: Uploading to path: ${filePath}`);
    const snapshot = await uploadBytes(storageRefInstance, file);
    // console.log('UploadProfileImage: Upload successful!', snapshot.metadata.fullPath);
    const downloadURL = await getDownloadURL(snapshot.ref);
    // console.log(`UploadProfileImage: Download URL: ${downloadURL}`);
    return downloadURL;
  } catch (error: any) { 
    console.error('UploadProfileImage: Detailed error during profile image upload:', error);
    if (error instanceof StorageError) { 
       throw new Error(`Image upload failed: ${error.code} - ${error.message}`);
    } else if (error instanceof Error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
    throw new Error('Image upload failed due to an unknown error. Please try again.');
  }
}
