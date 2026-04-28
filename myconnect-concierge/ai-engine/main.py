from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import httpx
import json
import logging

app = FastAPI(title="MyConnect Scoring Engine")
logger = logging.getLogger("uvicorn")

# Config
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

class Candidate(BaseModel):
    id: str
    name: str
    headline: str

class ScoreRequest(BaseModel):
    candidates: List[Candidate]
    attendee_id: Optional[str] = None  # for context, not used yet

class ScoredCandidate(Candidate):
    score: int
    rationale: str
    shared_ground: List[str]

class ScoreResponse(BaseModel):
    scored: List[ScoredCandidate]

@app.post("/score", response_model=ScoreResponse)
async def score_matches(req: ScoreRequest):
    """Score each candidate using an LLM call to OpenRouter."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")

    scored = []
    async with httpx.AsyncClient() as client:
        for candidate in req.candidates:
            prompt = (
                f"Score this match 0-100. Return ONLY valid JSON (no markdown): "
                f'{{"score": number, "rationale": "string", "shared_ground": ["string"]}}\n'
                f"Candidate: {candidate.name}, {candidate.headline}"
            )
            try:
                resp = await client.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "openai/gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 150,
                    },
                    timeout=15.0,
                )
                resp.raise_for_status()
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                # Extract JSON
                import re
                json_match = re.search(r'\{[\s\S]*\}', text)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    scored.append(ScoredCandidate(
                        id=candidate.id,
                        name=candidate.name,
                        headline=candidate.headline,
                        score=parsed.get("score", 50),
                        rationale=parsed.get("rationale", "No reasoning"),
                        shared_ground=parsed.get("shared_ground", []),
                    ))
                else:
                    raise ValueError("No JSON in response")
            except Exception as e:
                logger.warning(f"Scoring failed for {candidate.name}: {e}")
                scored.append(ScoredCandidate(
                    id=candidate.id,
                    name=candidate.name,
                    headline=candidate.headline,
                    score=50,
                    rationale="Could not evaluate",
                    shared_ground=[],
                ))

    # Sort by score descending
    scored.sort(key=lambda x: x.score, reverse=True)
    return ScoreResponse(scored=scored)

@app.get("/health")
async def health():
    return {"status": "ok"}
