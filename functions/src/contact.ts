import * as functions from 'firebase-functions';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as nodemailer from 'nodemailer';

// Define the expected data structure for the contact form
interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Define the HTTPS Callable function
export const sendContactMessage = functions.https.onCall(
  async (request: CallableRequest<ContactFormData>) => {
    // Validate input data
    if (
      !request.data.name ||
      !request.data.email ||
      !request.data.subject ||
      !request.data.message
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Missing required contact form fields.'
      );
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.data.email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format.');
    }

    // Get SMTP configuration from environment variables
    const smtpConfig = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        secure: process.env.SMTP_SECURE,
    };
    if (
      !process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS
    ) {
      console.error('SMTP configuration is missing or incomplete.');
      throw new HttpsError(
        'internal',
        'The server is not configured to send emails.'
      );
    }

    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT!, 10), // Ensure port is a number
      secure: smtpConfig.secure === 'true', // Secure flag needs boolean
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Define email options
    const mailOptions = {
      from: smtpConfig.user, // Sender address
      to: 'hello@thelifecoachingcafe.com', // Recipient address
      subject: `Contact Form: ${request.data.subject}`, // Subject line
      text: `
        Name: ${request.data.name}
        Email: ${request.data.email}
        Subject: ${request.data.subject}
        Message: ${request.data.message}
      `, // Plain text body
      html: `
        <p><strong>Name:</strong> ${request.data.name}</p>
        <p><strong>Email:</strong> ${request.data.email}</p>
        <p><strong>Subject:</strong> ${request.data.subject}</p>
        <p><strong>Message:</strong><br/>${request.data.message.replace(/\n/g, '<br/>')}</p>
      `, // HTML body
    };

    // Send the email
    try {
      await transporter.sendMail(mailOptions);
      console.log('Contact form email sent successfully.');
      return { success: true };
    } catch (error) {
      console.error('Error sending contact form email:', error);
      throw new HttpsError('internal', 'Failed to send contact message.');
    }
  }
);
