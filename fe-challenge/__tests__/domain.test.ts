import { createSession, fetchSession } from '../domain/api';
import { Session } from '../domain/types';

describe('Session domain', () => {
  it('should create a session with an id and title', async () => {
    const session = await createSession({ title: 'Test Session' });

    expect(session.id).toBeDefined();
    expect(session.title).toBe('Test Session');
    expect(Array.isArray(session.messages)).toBe(true);
    expect(session.messages).toHaveLength(0);
  });

  it('should retrieve a previously created session', async () => {
    const created = await createSession({ title: 'Retrieve Me' });
    const fetched = await fetchSession(created.id);

    expect(fetched).toBeDefined();
    expect(fetched.title).toBe('Retrieve Me');
    expect(fetched.id).toBe(created.id);
  });

  it('should throw when fetching a non‑existent session', async () => {
    await expect(fetchSession('non-existent-id')).rejects.toThrow('Session not found');
  });
});