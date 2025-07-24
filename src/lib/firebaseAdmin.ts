import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin SDK environment variables.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[firebaseAdmin] Initialized');
    }

  } catch (error: any) {
    console.error('[firebaseAdmin] Failed to initialize Firebase Admin SDK.', {
      message: error.message,
    });
  }
}

const adminAuth = admin.auth();
const adminFirestore = admin.firestore();

export { admin, adminAuth, adminFirestore };
