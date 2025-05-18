"use client";

import { useEffect, useState } from "react";
import { fetchReceivedMessages } from "@/lib/messageService";
import type { Message } from "@/types";
import { useAuth } from "@/lib/auth";

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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center sm:text-left">Your Inbox</h1>
      {messages.length === 0 ? (
        <p className="text-center text-gray-500">You have no messages.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((msg) => (
            <li key={msg.id} className="p-4 border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm text-gray-700">
                  <strong>From:</strong> {msg.senderName || msg.senderId} 
                </p>
                <p className="text-xs text-gray-500">
                  {/* Ensure timestamp is correctly formatted. Your Message type uses string (ISO) */}
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Date not available'}
                </p>
              </div>
              <p className="text-gray-800">
                {msg.content} {/* Corrected from msg.text */}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
