// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

// --- DIAGNOSTIC LOGGING ---
// This code will run when the server starts or when an API route is first hit.
console.log('--- [firebaseAdmin.ts] Diagnostic Check ---');
console.log(`Value for FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID}`);
console.log(`Value for FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL}`);
const privateKeyExists = !!process.env.FIREBASE_PRIVATE_KEY;
console.log(`Does FIREBASE_PRIVATE_KEY exist?: ${privateKeyExists}`);
console.log('------------------------------------------');
// --- END DIAGNOSTIC LOGGING ---

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('One or more required Firebase Admin SDK environment variables were not found.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });

    console.log('[firebaseAdmin] Firebase Admin SDK initialized successfully.');

  } catch (error: any) {
    console.error('[firebaseAdmin] CRITICAL ERROR: Failed to initialize Firebase Admin SDK.', {
      message: error.message,
    });
  }
}

export { admin };

