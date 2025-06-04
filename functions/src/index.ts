// v1 import for auth and onCall triggers
import * as functions from 'firebase-functions';
// v2 imports for new Firestore and HTTPS triggers
import { onDocumentCreated, onDocumentWritten, FirestoreEvent, Change, DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-functions/v2/firestore';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
// import { onUserCreate, AuthEvent } from "firebase-functions/v2/identity"; // Removed for now
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin if needed
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// --- Helper for SMTP configuration ---
function getSmtpTransporter() {
  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };

  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    functions.logger.error('SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS) is missing or incomplete in env variables.');
    throw new Error('SMTP configuration missing.');
  }

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
}

// --- Suspend User (Callable, v1) ---
export const suspendUser = functions.https.onCall(async (request: CallableRequest<{ userId: string }>) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'The request is not authenticated.');
  }

  const callerUid = request.auth.uid;
  const callerUser = await admin.auth().getUser(callerUid);

  if (!callerUser.customClaims || !callerUser.customClaims.admin) {
    throw new HttpsError('permission-denied', 'Only admin users can suspend accounts.');
  }

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError('invalid-argument', 'User ID is required to suspend an account.');
  }

  functions.logger.log(`Attempting to suspend user: ${userId} by admin: ${callerUid}`);

  try {
    await admin.auth().updateUser(userId, { disabled: true });
    functions.logger.log(`Successfully disabled user ${userId}.`);
    await firestore.collection('users').doc(userId).update({ status: 'suspended' });
    functions.logger.log(`Updated Firestore status to 'suspended' for user ${userId}.`);
    return { message: `User ${userId} has been suspended.` };
  } catch (error: any) {
    functions.logger.error(`Error suspending user ${userId}:`, error);
    if (error.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'The target user was not found in Firebase Authentication.');
    } else if (error.code === 'auth/invalid-uid') {
      throw new HttpsError('invalid-argument', 'The provided user ID is invalid.');
    }
    throw new HttpsError('internal', `Failed to suspend user: ${error.message || 'An unknown error occurred.'}`);
  }
});

// --- Unsuspend User (Callable, v1) ---
export const unsuspendUser = functions.https.onCall(async (request: CallableRequest<{ userId: string }>) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'The request is not authenticated.');
  }

  const callerUid = request.auth.uid;
  const callerUser = await admin.auth().getUser(callerUid);

  if (!callerUser.customClaims || !callerUser.customClaims.admin) {
    throw new HttpsError('permission-denied', 'Only admin users can unsuspend accounts.');
  }

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError('invalid-argument', 'User ID is required to unsuspend an account.');
  }

  functions.logger.log(`Attempting to unsuspend user: ${userId} by admin: ${callerUid}`);

  try {
    await admin.auth().updateUser(userId, { disabled: false });
    functions.logger.log(`Successfully enabled user ${userId}.`);
    await firestore.collection('users').doc(userId).update({ status: 'active' });
    functions.logger.log(`Updated Firestore status to 'active' for user ${userId}.`);
    return { message: `User ${userId} has been unsuspended.` };
  } catch (error: any) {
    functions.logger.error(`Error unsuspending user ${userId}:`, error);
    if (error.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'The target user was not found in Firebase Authentication.');
    } else if (error.code === 'auth/invalid-uid') {
      throw new HttpsError('invalid-argument', 'The provided user ID is invalid.');
    }
    throw new HttpsError('internal', `Failed to unsuspend user: ${error.message || 'An unknown error occurred.'}`);
  }
});

// --- User Signs Up - Standard Welcome Email (REMOVED FOR NOW) ---
// export const onUserSignupWelcomeEmail = onUserCreate( 
//   async (event: AuthEvent<admin.auth.UserRecord>) => {
//     const user = event.data; 
//     const userEmail = user.email;
//     let displayName = user.displayName || user.email?.split('@')[0] || 'there';

//     if (!userEmail) {
//       functions.logger.warn('User signed up without an email address, skipping welcome email.');
//       return null;
//     }

//     try {
//       const userProfileDoc = await firestore.collection('users').doc(user.uid).get();
//       if (userProfileDoc.exists) {
//         const userProfileData = userProfileDoc.data();
//         if (userProfileData && userProfileData.name) {
//           displayName = userProfileData.name;
//         }
//       }

//       const transporter = getSmtpTransporter();
//       const mailOptions = {
//         from: process.env.SMTP_USER,
//         to: userEmail,
//         subject: 'Welcome to The Life Coaching Cafe!',
//         html: `
//           <p>Hi ${displayName},</p>
//           <p>Welcome to The Life Coaching Cafe! We're thrilled to have you join our community.</p>
//           <p>Explore our coaches, read insightful blog posts, and start your journey towards personal growth.</p>
//           <p>Get started here: <a href="https://coachconnect-897af.web.app">Your Website Link</a></p>
//           <p>Best regards,</p>
//           <p>The Life Coaching Cafe Team</p>
//         `,
//       };
//       await transporter.sendMail(mailOptions);
//       functions.logger.log('Standard welcome email sent to new user: ' + userEmail);
//     } catch (error) {
//       functions.logger.error(`Error sending welcome email to ${userEmail}:`, error);
//     }
//     return null;
//   }
// );

// --- Coach Signs Up - Welcome Email (In Review, Firestore v2) ---
export const onCoachSignupReviewEmail = onDocumentWritten(
  'users/{userId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => {
    const beforeData = (event.data?.before as QueryDocumentSnapshot | undefined)?.data();
    const afterData = (event.data?.after as QueryDocumentSnapshot | undefined)?.data();
    const userId = event.params.userId;

    if (!afterData) {
      functions.logger.log('No afterData for user document update, skipping coach review email for userId:', userId);
      return null;
    }

    const isNowCoachPending = afterData.role === 'coach' && afterData.status === 'pending';
    const wasNotCoachPending = !beforeData || beforeData.role !== 'coach' || beforeData.status !== 'pending';

    if (!isNowCoachPending || !wasNotCoachPending) {
      functions.logger.log('Coach review status not met or no change for userId:', userId);
      return null;
    }

    const coachEmail = afterData.email;
    const coachName = afterData.name || coachEmail?.split('@')[0] || 'there';

    if (!coachEmail) {
      functions.logger.warn('Coach user email not found for userId:', userId, 'skipping review email.');
      return null;
    }

    try {
      const transporter = getSmtpTransporter();
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: coachEmail,
        subject: 'Welcome to The Life Coaching Cafe! Your Coach Account is Under Review',
        html: `
          <p>Hi ${coachName},</p>
          <p>Thank you for registering as a coach with The Life Coaching Cafe! We're excited to review your application.</p>
          <p>Your account is currently under review and should be live within <b>24 hours</b> after our team has had a chance to verify your details.</p>
          <p>We'll send you another email as soon as your profile is active.</p>
          <p>Best regards,</p>
          <p>The Life Coaching Cafe Team</p>
        `,
      };
      await transporter.sendMail(mailOptions);
      functions.logger.log('Coach review email sent to: ' + coachEmail);
    } catch (error) {
      functions.logger.error(`Error sending coach review email to ${coachEmail}:`, error);
    }
    return null;
  }
);

// --- Blog Pending Review Email (Firestore v2) ---
export const onBlogPostPendingEmail = onDocumentWritten(
  'blogs/{blogId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { blogId: string }>) => {
    const beforeData = (event.data?.before as QueryDocumentSnapshot | undefined)?.data();
    const afterData = (event.data?.after as QueryDocumentSnapshot | undefined)?.data();
    const blogId = event.params.blogId;

    if (!afterData) {
      functions.logger.log('No afterData for blog document update, skipping blog pending email for blogId:', blogId);
      return null;
    }

    const isNowPending = afterData.status === 'pending';
    const wasNotCoachPending = !beforeData || beforeData.status !== 'pending'; // Corrected variable name

    if (!isNowPending || !wasNotCoachPending) { // Corrected variable name
      functions.logger.log('Blog pending status not met or no change for blogId:', blogId);
      return null;
    }

    const authorId = afterData.authorId;
    const blogTitle = afterData.title || 'Your latest blog post';
    const authorName = afterData.authorName || 'Coach';

    if (!authorId) {
      functions.logger.warn(`Blog ${blogId} is pending but author ID not found, skipping email.`);
      return null;
    }

    let authorEmail: string | undefined;
    try {
      const authorDoc = await firestore.collection('users').doc(authorId).get();
      if (authorDoc.exists) {
        authorEmail = authorDoc.data()?.email;
      }
    } catch (error) {
      functions.logger.error(`Error fetching author email for blog ${blogId}:`, error);
    }

    if (!authorEmail) {
      functions.logger.warn(`Blog ${blogId} is pending but author email not found for authorId: ${authorId}, skipping email.`);
      return null;
    }

    try {
      const transporter = getSmtpTransporter();
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: authorEmail,
        subject: 'Your Blog Post is Under Review at The Life Coaching Cafe',
        html: `
          <p>Hi ${authorName},</p>
          <p>We've received your blog post titled "${blogTitle}" and it's currently under review.</p>
          <p>Our team will review it shortly, and it should be live on the site within <b>24 hours</b>.</p>
          <p>Thank you for contributing to our community!</p>
          <p>Best regards,</p>
          <p>The Life Coaching Cafe Team</p>
        `,
      };
      await transporter.sendMail(mailOptions);
      functions.logger.log('Blog pending email sent to: ' + authorEmail);
    } catch (error) {
      functions.logger.error(`Error sending pending blog email to ${authorEmail}:`, error);
    }
    return null;
  }
);

// --- Blog Approval Email (Firestore v2) ---
export const onBlogPostApproved = onDocumentWritten(
  'blogs/{blogId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { blogId: string }>) => {
    const beforeData = (event.data?.before as QueryDocumentSnapshot | undefined)?.data();
    const afterData = (event.data?.after as QueryDocumentSnapshot | undefined)?.data();
    const blogId = event.params.blogId;

    if (!afterData || !beforeData) {
      functions.logger.log('No beforeData or afterData for blog document, skipping blog approval email for blogId:', blogId);
      return null;
    }

    const isNowApproved = afterData.status === 'approved' || afterData.status === 'published';
    const wasNotApproved = beforeData.status !== 'approved' && beforeData.status !== 'published';

    if (!isNowApproved || !wasNotApproved) {
      functions.logger.log('Blog approval status not met or no change for blogId:', blogId);
      return null;
    }

    const authorId = afterData.authorId;
    const blogTitle = afterData.title || 'Your blog post';
    const authorName = afterData.authorName || 'Coach';
    const blogLink = `https://coachconnect-897af.web.app/blog/${afterData.slug}`;

    if (!authorId) {
      functions.logger.warn(`Blog ${blogId} approved but author ID not found, skipping email.`);
      return null;
    }

    let authorEmail: string | undefined;
    try {
      const authorDoc = await firestore.collection('users').doc(authorId).get();
      if (authorDoc.exists) {
        authorEmail = authorDoc.data()?.email;
      }
    } catch (error) {
      functions.logger.error(`Error fetching author email for approved blog ${blogId}:`, error);
    }

    if (!authorEmail) {
      functions.logger.warn(`Blog ${blogId} approved but author email not found for authorId: ${authorId}, skipping email.`);
      return null;
    }

    try {
      const transporter = getSmtpTransporter();
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: authorEmail,
        subject: 'Great News! Your Blog Post Has Been Approved!',
        html: `
          <p>Hi ${authorName},</p>
          <p>We're excited to let you know that your blog post, "${blogTitle}", has been <b>approved</b> and is now live on The Life Coaching Cafe!</p>
          <p>You can view it here: <a href="${blogLink}">${blogLink}</a></p>
          <p>Thank you for your valuable contribution!</p>
          <p>Best regards,</p>
          <p>The Life Coaching Cafe Team</p>
        `,
      };
      await transporter.sendMail(mailOptions);
      functions.logger.log('Blog approval email sent to: ' + authorEmail);
    } catch (error) {
      functions.logger.error(`Error sending blog approval email to ${authorEmail}:`, error);
    }
    return null;
  }
);

// --- New Message Notification (Firestore v2) ---
export const sendNewMessageNotification = onDocumentCreated(
  'messages/{messageId}',
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    const snap = event.data;
    if (!snap) {
      functions.logger.log('No data associated with the message creation event for event ID:', event.id);
      return;
    }
    const messageData = snap.data();
    const messageId = snap.id;
    if (!messageData) {
      functions.logger.log('Message data is empty for messageId: ' + messageId);
      return;
    }

    const senderName = messageData.senderName || 'A user';
    const recipientId = messageData.recipientId;
    let recipientNameForEmail = messageData.recipientName || 'User';

    if (!recipientId) {
      functions.logger.error('Recipient ID is missing in the message data for messageId: ' + messageId, messageData);
      return;
    }

    let recipientEmail: string | undefined;
    try {
      const userProfileDoc = await firestore.collection('users').doc(recipientId).get();
      if (userProfileDoc.exists) {
        const userProfileData = userProfileDoc.data();
        if (userProfileData) {
          recipientEmail = userProfileData.email;
          recipientNameForEmail = userProfileData.name || userProfileData.displayName || recipientNameForEmail;
        } else {
          functions.logger.error('User profile data is undefined for recipient ID: ' + recipientId);
          return;
        }
      } else {
        functions.logger.error('Recipient profile not found for ID: ' + recipientId);
        return;
      }
    } catch (error) {
      functions.logger.error('Error fetching recipient profile for ID ' + recipientId + ':', error);
      return;
    }

    if (!recipientEmail) {
      functions.logger.error('Email not found for recipient ID: ' + recipientId + '. Cannot send notification.');
      return;
    }

    try {
      const transporter = getSmtpTransporter();
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: recipientEmail,
        subject: 'You have received a new message from ' + senderName,
        text: `Hi ${recipientNameForEmail},

You have a new message from ${senderName}.
Log in to view the full message on The Life Coaching Cafe.

Thanks,
The Life Coaching Cafe Team`,
      };
      await transporter.sendMail(mailOptions);
      functions.logger.log('New message notification email sent to ' + recipientEmail + ' for message ' + messageId);
    } catch (error) {
      functions.logger.error('Error sending new message notification email via nodemailer for messageId: ' + messageId, error);
    }
  }
);

// --- User Approval Email (Firestore v2) ---
export const onUserApproved = onDocumentWritten(
  'users/{userId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => {
    if (!event || !event.data) {
      functions.logger.log('No data associated with the user approval event:', event.id);
      return;
    }
    const beforeData = (event.data.before as QueryDocumentSnapshot | undefined)?.data();
    const afterData = (event.data.after as QueryDocumentSnapshot | undefined)?.data();
    const userId = event.params.userId;

    const wasJustApproved =
      afterData && afterData.status === 'approved' && (!beforeData || beforeData.status !== 'approved');

    if (!wasJustApproved) {
      functions.logger.log('User approval status not met or no change for userId:', userId);
      return;
    }

    if (!afterData) {
      functions.logger.error('afterData is undefined for userId:', userId);
      return;
    }

    const userName = afterData.name || afterData.email?.split('@')[0] || 'User';
    const userEmail = afterData.email;
    if (!userEmail) {
      functions.logger.error('User email not found for approved user userId:', userId);
      return;
    }

    functions.logger.log('User ' + userId + ' approved, attempting to send email to: ' + userEmail);

    try {
      const transporter = getSmtpTransporter();
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: userEmail,
        subject: 'Your account for The Life Coaching Cafe is Approved',
        text: `Hi ${userName},

Your account has been approved and live on The Life Coaching Cafe.
Thank you for joining us.
Kind Regards

The Life Coaching Cafe Team`,
      };
      await transporter.sendMail(mailOptions);
      functions.logger.log('User approval email sent to: ' + userEmail + ' for userId: ' + userId);
    } catch (error) {
      functions.logger.error('Error sending user approval email for userId: ' + userId, error);
    }
  }
);

// --- User Suspension Email (Firestore v2) ---
export const onUserSuspensionEmail = onDocumentWritten(
  'users/{userId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => {
    const beforeData = (event.data?.before as QueryDocumentSnapshot | undefined)?.data();
    const afterData = (event.data?.after as QueryDocumentSnapshot | undefined)?.data();
    const userId = event.params.userId;

    if (!afterData || !beforeData) {
      functions.logger.log('No beforeData or afterData for user document, skipping suspension email for userId:', userId);
      return null;
    }

    const isNowSuspended = afterData.status === 'suspended';
    const wasNotSuspended = beforeData.status !== 'suspended';

    if (!isNowSuspended || !wasNotSuspended) {
      functions.logger.log('User suspension status not met or no change for userId:', userId);
      return null;
    }

    const userEmail = afterData.email;
    const userName = afterData.name || afterData.email?.split('@')[0] || 'User';
    const contactEmail = 'hello@thelifecoachingcafe.com';

    if (!userEmail) {
      functions.logger.warn(`User ${userId} suspended but email not found, skipping email.`);
      return null;
    }

    try {
      const transporter = getSmtpTransporter();
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: userEmail,
        subject: 'Important: Your Account at The Life Coaching Cafe Has Been Suspended',
        html: `
          <p>Hi ${userName},</p>
          <p>We regret to inform you that your account at The Life Coaching Cafe has been <b>suspended</b>.</p>
          <p>This action may have been taken due to a violation of our terms of service or other policy reasons.</p>
          <p>For more information regarding your account status, please contact us directly at: <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>
          <p>Thank you for your understanding.</p>
          <p>The Life Coaching Cafe Team</p>
        `,
      };
      await transporter.sendMail(mailOptions);
      functions.logger.log('User suspension email sent to: ' + userEmail);
    } catch (error) {
      functions.logger.error(`Error sending user suspension email to ${userEmail}:`, error);
    }
    return null;
  }
);

// Optionally re-export other modules
export * from './stripe';
export * from './contact';