import { NextResponse } from 'next/server';
import { admin, adminAuth, adminFirestore } from '@/lib/firebaseAdmin';

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
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error: any) {
      console.error("Error verifying ID token:", error.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid token', details: error.message }, { status: 401 });
    }

    const senderId = decodedToken.uid;
    const body = await request.json();
    const { recipientId, content, recipientName } = body;

    if (!recipientId || !content) {
      console.error("Missing recipientId or content in request body");
      return NextResponse.json({ error: 'Missing required fields: recipientId and content are required.' }, { status: 400 });
    }

    // Fetch sender's name, checking both 'coachProfiles' and 'users' collections
    let senderName = 'Unknown User'; // Default sender name
    try {
      // 1. Check coachProfiles collection first
      const coachProfileDoc = await adminFirestore.collection('coachProfiles').doc(senderId).get();
      if (coachProfileDoc.exists && coachProfileDoc.data()?.name) {
        senderName = coachProfileDoc.data()?.name;
        console.log(`Sender name found in 'coachProfiles': ${senderName}`);
      } else {
        // 2. If not in coachProfiles or no name there, check users collection
        console.log(`Sender ID ${senderId} not found in 'coachProfiles' with a name, checking 'users' collection.`);
        const userProfileDoc = await adminFirestore.collection('users').doc(senderId).get();
        if (userProfileDoc.exists && userProfileDoc.data()?.name) {
          senderName = userProfileDoc.data()?.name;
          console.log(`Sender name found in 'users': ${senderName}`);
        } else {
          console.warn(`Sender profile not found or name missing in both 'coachProfiles' and 'users' for UID: ${senderId}. Using default: '${senderName}'.`);
        }
      }
    } catch (dbError: any) {
      console.error(`Error fetching sender profile for UID ${senderId}:`, dbError.message);
      // Keep default 'Unknown User' or handle error as appropriate
    }

    const messageData = {
      senderId,
      recipientId,
      content,
      senderName, // Use the determined senderName
      recipientName: recipientName || "Unknown Recipient",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      conversationId: [senderId, recipientId].sort().join('_')
    };

    console.log("Attempting to send message to Firestore with Admin SDK:", messageData);
    const messageRef = await adminFirestore.collection('messages').add(messageData);
    console.log("Message sent successfully. Message ID:", messageRef.id);

    return NextResponse.json({ message: 'Message sent successfully', messageId: messageRef.id }, { status: 201 });

  } catch (error: any) {
    console.error('Error in /api/send-message:', error.stack || error.message);
    return NextResponse.json({ error: 'Failed to send message', details: error.message }, { status: 500 });
  }
}
