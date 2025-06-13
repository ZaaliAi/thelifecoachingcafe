import { getAuth } from 'firebase-admin/auth';
import { adminApp } from './firebaseAdmin';

// Initialize the Firebase Admin SDK if it hasn't been already.
if (!adminApp) {
  console.error("Firebase Admin SDK has not been initialized.");
}

/**
 * Sends a welcome email to a new coach.
 * @param email The email address of the new coach.
 * @param name The name of the new coach.
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!email || !name) {
    throw new Error("Email and name are required to send a welcome email.");
  }

  try {
    const auth = getAuth(adminApp);
    // Generate a password reset link that can be used as a "set your password" link
    const link = await auth.generateEmailVerificationLink(email);

    // TODO: Implement a proper email sending service like SendGrid, Mailgun, or Resend.
    // For now, we will log the email to the console.
    console.log(`
      --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---
      ---                                                               ---
      ---             New Coach Welcome Email (Simulation)              ---
      ---                                                               ---
      --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---
      To: ${email}
      Subject: Welcome to the Platform, ${name}!

      Hi ${name},

      Welcome to the platform! We're excited to have you on board.

      To get started, please verify your email address by clicking the link below:
      ${link}

      We're looking forward to seeing you help our users achieve their goals!

      Best,
      The Team
    `);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw new Error("Could not send welcome email.");
  }
}
