
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Renaming component for better clarity if this is the intended page.
// If this page was meant to be the full chat UI, its content would need to be replaced.
export default function ConversationDebugPage() {
  const params = useParams();
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pageState, setPageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [internalLog, setInternalLog] = useState<string[]>([]);

  const addLog = (log: string) => setInternalLog(prev => [...prev, `${new Date().toISOString()}: ${log}`]);

  useEffect(() => {
    addLog("ConversationDebugPage useEffect[params]: Triggered");
    if (params && params.conversationId) {
      const idFromParams = params.conversationId as string;
      addLog(`ConversationDebugPage useEffect[params]: conversationId from params: ${idFromParams}`);
      setConversationId(idFromParams);
      setPageState('loaded');
    } else {
      addLog("ConversationDebugPage useEffect[params]: No conversationId in params");
      setErrorMessage("Conversation ID not found in URL.");
      setPageState('error');
    }
  }, [params]);

  if (pageState === 'loading') {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Loading Conversation (Debug)...</h1>
        <p>Attempting to extract conversation ID using only useParams and useRouter.</p>
        <pre style={{ background: '#eee', padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
          {internalLog.join('\n')}
        </pre>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Error (Debug Page)</h1>
        <p style={{ color: 'red' }}>{errorMessage}</p>
        <button onClick={() => router.back()}>Back (using useRouter)</button>
        <pre style={{ background: '#eee', padding: '10px', maxHeight: '300px', overflowY: 'auto', marginTop: '10px' }}>
          {internalLog.join('\n')}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Conversation Debug Page</h1>
      <button onClick={() => router.back()} style={{ marginBottom: '20px' }}>Back (using useRouter)</button>
      <p>Conversation ID from URL: {conversationId}</p>
      <h2>Internal Log:</h2>
      <pre style={{ background: '#eee', padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
        {internalLog.join('\n')}
      </pre>
    </div>
  );
}
