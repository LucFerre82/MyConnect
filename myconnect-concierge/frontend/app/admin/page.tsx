"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Event {
  id: string;
  title: string;
  dates: string;
  location: string;
}

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
  createdAt: string;
}

const fetchEvents = async (): Promise<Event[]> => {
  const res = await fetch(`${API_URL}/events`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
};

const createEvent = async (data: { title: string; dates: string; location: string }) => {
  const res = await fetch(`${API_URL}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create event");
  return res.json();
};

const createAttendee = async (eventId: string, data: any) => {
  const res = await fetch(`${API_URL}/events/${eventId}/attendees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to register attendee");
  return res.json();
};

const fetchAttendees = async (
  eventId: string,
  page: number,
  filters?: { role?: string; skills?: string }
): Promise<Attendee[]> => {
  const params = new URLSearchParams();
  if (filters?.role) params.append("role", filters.role);
  if (filters?.skills) params.append("skills", filters.skills);
  const res = await fetch(`${API_URL}/events/${eventId}/attendees?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch attendees");
  return res.json();
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"event" | "attendee" | "list">("event");
  const queryClient = useQueryClient();

  const [eventTitle, setEventTitle] = useState("");
  const [eventDates, setEventDates] = useState("");
  const [eventLocation, setEventLocation] = useState("");

  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeHeadline, setAttendeeHeadline] = useState("");
  const [attendeeBio, setAttendeeBio] = useState("");
  const [attendeeCompany, setAttendeeCompany] = useState("");
  const [attendeeRole, setAttendeeRole] = useState("");
  const [attendeeSkills, setAttendeeSkills] = useState("");
  const [attendeeLookingFor, setAttendeeLookingFor] = useState("");
  const [attendeeOpenToChat, setAttendeeOpenToChat] = useState(true);

  const [listEventId, setListEventId] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterSkills, setFilterSkills] = useState("");
  const [page, setPage] = useState(1);

  const { data: events } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });

  const { data: attendees } = useQuery({
    queryKey: ["attendees", listEventId, page, filterRole, filterSkills],
    queryFn: () => fetchAttendees(listEventId, page, { role: filterRole, skills: filterSkills }),
    enabled: !!listEventId,
  });

  const eventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setEventTitle("");
      setEventDates("");
      setEventLocation("");
      alert("Event created!");
    },
    onError: (err) => alert("Error: " + err),
  });

  const attendeeMutation = useMutation({
    mutationFn: (data: any) => createAttendee(selectedEventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendees"] });
      setAttendeeName("");
      setAttendeeHeadline("");
      setAttendeeBio("");
      setAttendeeCompany("");
      setAttendeeRole("");
      setAttendeeSkills("");
      setAttendeeLookingFor("");
      alert("Attendee registered!");
    },
    onError: (err) => alert("Error: " + err),
  });

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    eventMutation.mutate({ title: eventTitle, dates: eventDates, location: eventLocation });
  };

  const handleRegisterAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    const skillsArray = attendeeSkills.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    attendeeMutation.mutate({
      name: attendeeName,
      headline: attendeeHeadline,
      bio: attendeeBio,
      company: attendeeCompany || undefined,
      role: attendeeRole || undefined,
      skills: skillsArray,
      lookingFor: attendeeLookingFor,
      openToChat: attendeeOpenToChat,
    });
  };

  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

      <div className="flex gap-2 mb-6">
        {(["event", "attendee", "list"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded ${activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            {tab === "event" && "Create Event"}
            {tab === "attendee" && "Register Attendee"}
            {tab === "list" && "Attendees List"}
          </button>
        ))}
      </div>

      {activeTab === "event" && (
        <form onSubmit={handleCreateEvent} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input className="w-full border rounded p-2" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium">Dates</label>
            <input type="date" className="w-full border rounded p-2" value={eventDates} onChange={(e) => setEventDates(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium">Location</label>
            <input className="w-full border rounded p-2" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} required />
          </div>
          <button type="submit" disabled={eventMutation.isPending} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {eventMutation.isPending ? "Creating..." : "Create Event"}
          </button>
        </form>
      )}

      {activeTab === "attendee" && (
        <form onSubmit={handleRegisterAttendee} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium">Event</label>
            <select className="w-full border rounded p-2" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} required>
              <option value="">Select event</option>
              {events?.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>
          <div><label className="block text-sm font-medium">Name</label><input className="w-full border rounded p-2" value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} required /></div>
          <div><label className="block text-sm font-medium">Headline</label><input className="w-full border rounded p-2" value={attendeeHeadline} onChange={(e) => setAttendeeHeadline(e.target.value)} required /></div>
          <div><label className="block text-sm font-medium">Bio</label><textarea className="w-full border rounded p-2" value={attendeeBio} onChange={(e) => setAttendeeBio(e.target.value)} required /></div>
          <div><label className="block text-sm font-medium">Company (optional)</label><input className="w-full border rounded p-2" value={attendeeCompany} onChange={(e) => setAttendeeCompany(e.target.value)} /></div>
          <div><label className="block text-sm font-medium">Role (optional)</label><input className="w-full border rounded p-2" value={attendeeRole} onChange={(e) => setAttendeeRole(e.target.value)} /></div>
          <div><label className="block text-sm font-medium">Skills (comma-separated)</label><input className="w-full border rounded p-2" value={attendeeSkills} onChange={(e) => setAttendeeSkills(e.target.value)} placeholder="e.g. Node.js, AWS" /></div>
          <div><label className="block text-sm font-medium">Looking For</label><input className="w-full border rounded p-2" value={attendeeLookingFor} onChange={(e) => setAttendeeLookingFor(e.target.value)} required /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={attendeeOpenToChat} onChange={(e) => setAttendeeOpenToChat(e.target.checked)} />
            <label className="text-sm font-medium">Open to Chat</label>
          </div>
          <button type="submit" disabled={attendeeMutation.isPending} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
            {attendeeMutation.isPending ? "Registering..." : "Register Attendee"}
          </button>
        </form>
      )}

      {activeTab === "list" && (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium">Event</label>
              <select className="w-full border rounded p-2" value={listEventId} onChange={(e) => { setListEventId(e.target.value); setPage(1); }}>
                <option value="">Select event</option>
                {events?.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium">Filter by Role</label><input className="w-full border rounded p-2" value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1); }} placeholder="e.g. Founder" /></div>
            <div><label className="block text-sm font-medium">Filter by Skills (comma-separated)</label><input className="w-full border rounded p-2" value={filterSkills} onChange={(e) => { setFilterSkills(e.target.value); setPage(1); }} placeholder="e.g. AI, Node.js" /></div>
          </div>
          {attendees && attendees.length > 0 ? (
            <div className="space-y-4">
              {attendees.slice((page - 1) * 10, page * 10).map((a) => (
                <div key={a.id} className="border rounded p-3">
                  <p className="font-semibold">{a.name} – {a.headline}</p>
                  <p className="text-sm text-gray-600">{a.role} {a.company && `@ ${a.company}`}</p>
                  <p className="text-sm">{a.bio}</p>
                  <p className="text-xs mt-1">Skills: {a.skills.join(", ")} | Looking for: {a.lookingFor}</p>
                  <p className="text-xs text-gray-400">Chat: {a.openToChat ? "Yes" : "No"} | Joined: {new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">Previous</button>
                <span className="py-1">Page {page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={attendees.length < 10} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          ) : listEventId ? (
            <p>No attendees found. Try adjusting filters.</p>
          ) : (
            <p>Select an event to view attendees.</p>
          )}
        </div>
      )}

      <p className="mt-8 text-sm">
        <a href="/" className="text-blue-600 underline">Go to Chat</a>
      </p>
    </main>
  );
}
