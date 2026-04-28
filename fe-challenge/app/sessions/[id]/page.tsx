"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { fetchSession, streamAssistantResponse } from "@/domain/api";
import type { Message } from "@/domain/types";

function TypingIndicator() {
  return (
    <div className="flex items-center space-x-2 p-2">
      <div className="flex space-x-1">
        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
      </div>
      <span className="text-sm text-gray-500">AI is thinking...</span>
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["session", id],
    queryFn: () => fetchSession(id),
    retry: 1,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, streamContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamContent("");
    setError(null);

    try {
      const generator = streamAssistantResponse(id, userMessage);
      for await (const msg of generator) {
        setStreamContent(msg.content);
      }
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      Sentry.captureException(err);
    } finally {
      setIsStreaming(false);
      setStreamContent("");
    }
  }, [input, isStreaming, id, queryClient]);

  const allMessages = session?.messages ?? [];
  const displayMessages: Message[] =
    isStreaming && streamContent
      ? [
          ...allMessages,
          {
            id: "streaming",
            sessionId: id,
            role: "assistant",
            content: streamContent,
            timestamp: new Date(),
          },
        ]
      : allMessages;

  if (isLoading) return <div className="p-4">Loading session...</div>;
  if (isError || !session) return <div className="p-4 text-red-500">Session not found.</div>;

  return (
    <main className="max-w-3xl mx-auto p-4 flex flex-col h-screen">
      <h1 className="text-xl font-bold mb-4">{session.title}</h1>

      <div className="flex-1 overflow-y-auto border rounded p-4 mb-4 bg-gray-50">
        {displayMessages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}
          >
            <div
              className={`inline-block max-w-[80%] p-3 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white border text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isStreaming && !streamContent && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 border rounded p-2 text-black"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isStreaming ? "Streaming..." : "Send"}
        </button>
      </div>
    </main>
  );
}