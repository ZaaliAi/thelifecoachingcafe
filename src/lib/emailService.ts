import { sendEmail } from './sendEmail';

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!email || !name) {
    throw new Error("Email and name are required to send a welcome email.");
  }

  const subject = `Welcome to the Platform, ${name}!`;
  const html = `
    <p>Hi ${name},</p>
    <p>Welcome to the platform! We're excited to have you on board. Your profile is live and you can now be discovered by potential clients.</p>
    <p><b>Ready to stand out?</b> Upgrade to our Premium plan to unlock powerful features:</p>
    <ul>
      <li><b>Profile Picture:</b> Add a personal touch and let clients see who you are.</li>
      <li><b>Premium Badge:</b> Get recognized with a special badge on your profile.</li>
      <li><b>Website & Social Media Links:</b> Drive traffic to your personal brand.</li>
      <li><b>Embed Videos:</b> Share your message and coaching style with an intro video.</li>
    </ul>
    <p>You can upgrade at any time from your coach dashboard.</p>
    <p>We're looking forward to seeing you help our users achieve their goals!</p>
    <p>Best,<br>The Team</p>
  `;

  await sendEmail({ to: email, subject, html });
}
