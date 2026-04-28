import { v4 as uuid } from 'uuid';
import Groq from 'groq-sdk';
import { Session, Message, CreateSessionPayload } from './types';

const sessions: Map<string, Session> = new Map();

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

function maybeThrow() {
  if (Math.random() < 0.1) {
    throw new Error('Simulated server error');
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchSessions(): Promise<Session[]> {
  await delay(300);
  maybeThrow();
  return Array.from(sessions.values()).map(s => ({
    ...s,
    messages: [...s.messages]
  }));
}

export async function createSession(payload: CreateSessionPayload): Promise<Session> {
  await delay(500);
  maybeThrow();
  const id = uuid();
  const now = new Date();
  const session: Session = {
    id,
    title: payload.title,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  sessions.set(id, session);
  return session;
}
export async function fetchSession(id: string): Promise<Session> {
  await delay(300);
  maybeThrow();
  const session = sessions.get(id);
  if (!session) throw new Error('Session not found');
  return { ...session, messages: [...session.messages] };
}

export async function* streamAssistantResponse(
  sessionId: string,
  userMessage: string
): AsyncGenerator<Message> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  // Add user message
  const userMsg: Message = {
    id: uuid(),
    sessionId,
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
  };
  session.messages.push(userMsg);
  session.updatedAt = new Date();

  // Build conversation history
  const history = session.messages
    .filter(m => m.id !== userMsg.id)
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));

  const assistantMessageId = uuid();
  let fullContent = '';

  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant. Be concise and friendly.' },
        ...history,
        { role: 'user', content: userMessage },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const chunkText = chunk.choices[0]?.delta?.content || '';
      fullContent += chunkText;
      yield {
        id: assistantMessageId,
        sessionId,
        role: 'assistant',
        content: fullContent.trim(),
        timestamp: new Date(),
      };
    }
  } catch (error) {
    fullContent = 'Sorry, I encountered an error. Please try again.';
    yield {
      id: assistantMessageId,
      sessionId,
      role: 'assistant',
      content: fullContent,
      timestamp: new Date(),
    };
  }

  // Save final message
  session.messages.push({
    id: assistantMessageId,
    sessionId,
    role: 'assistant',
    content: fullContent.trim(),
    timestamp: new Date(),
  });
  session.updatedAt = new Date();
}