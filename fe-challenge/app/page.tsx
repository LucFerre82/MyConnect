"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { fetchSessions, createSession } from "@/domain/api";

export default function Home() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: sessions, isLoading, isError } = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => createSession({ title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setTitle("");
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) createMutation.mutate(title.trim());
  };

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Sessions</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New session title..."
          className="flex-1 border rounded p-2 text-black"
          disabled={createMutation.isPending}
        />
        <button
          type="submit"
          disabled={!title.trim() || createMutation.isPending}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "Create"}
        </button>
      </form>

      {error && <p className="text-red-500 mb-4">{error}</p>}
      {isLoading && <p>Loading sessions...</p>}
      {isError && <p className="text-red-500">Failed to load sessions.</p>}

      <ul className="space-y-2">
        {sessions?.map((session) => (
          <li key={session.id}>
            <Link
              href={`/sessions/${session.id}`}
              className="block p-3 border rounded hover:bg-gray-100 transition"
            >
              <h2 className="font-semibold">{session.title}</h2>
              <p className="text-sm text-gray-500">
                {session.messages.length} message(s) ·{" "}
                {new Date(session.updatedAt).toLocaleString()}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <button
        onClick={() => {
          throw new Error("Test Sentry error from session list page");
        }}
        className="text-xs text-gray-400 underline mt-8"
      >
        Trigger test error for Sentry
      </button>
    </main>
  );
}