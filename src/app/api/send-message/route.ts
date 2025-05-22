import { NextResponse } from 'next/server';
import { sendMessageToFirestore } from '@/lib/messageService';
// import { auth } from '@/lib/firebase'; // Firebase client auth is not for backend verification
// For proper backend auth, you would use Firebase Admin SDK to verify a token
// or another session management strategy.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { senderId, recipientId, content, senderName, recipientName } = body;

    if (!senderId || !recipientId || !content || !senderName || !recipientName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // **SECURITY NOTE:** In a real application, you MUST verify that the senderId
    // matches the authenticated user making the request. 
    // This often involves the client sending an ID token, which is verified here
    // using Firebase Admin SDK.
    // For this example, we are proceeding with the client-provided senderId.

    const messageId = await sendMessageToFirestore(
      senderId,
      recipientId,
      content,
      senderName,
      recipientName
    );

    return NextResponse.json({ message: 'Message sent successfully', messageId }, { status: 201 });
  } catch (error: any) {
    console.error('Error in /api/send-message:', error);
    return NextResponse.json({ error: 'Failed to send message', details: error.message }, { status: 500 });
  }
}
