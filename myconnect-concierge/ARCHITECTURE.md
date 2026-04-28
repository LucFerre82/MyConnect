# Architecture Deep‑Dive

## Agent Framework Choice: Raw OpenAI SDK + Custom Pipeline

We deliberately avoided LangChain. The concierge logic is a strict sequence of tool calls with explicit error handling. A custom pipeline (`ConciergeService`) chains dedicated stage methods (`searchAttendees`, `scoreMatches`, `draftIntro`). This gives us:

- **Full auditability** — every prompt is code‑reviewable, no hidden templates.
- **Testability** — each stage can be unit‑tested in isolation.
- **Model flexibility** — swapping from DeepSeek to GPT‑4o‑mini required only changing the model string.

## Polyglot Scoring: FastAPI (Python) Microservice

The `scoreMatches` tool call is forwarded to a dedicated **FastAPI** service (`ai-engine/`).  
This demonstrates the polyglot architecture described in the job description.
The NestJS backend calls `http://ai-engine:8000/score` over HTTP.  
If the FastAPI service is unavailable, the system falls back to inline NestJS scoring (same LLM prompt) to ensure resilience.

The FastAPI service uses the same OpenRouter API key and the same GPT‑4o‑mini model for scoring,
keeping latency low and cost predictable.

## Vector Store: pgvector

PostgreSQL + pgvector was chosen because:
- We already need transactional data (events, attendees, conversations). Adding a separate vector DB would increase operational complexity.
- Semantic similarity can be combined with structured filters (e.g., `role = 'Founder'`) in a single query.
- For this scale (10k attendees), an IVFFlat or HNSW index on the embedding column is sufficient.

For larger events (>1M attendees), we’d migrate the embedding search to Pinecone or Weaviate, keeping the structured data in Postgres.

## LLM Provider: OpenRouter (GPT‑4o‑mini)

We use OpenRouter as a unified API gateway for OpenAI‑compatible models. Reasons:
- **Reliable tool calling** — `tool_choice: 'required'` is consistently followed.
- **Cost control** — GPT‑4o‑mini costs ~$0.15/M tokens.
- **Embedding model** — `text-embedding-3-small` produces 1536‑dim vectors with good semantic quality.

## Agent State Persistence & Resumption

The entire conversation is stored in the `conversation_messages` table (role, content JSON). On each new message:

1. The full message history is loaded and serialised into the LLM context.
2. Tool calls and their results are stored as structured JSON.
3. The agent’s “state” is simply the ordered thread — no separate session object needed.

This makes conversations trivially resumable and debuggable: replaying a conversation is just replaying the messages.

## Scaling to 10k Concurrent Attendees at a Single Event

Our approach is **event‑sharded** with caching:

1. **Database** — Partition the `attendees` and `conversation_messages` tables by `event_id`. Use PgBouncer for connection pooling and read replicas for search queries. The pgvector index (HNSW) ensures sub‑10ms nearest‑neighbour search.
2. **Agent state** — Conversation history is cached in Redis (10‑minute TTL) to avoid repeated DB reads.
3. **API layer** — NestJS runs behind a load balancer (AWS ALB) with auto‑scaling based on requests per target. The FastAPI sidecar orchestrates tool calls in parallel, reducing end‑to‑end latency.
4. **LLM cost control** — A token bucket per event (and per attendee) sits in an API gateway. Burst capacity is limited. We pre‑warm embeddings for all attendees when the event is created to avoid per‑request embedding calls.

Estimated bottleneck: the LLM itself (score‑match calls scale linearly with candidates). We’d implement batched scoring via the FastAPI service and a local scoring model (fine‑tuned) for the top of the funnel.

## PII / Data Protection

MyConnect operates with attendee profiles, which may include PII. Our design is compliant with GDPR/CCPA requirements:

- **Data minimisation** — Only `name`, `headline`, and anonymised skills are sent to the LLM. Full bios, emails, and phone numbers are never transmitted.
- **Encryption** — All PII is encrypted at rest using AWS KMS. Database columns containing bios, emails, and `lookingFor` text are encrypted with application‑level field encryption.
- **Right to erasure** — A GDPR endpoint permanently deletes all attendee data and embeddings (cascade‑deletes enforced at the DB level).
- **Prompt sanitisation** — Every user‑supplied field passes through the `SanitizerService` before reaching any LLM. This redacts prompt‑injection patterns and accidentally leaked PII. Logs never store raw unsanitised text.
- **Data residency** — The application is deployed in region‑specific AWS clusters; attendee data never leaves the specified jurisdiction.
