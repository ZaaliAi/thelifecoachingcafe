"use client";

import { useEffect, useState } from "react";
import { fetchReceivedMessages } from "@/lib/messageService";
import type { Message } from "@/types";
import { useAuth } from "@/lib/auth";
import Link from 'next/link';

export default function UserMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && !authLoading) {
      const loadMessages = async () => {
        setIsLoading(true);
        try {
          const data = await fetchReceivedMessages(); 
          console.log("Fetched messages:", JSON.stringify(data, null, 2)); // Keep this for your debugging
          if (Array.isArray(data)) {
            setMessages(data);
          } else {
            console.error("fetchReceivedMessages did not return an array:", data);
            setMessages([]);
          }
        } catch (error) {
          console.error("Failed to load messages:", error);
          setMessages([]); 
        } finally {
          setIsLoading(false);
        }
      };
      loadMessages();
    } else if (!authLoading) {
      setMessages([]);
      setIsLoading(false);
    }
  }, [user, authLoading]);

  if (authLoading || (isLoading && user)) {
    return (
      <div className="container mx-auto p-4 text-center">
        Loading messages...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        Please log in to see your messages.
      </div>
    );
  }

  const conversations = messages.reduce((acc, message) => {
    // Ensure message and message.conversationId are valid before using
    if (message && message.conversationId) {
      if (!acc[message.conversationId] || new Date(message.timestamp) > new Date(acc[message.conversationId].timestamp)) {
        acc[message.conversationId] = message;
      }
    } else { // Corrected line
      console.warn("Message found with missing or invalid conversationId:", message);
    }
    return acc;
  }, {} as Record<string, Message>);

  const conversationList = Object.values(conversations).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Filter out conversations with undefined, null, or empty string conversationId
  const validConversationList = conversationList.filter(
    (msg) => msg.conversationId && String(msg.conversationId).trim() !== ""
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center sm:text-left">Your Inbox</h1>
      {messages.length === 0 ? (
        <p className="text-center text-gray-500">You have no messages.</p>
      ) : validConversationList.length === 0 && messages.length > 0 ? (
        <p className="text-center text-gray-500">You have messages, but there was an issue displaying conversations. Please check console logs.</p>
      ) : (
        <ul className="space-y-3">
          {validConversationList.map((latestMessage) => (
            <li key={latestMessage.id}> 
              <Link href={`/dashboard/messages/${latestMessage.conversationId}`} className="block p-4 border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-gray-700">
                    <strong>From:</strong> {latestMessage.senderName || latestMessage.senderId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {latestMessage.timestamp ? new Date(latestMessage.timestamp).toLocaleString() : 'Date not available'}
                  </p>
                </div>
                <p className="text-gray-800">
                  {latestMessage.content}
                </p>
              </Link>
            </li>
          ))} 
        </ul>
      )}
    </div>
  );
}
