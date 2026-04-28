import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { SanitizerService } from '../sanitizer/sanitizer.service';
import OpenAI from 'openai';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ConciergeService {
  private readonly logger = new Logger(ConciergeService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private sanitizer: SanitizerService,
    private httpService: HttpService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    });
  }

  async processMessage(eventId: string, dto: SendMessageDto) {
    const { attendeeId, message } = dto;

    const attendee = await this.prisma.attendee.findFirst({
      where: { id: attendeeId, eventId },
    });
    if (!attendee) throw new BadRequestException('Attendee not found for this event');

    const history = await this.prisma.conversationMessage.findMany({
      where: { attendeeId, eventId },
      orderBy: { createdAt: 'asc' },
    });

    // Sanitize user message before passing to LLM
    const sanitizeResult = await this.sanitizer.sanitize(message);
    if (!sanitizeResult.safe) {
      this.logger.warn(`Injection attempt blocked for attendee ${attendeeId}`);
    }

    // Build messages array
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.buildSystemPrompt(attendee) },
      ...this.buildHistory(history),
      { role: 'user', content: sanitizeResult.sanitized },
    ];

    // First call: ALWAYS call a tool
    const response = await this.openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages,
      tools: this.buildTools(),
      tool_choice: 'required',
    });

    const assistantMessage = response.choices[0].message;

    const toolResults: any[] = [];
    if (assistantMessage.tool_calls) {
      for (const rawToolCall of assistantMessage.tool_calls) {
        const toolCall = rawToolCall as OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
          function: { name: string; arguments: string };
        };

        // Parse arguments safely
        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          this.logger.warn(`Failed to parse tool arguments: ${toolCall.function.arguments}`);
          continue;
        }

        const result = await this.executeToolCall(toolCall.function.name, args, eventId, attendeeId);
        toolResults.push({
          name: toolCall.function.name,
          args,
          result,
        });

        messages.push(assistantMessage);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Second call: get final text response with tool results
      const finalResponse = await this.openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages,
      });

      const finalText = finalResponse.choices[0].message.content || '';

      await this.prisma.conversationMessage.createMany({
        data: [
          { attendeeId, eventId, role: 'user', content: { text: message } },
          {
            attendeeId,
            eventId,
            role: 'assistant',
            content: { text: finalText, toolCalls: toolResults },
          },
        ],
      });

      return {
        message: finalText,
        matches: toolResults.find((t) => t.name === 'score_matches')?.result || [],
        toolCalls: toolResults,
      };
    }

    // Fallback: no tool calls (shouldn't happen with 'required')
    const text = assistantMessage.content || '';

    await this.prisma.conversationMessage.createMany({
      data: [
        { attendeeId, eventId, role: 'user', content: { text: message } },
        { attendeeId, eventId, role: 'assistant', content: { text } },
      ],
    });

    return { message: text, matches: [] };
  }

  async rateMessage(eventId: string, messageId: string, feedback: { rating: number; notes?: string }) {
    return this.prisma.conversationMessage.update({
      where: { id: messageId },
      data: { content: { feedback } },
    });
  }

  // ========================
  // PRIVATE METHODS
  // ========================

  private buildSystemPrompt(attendee: any): string {
    return `You are an AI Networking Concierge for a conference. Your ONLY job is to use tools to find, score, and draft messages. NEVER invent people. Only use real data from the tools.

Current attendee: ${attendee.name}, ${attendee.headline}
Bio: ${attendee.bio}
Skills: ${attendee.skills.join(', ')}
Looking for: ${attendee.lookingFor}

ALWAYS do exactly this:
1. Call search_attendees with a single "lookingFor" string describing the user's intent in natural language. Do NOT pass a "skills" array or "role" filter unless the user explicitly asks for a specific skill.
2. Call score_matches for EVERY candidate returned by search_attendees.
3. Call draft_intro for the top 2 highest-scored candidates.
4. Summarize the results using ONLY the data returned by the tools. Do NOT add fictional people.`;
  }

  private buildHistory(messages: any[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content?.text || '',
      }));
  }

  private buildTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'search_attendees',
          description: 'Search for real attendees at this event using semantic similarity',
          parameters: {
            type: 'object',
            properties: {
              skills: {
                type: 'array',
                items: { type: 'string' },
                description: 'Skills to search for',
              },
              lookingFor: {
                type: 'string',
                description: 'What they are looking for',
              },
              role: {
                type: 'string',
                description: 'Filter by role',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'score_matches',
          description: 'Score each real candidate 0-100 with reasoning. ONLY score real people from search_attendees results.',
          parameters: {
            type: 'object',
            properties: {
              candidates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    headline: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'draft_intro',
          description: 'Generate a personalized outreach message for a real candidate',
          parameters: {
            type: 'object',
            properties: {
              candidateName: { type: 'string' },
              sharedGround: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    ];
  }

  private async executeToolCall(name: string, args: any, eventId: string, attendeeId: string) {
    switch (name) {
      case 'search_attendees':
        return this.searchAttendees(eventId, args);
      case 'score_matches':
        return this.scoreMatches(args, attendeeId);
      case 'draft_intro':
        return this.draftIntro(args, attendeeId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async searchAttendees(eventId: string, args: any) {
    // Build a search query from the natural-language intent
    const queryText = args.lookingFor || (args.skills || []).join(' ') + ' ' + (args.role || '');

    // Always return all attendees for the event, then re-rank semantically
    const attendees = await this.prisma.attendee.findMany({
      where: { eventId },
      take: 20,
      select: {
        id: true, name: true, headline: true, bio: true, company: true,
        role: true, skills: true, lookingFor: true,
      },
    });

    this.logger.log(`search_attendees found ${attendees.length} attendees`);

    // Re-rank by semantic similarity if we have a query
    if (attendees.length > 1 && queryText.trim()) {
      try {
        const embedding = await this.generateEmbeddingArray(queryText);

        // Build a safe comma-separated list of quoted UUIDs (from database, not user input)
        const ids = attendees.map(a => `'${a.id}'`).join(',');
        const ranked = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id, 1 - (embedding <=> $1::vector) as sim
           FROM "Attendee"
           WHERE id IN (${ids})
             AND embedding IS NOT NULL
           ORDER BY sim DESC`,
          embedding
        );

        const simMap = new Map(ranked.map((r: any) => [r.id, r.sim]));
        attendees.sort((a: any, b: any) => (simMap.get(b.id) || 0) - (simMap.get(a.id) || 0));
        this.logger.log(`Re-ranked by semantic similarity`);
      } catch (err) {
        this.logger.warn('Semantic re-rank failed, using default order', err);
      }
    }

    return attendees;
  }

  private async generateEmbedding(text: string): Promise<string> {
    const arr = await this.generateEmbeddingArray(text);
    // Format as pgvector literal: '[0.1,0.2,0.3,...]'
    return `[${arr.join(',')}]`;
  }

  private async generateEmbeddingArray(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text.substring(0, 8000),
    });
    return response.data[0].embedding;
  }

  /**
   * Score candidates by calling the FastAPI scoring microservice.
   * Falls back to inline LLM scoring if the microservice is unavailable.
   */
  private async scoreMatches(args: any, attendeeId: string) {
    const candidates = args.candidates || [];
    if (candidates.length === 0) return [];

    try {
      const response = await this.httpService.axiosRef.post(
        'http://ai-engine:8000/score',
        { candidates, attendee_id: attendeeId },
        { timeout: 60000 },
      );
      this.logger.log(`FastAPI scoring returned ${response.data.scored?.length || 0} results`);
      return response.data.scored || [];
    } catch (err) {
      this.logger.error('FastAPI scoring failed, falling back to inline scoring', err);
      return this.scoreMatchesFallback(args, attendeeId);
    }
  }

  /**
   * Inline fallback scoring when the FastAPI microservice is unavailable.
   */
  private async scoreMatchesFallback(args: any, attendeeId: string) {
    const candidates = args.candidates || [];
    const scored = [];

    for (const candidate of candidates) {
      const result = await this.openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Score this match 0-100. Return ONLY valid JSON (no markdown): {"score": number, "rationale": "string", "shared_ground": ["string"]}\nCandidate: ${candidate.name}, ${candidate.headline}`,
          },
        ],
        max_tokens: 150,
      });

      const text = result.choices[0].message.content || '';
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const json = JSON.parse(jsonMatch[0]);
          scored.push({ ...candidate, ...json });
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        scored.push({ ...candidate, score: 50, rationale: 'Could not evaluate', shared_ground: [] });
      }
    }

    return scored.sort((a: any, b: any) => b.score - a.score);
  }

  private async draftIntro(args: any, attendeeId: string) {
    const attendee = await this.prisma.attendee.findUnique({ where: { id: attendeeId } });
    if (!attendee)
      return { candidateName: args.candidateName, message: 'Attendee not found' };

    const result = await this.openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write a short LinkedIn intro from ${attendee.name} (${attendee.headline}) to ${args.candidateName}. Shared: ${(args.sharedGround || []).join(', ')}. Under 100 words.`,
        },
      ],
      max_tokens: 150,
    });

    return {
      candidateName: args.candidateName,
      message: result.choices[0].message.content || '',
    };
  }
}