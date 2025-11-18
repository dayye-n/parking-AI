import json
import logging
import os
from collections import OrderedDict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from anthropic import Anthropic

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL_NAME = os.getenv("ANTHROPIC_MODEL", "claude-3-opus-20240229")

_client: Optional[Anthropic] = None
if ANTHROPIC_API_KEY:
    _client = Anthropic(api_key=ANTHROPIC_API_KEY)

OPUS_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
CACHE_LIMIT = 32
LOG_PATH = Path(__file__).resolve().parent / "data" / "opus_logs.jsonl"


def _extract_json_block(text: str) -> Optional[Dict[str, Any]]:
    """Extract JSON payloads even if the model wraps them in fences."""
    if not text:
        return None

    cleaned = text.strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        for chunk in parts:
            chunk = chunk.strip()
            if not chunk:
                continue
            if chunk.lower().startswith("json"):
                chunk = chunk[4:].strip()
            try:
                return json.loads(chunk)
            except json.JSONDecodeError:
                continue

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.debug("Unable to parse Opus response as JSON: %s", cleaned)
        return None


def _summarize_lots(lots: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "id": lot.get("id"),
            "name": lot.get("name"),
            "city": lot.get("city"),
            "walking_time_minutes": lot.get("walking_time_minutes"),
            "covered": lot.get("covered"),
            "ev_support": lot.get("ev_support"),
            "amenities": lot.get("amenities"),
            "distance_text": lot.get("distance_text"),
            "duration_text": lot.get("duration_text"),
            "congestion_score": lot.get("congestion_score"),
            "recommendation_score": lot.get("recommendation_score"),
        }
        for lot in lots
    ]


def _default_intent(preference_text: Optional[str], context: Optional[Dict[str, Any]]) -> str:
    if preference_text and preference_text.strip():
        return preference_text.strip()

    city = context.get("city") if context else None
    duration = context.get("duration_hours") if context else None
    covered = context.get("prefer_covered")
    pieces = ["Balance safety, shade, and minimal walking distance."]
    if city:
        pieces.append(f"City: {city}.")
    if duration:
        pieces.append(f"Stay length: {duration}h.")
    if covered is not None:
        pieces.append("Prefer covered bays." if covered else "Covered bays optional.")
    return " ".join(pieces)


def _cache_key(intent: str, lots: Sequence[Dict[str, Any]], context: Optional[Dict[str, Any]]) -> str:
    ids = [lot.get("id") for lot in lots]
    key_obj = {
        "intent": intent,
        "ids": ids,
        "city": (context or {}).get("city"),
    }
    return json.dumps(key_obj, sort_keys=True)


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    cached = OPUS_CACHE.get(key)
    if cached is None:
        return None
    OPUS_CACHE.move_to_end(key)
    return cached


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    OPUS_CACHE[key] = value
    OPUS_CACHE.move_to_end(key)
    if len(OPUS_CACHE) > CACHE_LIMIT:
        OPUS_CACHE.popitem(last=False)


def _log_event(entry: Dict[str, Any]) -> None:
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as exc:  # pragma: no cover - logging best-effort
        logger.debug("Unable to log Opus event: %s", exc)


def _fallback_briefing(intent_text: str, lots: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    if not lots:
        return {"summary": "No live lots to evaluate.", "lots": []}

    top = lots[0]
    summary = (
        f"Focusing on {intent_text.lower()}. "
        f"{top.get('name', 'the leading garage')} sets the tone with strong confidence."
    )
    highlights = []
    for idx, lot in enumerate(lots[:3], start=1):
        walk_time = lot.get("walking_time_minutes")
        walk_phrase = (
            f"~{int(walk_time)} min walk"
            if isinstance(walk_time, (int, float))
            else "short walk"
        )
        highlights.append(
            {
                "id": lot.get("id"),
                "note": f"Ranks #{idx} with {walk_phrase} and "
                f"{'covered' if lot.get('covered') else 'open-air'} stalls.",
                "confidence": int(max(70 - (idx - 1) * 5, 60)),
                "priority": idx,
            }
        )

    return {
        "summary": summary,
        "lots": highlights,
        "reranked_ids": [h["id"] for h in highlights if h.get("id") is not None],
        "insights": [
            "Opus running in offline heuristic mode.",
            "Provide a preference prompt for richer explanations.",
        ],
        "source": "fallback",
    }


def request_opus_briefing(
    preference_text: Optional[str],
    lots: List[Dict[str, Any]],
    context: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Call Claude Opus for a short summary + per-lot notes + reranking."""
    intent_text = _default_intent(preference_text, context)
    summarized_lots = _summarize_lots(lots)
    cache_key = _cache_key(intent_text, summarized_lots, context)

    cached = _cache_get(cache_key)
    if cached:
        return cached | {"source": "cache"}

    if not _client:
        result = _fallback_briefing(intent_text, summarized_lots)
        _cache_set(cache_key, result)
        return result

    system_prompt = (
        "You are ParkSense's Claude-3 Opus routing brain. "
        "Given a driver's intent and candidate parking lots, produce pure JSON only. "
        "Include fields: "
        '{"summary": "...", "lots": [{"id": 1, "note": "...", "confidence": 93, "priority": 1}], '
        '"reranked_ids": ["1","2","3"], '
        '"insights": ["short sentence", "..."]}. '
        "Per-lot notes must be <= 28 words. priority=1 is the best fit. "
        "Reorder lots when necessary."
    )

    driver_context_lines = [
        f"Intent: {intent_text}",
        f"City: {(context or {}).get('city', 'Unknown')}",
        f"Vehicle: {(context or {}).get('vehicle_type', 'standard')}",
        f"Duration hours: {(context or {}).get('duration_hours', 'n/a')}",
        f"Prefer covered: {(context or {}).get('prefer_covered')}",
    ]

    user_message = (
        "\n".join(driver_context_lines)
        + "\nCandidate lots JSON:\n"
        + json.dumps(summarized_lots, ensure_ascii=False)
    )

    try:
        response = _client.messages.create(
            model=ANTHROPIC_MODEL_NAME,
            max_tokens=800,
            temperature=0.2,
            system=system_prompt,
            messages=[{"role": "user", "content": [{"type": "text", "text": user_message}]}],
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Opus request failed: %s", exc)
        result = _fallback_briefing(intent_text, summarized_lots)
        _cache_set(cache_key, result)
        return result

    text_blocks = [block.text for block in response.content if hasattr(block, "text")]
    raw_text = "\n".join(text_blocks).strip()
    parsed = _extract_json_block(raw_text)
    if not parsed:
        parsed = _fallback_briefing(intent_text, summarized_lots)

    parsed["source"] = parsed.get("source") or "live"
    _cache_set(cache_key, parsed)
    _log_event(
        {
            "ts": datetime.utcnow().isoformat(),
            "intent": intent_text,
            "context": context,
            "lots": summarized_lots,
            "response": parsed,
        }
    )
    return parsed


def request_opus_chat(
    messages: List[Dict[str, str]],
    context: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Lightweight conversational endpoint for follow-up questions."""
    if not messages:
        return None

    def fallback_reply(reason: str) -> str:
        city = (context or {}).get("city") or "your city"
        return (
            f"Opus can't join chat right now ({reason}). "
            f"I'm still prioritizing {city} lots using the latest telemetry."
        )

    if not _client:
        return fallback_reply("LLM client unavailable")

    system_context = (
        "You are the Claude-3 Opus agent embedded in ParkSense. "
        "Answer conversational questions about parking recommendations succinctly (<=80 words). "
        "If data is missing, explain gracefully."
    )

    if context:
        context_lines = [
            f"City: {context.get('city')}",
            f"Preference: {context.get('preference')}",
            f"Visible lots: {context.get('lots')}",
        ]
        messages = [{"role": "system", "content": "\n".join(context_lines)}] + messages

    try:
        response = _client.messages.create(
            model=ANTHROPIC_MODEL_NAME,
            max_tokens=300,
            temperature=0.3,
            system=system_context,
            messages=[
                {
                    "role": msg["role"],
                    "content": [{"type": "text", "text": msg["content"]}],
                }
                for msg in messages
            ],
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("Opus chat failed: %s", exc)
        return fallback_reply("LLM request failed")

    text_blocks = [block.text for block in response.content if hasattr(block, "text")]
    return "\n".join(text_blocks).strip()
