# ParkPilot – Qdrant-Powered Parking Intelligence

Branch `feature/parkpilot-ui` turns the simple parking finder into a polished ops console powered by Qdrant vector search.

## Highlights
- **Futuristic dashboard UI** – Hero marketing section, AI “Command Center” form, live map widget, insights/timeline panels, curated results, and fleet/health boards styled in a cohesive neon theme.
- **Qdrant-backed FastAPI** – `/suggest`, `/insights`, `/timeline`, `/status-board`, and `/dispatch` endpoints hydrate the UI using seeded Dubai/Abu Dhabi/Sharjah zones.
- **Smart fallbacks** – Frontend mocks mirror the API payloads so the experience stays interactive even when Qdrant isn’t running.
- **Hackathon-ready copy + stats** – Trust badges, telemetry blurbs, and animated feeds sell the story to judges in seconds.
- **Claude Opus co-pilot** – Anthropics-powered re-ranking, instant summaries, and an embedded chat so judges can interrogate the AI’s reasoning live.

## Project Structure
```
backend/   FastAPI service + Qdrant integration
frontend/  Static dashboard (index.html, style.css, app.js)
```

## Prerequisites
- Python 3.11+
- Node/NPM optional (static files can be opened directly)
- Running Qdrant instance (local Docker or managed). Configure via `backend/.env`:
  ```env
  QDRANT_URL=http://localhost:6333
  QDRANT_API_KEY=
  GOOGLE_MAPS_API_KEY=
  ANTHROPIC_API_KEY=
  ANTHROPIC_MODEL=claude-3-opus-20240229
  ```

## Getting Started
1. **Install backend deps & run API**
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   On startup the API recreates the `parking_zones` collection and seeds demo data.

2. **Serve or open the frontend**
   - Quick preview: open `frontend/index.html` in a browser.
   - Dev server (optional): `cd frontend && npx serve .` then visit http://localhost:3000.

3. **Wire the frontend to the backend**
   `frontend/index.html` defines:
   ```html
   <script>
     window.API_BASE_URL = 'http://localhost:8000';
   </script>
   ```
   Adjust the URL if the API runs elsewhere.

## Key Endpoints
| Method | Path            | Description                            |
|--------|-----------------|----------------------------------------|
| POST   | `/suggest`      | Vector search + filters per city       |
| GET    | `/insights`     | Derived metrics for dashboard cards    |
| GET    | `/timeline`     | Upcoming operational events            |
| GET    | `/status-board` | Telemetry health statuses              |
| GET    | `/dispatch`     | Fleet/valet feed messages              |
| POST   | `/opus-chat`    | Conversational follow-ups with Opus    |

## Demo Flow
1. Choose a city, arrival window, duration, vehicle type, and toggle “Prefer covered parking”.
2. Submit the form to call `/suggest`; results hydrate the stats, map legend, and cards.
3. Insights/Timeline/Health/Dispatch auto-refresh using their respective endpoints (or mock decks if the API is offline).

## Next Steps
- Pipe real telemetry into Qdrant instead of the seeded zones.
- Replace fallback arrays with live responses once the backend is deployed.
- Add booking/heatmap endpoints (we already prototyped them earlier) when ready.

## Opus Copilot Notes
- `frontend/index.html` exposes a “Trip notes for Opus” field and a chat widget so you can interrogate Claude mid-demo.
- Backend responses always include Opus annotations; results are cached in-memory and appended to `backend/data/opus_logs.jsonl` for later analysis.
- If Opus is offline, the server falls back to heuristic summaries so the UI never stalls.
