import { NextResponse } from 'next/server';
import { admin, adminAuth, adminFirestore } from '@/lib/firebaseAdmin'; // Updated import

// We will no longer use sendMessageToFirestore directly from messageService if it uses client SDK
// Instead, we'll use adminFirestore directly here.

export async function POST(request: Request) {
  console.log("Received request to /api/send-message");
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      console.error("Missing or malformed Authorization header");
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed token' }, { status: 401 });
    }

    const idToken = authorizationHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      console.log("Attempting to verify ID token...");
      decodedToken = await adminAuth.verifyIdToken(idToken);
      console.log("ID token verified successfully. User UID:", decodedToken.uid);
    } catch (error: any) {
      console.error("Error verifying ID token:", error.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid token', details: error.message }, { status: 401 });
    }

    const senderId = decodedToken.uid; // Use UID from verified token as senderId

    const body = await request.json();
    console.log("Request body:", body);
    const { recipientId, content, recipientName } = body; // senderName and senderId are no longer taken from body for security

    // It's good practice to fetch/validate recipientName and senderName from your database
    // using recipientId and senderId (decodedToken.uid) respectively if needed for the message document.
    // For now, we'll proceed with what the client sent for recipientName, and
    // you might want to add a senderName field by fetching user profile with senderId.

    if (!recipientId || !content) {
      console.error("Missing recipientId or content in request body");
      return NextResponse.json({ error: 'Missing required fields: recipientId and content are required.' }, { status: 400 });
    }

    // Optional: Fetch sender's name from your user profiles collection if you store it
    // const senderProfile = await adminFirestore.collection('users').doc(senderId).get();
    // const senderName = senderProfile.exists ? senderProfile.data()?.name : 'Unknown User';
    // If not fetching, ensure your client isn't expecting senderName to be magically populated by backend
    // if it's not explicitly being added to the message object below.
    // The NewMessageForm sends senderName, but we've chosen not to use it directly from the body
    // to emphasize that senderId comes from the token. You can decide how to handle senderName.
    // For simplicity, we will assume senderName is passed in the body for now for display purposes,
    // but acknowledge it's not from a trusted source like the token.
    const senderNameFromBody = body.senderName || "Anonymous"; // Fallback if not provided or use fetched one

    const messageData = {
      senderId, // Securely set from token
      recipientId,
      content,
      senderName: senderNameFromBody, // Or use fetched senderName
      recipientName: recipientName || "Unknown Recipient", // Fallback for recipientName
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
      read: false, // Default read status
      conversationId: [senderId, recipientId].sort().join('_') // Consistent conversation ID
    };

    console.log("Attempting to send message to Firestore with Admin SDK:", messageData);
    const messageRef = await adminFirestore.collection('messages').add(messageData);
    console.log("Message sent successfully with Admin SDK. Message ID:", messageRef.id);

    return NextResponse.json({ message: 'Message sent successfully', messageId: messageRef.id }, { status: 201 });

  } catch (error: any) {
    console.error('Error in /api/send-message:', error.stack || error.message); // Log stack for more details
    return NextResponse.json({ error: 'Failed to send message', details: error.message }, { status: 500 });
  }
}
