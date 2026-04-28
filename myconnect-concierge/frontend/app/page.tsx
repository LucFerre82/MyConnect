"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Attendee {
  id: string;
  name: string;
  headline: string;
  bio: string;
  company?: string;
  role?: string;
  skills: string[];
  lookingFor: string;
  openToChat: boolean;
}

interface Event {
  id: string;
  title: string;
  dates: string;
  location: string;
}

interface ToolResult {
  name: string;
  args: any;
  result: any;
}

interface ConciergeResponse {
  message: string;
  matches: Match[];
  toolCalls: ToolResult[];
}

interface Match {
  id: string;
  name: string;
  headline: string;
  score: number;
  rationale: string;
  shared_ground: string[];
  introMessage?: string;
}

const fetchEvents = async (): Promise<Event[]> => {
  const res = await fetch(`${API_URL}/events`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
};

const fetchAttendees = async (eventId: string): Promise<Attendee[]> => {
  const res = await fetch(`${API_URL}/events/${eventId}/attendees`);
  if (!res.ok) throw new Error("Failed to fetch attendees");
  return res.json();
};

const sendMessage = async (
  eventId: string,
  attendeeId: string,
  message: string
): Promise<ConciergeResponse> => {
  const res = await fetch(`${API_URL}/events/${eventId}/concierge/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attendeeId, message }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
};

const postFeedback = async (
  eventId: string,
  attendeeId: string,
  rating: number,
  notes?: string
) => {
  const res = await fetch(`${API_URL}/events/${eventId}/concierge/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attendeeId, rating, notes }),
  });
  if (!res.ok) throw new Error("Failed to send feedback");
  return res.json();
};

export default function Home() {
  const [eventId, setEventId] = useState<string>("");
  const [attendeeId, setAttendeeId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<
    { role: "user" | "assistant"; text: string; matches?: Match[]; toolCalls?: ToolResult[] }[]
  >([]);
  const [feedbackState, setFeedbackState] = useState<{ [index: number]: { rating: number; notes?: string } }>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  const { data: events } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const { data: attendees } = useQuery({
    queryKey: ["attendees", eventId],
    queryFn: () => fetchAttendees(eventId),
    enabled: !!eventId,
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => sendMessage(eventId, attendeeId, msg),
    onSuccess: (data) => {
      setConversation((prev) => [
        ...prev,
        { role: "user", text: message },
        {
          role: "assistant",
          text: data.message,
          matches: data.matches.length > 0 ? data.matches : undefined,
          toolCalls: data.toolCalls,
        },
      ]);
      setMessage("");
    },
  });

  const handleSend = () => {
    if (!message.trim() || !eventId || !attendeeId) return;
    sendMutation.mutate(message);
  };

  const handleFeedback = async (index: number, rating: number, notes?: string) => {
    setFeedbackState((prev) => ({ ...prev, [index]: { rating, notes } }));
    try {
      await postFeedback(eventId, attendeeId, rating, notes);
    } catch {}
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">MyConnect AI Networking Concierge</h1>

      <p className="mb-4 text-sm">
        <Link href="/admin" className="text-blue-600 underline">
          Admin Panel (Create Events, Register Attendees)
        </Link>
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium">Event</label>
          <select
            className="w-full border rounded p-2"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">Select event</option>
            {events?.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Attendee (you)</label>
          <select
            className="w-full border rounded p-2"
            value={attendeeId}
            onChange={(e) => setAttendeeId(e.target.value)}
            disabled={!eventId}
          >
            <option value="">Select attendee</option>
            {attendees?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border rounded-lg p-4 h-[500px] overflow-y-auto mb-4 bg-gray-50">
        {conversation.length === 0 && (
          <p className="text-gray-400 text-center mt-20">
            Select an event and attendee, then type a message to start networking.
          </p>
        )}
        {conversation.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div
              className={`inline-block max-w-[80%] p-3 rounded-lg ${
                msg.role === "user" ? "bg-blue-500 text-white" : "bg-white border text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.matches && msg.matches.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.matches.map((match, j) => (
                    <div key={j} className="border-t pt-2 text-sm">
                      <p className="font-semibold">{match.name} — {match.headline}</p>
                      <p>Score: {match.score}/100</p>
                      <p className="text-gray-600">{match.rationale}</p>
                      <p className="text-gray-600">Shared: {match.shared_ground.join(", ")}</p>
                      {match.introMessage && (
                        <blockquote className="border-l-4 border-green-300 pl-2 italic text-gray-700 mt-1">
                          {match.introMessage}
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && (
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleFeedback(i, star)}
                      className={`text-lg ${
                        (feedbackState[i]?.rating || 0) >= star ? "text-yellow-400" : "text-gray-300"
                      } hover:text-yellow-500`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 border rounded p-2"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={!eventId || !attendeeId || sendMutation.isPending}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || !eventId || !attendeeId || sendMutation.isPending}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {sendMutation.isPending ? "Sending..." : "Send"}
        </button>
      </div>

      <div className="flex justify-between items-center mt-4">
        <p className="text-xs text-gray-500">Connected to {API_URL}</p>
        <Link href="/admin" className="text-xs text-blue-600 underline">
          Admin Panel
        </Link>
      </div>
    </main>
  );
}