// src/app/dashboard/admin/messages/[conversationId]/page.tsx
import AdminConversationThreadClient from './conversation-thread-client';

export default function AdminConversationPage({ params }: { params: { conversationId: string } }) {
  return <AdminConversationThreadClient conversationId={params.conversationId} />;
}
