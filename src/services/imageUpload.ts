
'use server';
/**
 * @fileOverview Service for uploading images to Firebase Storage.
 * - uploadProfileImage - Uploads a profile image and returns its download URL.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { firebaseConfig } from '@/lib/firebase'; // Import the actual config

// Ensure Firebase is initialized
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase App initialized in imageUpload.ts service.");
} else {
  app = getApps()[0];
  console.log("Firebase App already initialized in imageUpload.ts service.");
}

const storage = getStorage(app); // Get storage instance using the initialized app

/**
 * Uploads an image file to Firebase Storage and returns its public URL.
 * @param file The image file to upload.
 * @param userId The ID of the user, used for creating a unique path.
 * @param existingImageUrl Optional. If provided, the old image at this URL will be deleted.
 * @returns The public URL of the uploaded image.
 */
export async function uploadProfileImage(file: File, userId: string, existingImageUrl?: string | null): Promise<string> {
  if (!userId) {
    console.error('UploadProfileImage: User ID is required.');
    throw new Error('User ID is required for uploading profile image.');
  }
  if (!file) {
    console.error('UploadProfileImage: File is required.');
    throw new Error('File is required for uploading.');
  }

  console.log(`UploadProfileImage: Attempting to upload for userId: ${userId}, filename: ${file.name}`);

  // Optional: Delete the old image if it exists
  if (existingImageUrl) {
    try {
      console.log(`UploadProfileImage: Attempting to delete old image: ${existingImageUrl}`);
      const oldImageRef = ref(storage, existingImageUrl); // Use the storage instance from this module
      await deleteObject(oldImageRef);
      console.log('UploadProfileImage: Old profile image deleted successfully.');
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
        console.warn('UploadProfileImage: Could not delete old profile image (may not exist or other issue):', error.code, error.message);
      } else {
        console.log('UploadProfileImage: Old profile image not found, nothing to delete.');
      }
    }
  }

  const filePath = `profile-images/${userId}/${Date.now()}-${file.name}`;
  const storageRefInstance = ref(storage, filePath); // Use the storage instance from this module

  try {
    console.log(`UploadProfileImage: Uploading to path: ${filePath}`);
    const snapshot = await uploadBytes(storageRefInstance, file);
    console.log('UploadProfileImage: Upload successful!', snapshot.metadata.fullPath);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`UploadProfileImage: Download URL: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error('UploadProfileImage: Error uploading profile image:', error);
    // It's good to re-throw the original Firebase error or a more specific one
    // if (error instanceof FirebaseError) { // FirebaseError might not be directly available here without deeper imports
    //    throw new Error(`Image upload failed: ${error.code} - ${error.message}`);
    // }
    throw new Error('Image upload failed. Please try again.');
  }
}
