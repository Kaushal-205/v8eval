"""v8eval — FastAPI backend (API only).

Frontend is hosted on Vercel. This service exposes the evaluation API
and is deployed on EigenCompute TEE.
"""

import asyncio
import json
import os
import threading
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from eval_runner import (
    BENCHMARK_OPTIONS,
    FEWSHOT_MAP,
    FEWSHOT_OPTIONS,
    MODEL_OPTIONS,
    SAMPLE_LIMIT_MAP,
    SAMPLE_LIMIT_OPTIONS,
    RunState,
    normalize_benchmarks,
    run_evaluation,
)

load_dotenv()

RUNS_DIR = Path("runs")
RUNS_DIR.mkdir(exist_ok=True)

# ── In-memory run store ──────────────────────────────────────────────────────

runs: dict[str, RunState] = {}


def _save_run(run_id: str, state: RunState) -> None:
    """Persist a completed run's results to disk."""
    if state.results is None:
        return
    path = RUNS_DIR / f"{run_id}.json"
    payload = {
        "run_id": run_id,
        "status": state.status,
        "results": state.results,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_runs_from_disk() -> None:
    """Load previously completed runs from the runs/ directory on startup."""
    for path in sorted(RUNS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            run_id = payload["run_id"]
            state = RunState(
                status=payload.get("status", "completed"),
                results=payload.get("results"),
            )
            runs[run_id] = state
        except Exception:
            pass


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_runs_from_disk()
    yield


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="v8eval", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ────────────────────────────────────────────────

class RunRequest(BaseModel):
    model: str
    benchmarks: list[str]
    sample_limit: str = "Quick Demo (50 samples)"
    num_fewshot: str = "0-shot (fastest)"


class RunResponse(BaseModel):
    run_id: str


# ── API routes ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/models")
def get_models():
    return {
        "models": list(MODEL_OPTIONS.keys()),
        "benchmarks": list(BENCHMARK_OPTIONS.keys()),
        "sample_limits": SAMPLE_LIMIT_OPTIONS,
        "fewshot_options": FEWSHOT_OPTIONS,
    }


@app.get("/api/runs")
def list_runs():
    """Return metadata for all completed runs, newest first."""
    items = []
    for run_id, state in runs.items():
        if state.status != "completed" or state.results is None:
            continue
        r = state.results
        items.append({
            "run_id": run_id,
            "model": r.get("model", ""),
            "benchmarks": r.get("benchmarks", []),
            "timestamp_utc": r.get("timestamp_utc", ""),
            "duration_seconds": r.get("runtime", {}).get("duration_seconds", 0),
            "scores": r.get("scores", {}),
        })
    items.sort(key=lambda x: x["timestamp_utc"], reverse=True)
    return {"runs": items}


@app.post("/api/run", response_model=RunResponse)
def start_run(req: RunRequest):
    if req.model not in MODEL_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model}")

    selected_tasks = normalize_benchmarks(req.benchmarks)
    if not selected_tasks:
        raise HTTPException(status_code=400, detail="Select at least one valid benchmark.")

    sample_limit = SAMPLE_LIMIT_MAP.get(req.sample_limit, "50")
    num_fewshot = FEWSHOT_MAP.get(req.num_fewshot, 0)

    run_id = uuid.uuid4().hex[:12]
    runs[run_id] = RunState()

    def _run_and_save():
        print(f"[RUN:{run_id}] Thread started: model={req.model}, tasks={selected_tasks}")
        try:
            run_evaluation(run_id, req.model, selected_tasks, sample_limit, num_fewshot, runs)
        except Exception as exc:
            print(f"[RUN:{run_id}] Exception: {exc}")
            runs[run_id].status = "failed"
            runs[run_id].error = str(exc)
        print(f"[RUN:{run_id}] Thread done: status={runs[run_id].status}, logs={len(runs[run_id].logs)}")
        _save_run(run_id, runs[run_id])

    thread = threading.Thread(target=_run_and_save, daemon=True)
    thread.start()

    return RunResponse(run_id=run_id)


@app.get("/api/stream/{run_id}")
async def stream_logs(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found.")

    async def generate() -> AsyncGenerator[str, None]:
        state = runs[run_id]
        sent = 0

        print(f"[SSE:{run_id}] Stream started, status={state.status}, logs={len(state.logs)}")

        yield ": ping\n\n"

        while True:
            current_len = len(state.logs)
            if current_len > sent:
                for line in state.logs[sent:current_len]:
                    safe = line.replace("\n", " ").replace("\r", "")
                    msg = json.dumps({"t": "log", "d": safe})
                    yield f"data: {msg}\n\n"
                sent = current_len

            msg = json.dumps({
                "t": "progress",
                "p": round(state.progress, 2),
                "s": state.status,
                "n": state.line_count,
            })
            yield f"data: {msg}\n\n"

            if state.status == "completed":
                print(f"[SSE:{run_id}] Sending done, sent={sent} logs")
                yield f"data: {json.dumps({'t': 'done'})}\n\n"
                break
            if state.status == "failed":
                err = (state.error or "Unknown error").replace("\n", " ")
                print(f"[SSE:{run_id}] Sending error: {err[:100]}")
                yield f"data: {json.dumps({'t': 'error', 'd': err})}\n\n"
                break

            await asyncio.sleep(0.3)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/result/{run_id}")
def get_result(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found.")

    state = runs[run_id]
    if state.status == "running":
        raise HTTPException(status_code=202, detail="Evaluation still running.")
    if state.status == "failed":
        raise HTTPException(status_code=500, detail=state.error or "Evaluation failed.")

    return state.results


# ── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
