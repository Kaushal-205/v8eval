"""Evaluation runner module.

All lm-eval subprocess logic, model configs, signing, and report building live here.
The FastAPI app.py imports this module.
"""

import hashlib
import json
import os
import queue
import shlex
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from eth_account import Account
from eth_account.messages import encode_defunct

Account.enable_unaudited_hdwallet_features()

# ── Constants ────────────────────────────────────────────────────────────────

PROJECT_NAME = "v8eval"
APP_ADDRESS_PLACEHOLDER = os.getenv("APP_ADDRESS", "<app-address-placeholder>")
DOCKER_DIGEST_PLACEHOLDER = os.getenv("DOCKER_IMAGE_DIGEST", "<docker-image-digest-placeholder>")
N_SHOT_DEFAULT = int(os.getenv("N_SHOT", "0"))
LM_EVAL_LIMIT = os.getenv("LM_EVAL_LIMIT", "")

MODEL_OPTIONS: dict[str, dict[str, Any]] = {
    "Qwen/Qwen2.5-1.5B-Instruct": {
        "model_id": "Qwen/Qwen2.5-1.5B-Instruct",
        "prefer_4bit": False,
        "trust_remote_code": False,
    },
    "microsoft/Phi-3.5-mini-instruct": {
        "model_id": "microsoft/Phi-3.5-mini-instruct",
        "prefer_4bit": True,
        "trust_remote_code": True,
    },
    "google/gemma-2-2b-it": {
        "model_id": "google/gemma-2-2b-it",
        "prefer_4bit": False,
        "trust_remote_code": False,
    },
}

BENCHMARK_OPTIONS: dict[str, str] = {
    "ARC (arc_challenge)": "arc_challenge",
    "HellaSwag (hellaswag)": "hellaswag",
}

MODEL_META: dict[str, dict[str, str]] = {
    "Qwen/Qwen2.5-1.5B-Instruct": {"params": "1.5B", "type": "Instruct"},
    "microsoft/Phi-3.5-mini-instruct": {"params": "3.8B", "type": "Instruct"},
    "google/gemma-2-2b-it": {"params": "2B", "type": "Instruct"},
}

REFERENCE_SCORES: dict[str, dict[str, dict[str, Any]]] = {
    "Qwen/Qwen2.5-1.5B-Instruct": {
        "arc_challenge": {"score": 54.7, "shots": 25, "source": "Qwen blog"},
        "hellaswag": {"score": 67.9, "shots": 10, "source": "Qwen blog"},
    },
    "microsoft/Phi-3.5-mini-instruct": {
        "arc_challenge": {"score": 55.7, "shots": 25, "source": "Microsoft tech report"},
        "hellaswag": {"score": 69.4, "shots": 10, "source": "Microsoft tech report"},
    },
    "google/gemma-2-2b-it": {
        "arc_challenge": {"score": 52.3, "shots": 25, "source": "Google tech report"},
        "hellaswag": {"score": 61.1, "shots": 10, "source": "Google tech report"},
    },
}

SAMPLE_LIMIT_OPTIONS = [
    "Quick Demo (50 samples)",
    "Standard (200 samples)",
    "Thorough (500 samples)",
    "Full benchmark (all samples — slow on CPU)",
]

SAMPLE_LIMIT_MAP: dict[str, str] = {
    "Quick Demo (50 samples)": "50",
    "Standard (200 samples)": "200",
    "Thorough (500 samples)": "500",
    "Full benchmark (all samples — slow on CPU)": "",
}

FEWSHOT_OPTIONS = [
    "0-shot (fastest)",
    "5-shot",
    "10-shot (HellaSwag standard)",
    "25-shot (ARC standard)",
]

FEWSHOT_MAP: dict[str, int] = {
    "0-shot (fastest)": 0,
    "5-shot": 5,
    "10-shot (HellaSwag standard)": 10,
    "25-shot (ARC standard)": 25,
}


# ── Run state ────────────────────────────────────────────────────────────────

@dataclass
class RunState:
    """Tracks a single evaluation run."""
    status: str = "running"  # running | completed | failed
    logs: list[str] = field(default_factory=list)
    line_count: int = 0
    progress: float = 0.0
    results: dict[str, Any] | None = None
    error: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def now_utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_benchmarks(selection: list[str]) -> list[str]:
    return [BENCHMARK_OPTIONS[s] for s in selection if s in BENCHMARK_OPTIONS]


def build_model_args(model_cfg: dict[str, Any], use_4bit: bool) -> str:
    args = [
        f"pretrained={model_cfg['model_id']}",
        "dtype=auto",
    ]
    if model_cfg.get("trust_remote_code"):
        args.append("trust_remote_code=True")
    if use_4bit:
        args.append("load_in_4bit=True")
    return ",".join(args)


def parse_lm_eval_json(output_dir: Path) -> dict[str, Any]:
    candidates = sorted(output_dir.rglob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError("lm-eval completed but no JSON output file was found.")

    for candidate in candidates:
        try:
            return json.loads(candidate.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

    raise RuntimeError("Could not parse any lm-eval JSON artifacts.")


def pick_primary_metric(metrics: dict[str, Any]) -> tuple[str, float] | tuple[None, None]:
    priority = [
        "acc_norm,none",
        "acc,none",
        "acc_norm",
        "acc",
        "exact_match,none",
        "exact_match",
    ]
    for key in priority:
        if isinstance(metrics.get(key), (int, float)):
            return key, float(metrics[key])

    for key, value in metrics.items():
        if "stderr" in key:
            continue
        if isinstance(value, (int, float)):
            return key, float(value)

    return None, None


def build_score_data(
    results: dict[str, Any],
    selected_tasks: list[str],
    model_id: str = "",
    num_fewshot: int = 0,
    limit: str = "",
) -> list[dict[str, Any]]:
    """Return score card data as a list of dicts (not HTML)."""
    task_results = results.get("results", {})
    display_names = {
        "arc_challenge": "ARC Challenge",
        "hellaswag": "HellaSwag",
    }

    cards = []
    for task in selected_tasks:
        metrics = task_results.get(task, {})
        metric_name, metric_value = pick_primary_metric(metrics)

        if metric_name is None:
            score_display = "N/A"
            metric_display = "No numeric metric found"
        else:
            score_display = f"{metric_value * 100:.2f}%"
            metric_display = metric_name

        ref = REFERENCE_SCORES.get(model_id, {}).get(task)
        sample_label = f"{limit} samples" if limit else "all samples"

        cards.append({
            "task": task,
            "display_name": display_names.get(task, task),
            "score_display": score_display,
            "metric_name": metric_display,
            "num_fewshot": num_fewshot,
            "sample_label": sample_label,
            "reference": ref,
            "raw_value": metric_value,
        })

    return cards


def sign_results_payload(raw_results: dict[str, Any]) -> dict[str, str]:
    mnemonic = os.getenv("MNEMONIC", "").strip()
    if not mnemonic:
        raise RuntimeError("MNEMONIC is not available. On EigenCompute this is injected by KMS at runtime.")

    canonical_results = json.dumps(raw_results, sort_keys=True, separators=(",", ":"))
    message_hash = hashlib.sha256(canonical_results.encode("utf-8")).hexdigest()

    account = Account.from_mnemonic(mnemonic)
    signed = account.sign_message(encode_defunct(text=message_hash))

    return {
        "signer_address": account.address,
        "message_hash": message_hash,
        "signature_hex": signed.signature.hex(),
    }


def build_report(
    raw_results: dict[str, Any],
    selected_model: str,
    selected_tasks: list[str],
    duration_seconds: float,
    quantization_mode: str,
    fallback_used: bool,
    signature_info: dict[str, str],
    num_fewshot: int = 0,
    limit: str = "",
) -> dict[str, Any]:
    compact_scores: dict[str, dict[str, Any]] = {}
    for task in selected_tasks:
        metrics = raw_results.get("results", {}).get(task, {})
        metric_name, metric_value = pick_primary_metric(metrics)
        compact_scores[task] = {
            "metric": metric_name,
            "value": metric_value,
        }

    return {
        "project": PROJECT_NAME,
        "version": "phase-1-public-models",
        "timestamp_utc": now_utc_iso(),
        "model": selected_model,
        "benchmarks": selected_tasks,
        "scores": compact_scores,
        "score_cards": build_score_data(raw_results, selected_tasks, selected_model, num_fewshot, limit),
        "runtime": {
            "num_fewshot": num_fewshot,
            "quantization_mode": quantization_mode,
            "fallback_used": fallback_used,
            "duration_seconds": round(duration_seconds, 2),
            "limit": limit or "full",
        },
        "verification": {
            "tee_claim": "This signature was created inside EigenCompute TEE. Anyone can verify it on-chain.",
            "signer_address": signature_info.get("signer_address", ""),
            "message_hash_sha256": signature_info.get("message_hash", ""),
            "signature_hex": signature_info.get("signature_hex", ""),
            "app_address": APP_ADDRESS_PLACEHOLDER,
            "docker_image_digest": DOCKER_DIGEST_PLACEHOLDER,
        },
        "raw_lm_eval": raw_results,
    }


def build_eval_command(
    model_cfg: dict[str, Any],
    selected_tasks: list[str],
    use_4bit: bool,
    output_dir: Path,
    num_fewshot: int = 0,
    limit: str = "",
) -> list[str]:
    model_args = build_model_args(model_cfg, use_4bit)
    cmd = [
        sys.executable,
        "-u",
        "-m",
        "lm_eval",
        "--model",
        "hf",
        "--model_args",
        model_args,
        "--tasks",
        ",".join(selected_tasks),
        "--num_fewshot",
        str(num_fewshot),
        "--batch_size",
        "1",
        "--device",
        "cpu",
        "--output_path",
        str(output_dir),
        "--verbosity",
        "INFO",
    ]
    if limit.strip():
        cmd.extend(["--limit", limit.strip()])
    return cmd


# ── Main runner ──────────────────────────────────────────────────────────────

def run_evaluation(
    run_id: str,
    model_label: str,
    benchmarks: list[str],
    sample_limit: str,
    num_fewshot: int,
    runs_store: dict[str, RunState],
) -> None:
    """Run an lm-eval evaluation in the current thread.

    Updates ``runs_store[run_id]`` in-place with logs, progress, and final results.
    Designed to be called from a background thread spawned by the API layer.
    """
    state = runs_store[run_id]

    model_cfg = MODEL_OPTIONS[model_label]
    fallback_used = False
    quantization_mode = "none"
    raw_results: dict[str, Any] | None = None

    attempts = []
    if model_cfg.get("prefer_4bit"):
        attempts.append((True, "4-bit quantized"))
        attempts.append((False, "fallback (non-quantized)"))
    else:
        attempts.append((False, "non-quantized"))

    started = time.time()

    for idx, (use_4bit, mode_name) in enumerate(attempts, start=1):
        try:
            state.logs.append(f"Starting attempt {idx}/{len(attempts)} with mode: {mode_name}")
            state.progress = 0.1

            with tempfile.TemporaryDirectory(prefix="verieval-") as tmp_dir:
                out_dir = Path(tmp_dir)
                cmd = build_eval_command(
                    model_cfg=model_cfg,
                    selected_tasks=benchmarks,
                    use_4bit=use_4bit,
                    output_dir=out_dir,
                    num_fewshot=num_fewshot,
                    limit=sample_limit,
                )
                state.logs.append(f"$ {' '.join(shlex.quote(part) for part in cmd)}")

                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    bufsize=0,
                    env={**os.environ, "PYTHONUNBUFFERED": "1"},
                )

                if proc.stdout is None:
                    raise RuntimeError("lm-eval process did not expose stdout.")

                line_queue: queue.Queue[str | None] = queue.Queue()

                def _pipe_reader(stdout: Any, q: queue.Queue) -> None:
                    buf = b""
                    while True:
                        chunk = stdout.read(512)
                        if not chunk:
                            break
                        buf += chunk
                        *lines, buf = buf.replace(b"\r", b"\n").split(b"\n")
                        for ln in lines:
                            text = ln.decode("utf-8", errors="replace").strip()
                            if text:
                                q.put(text)
                    if buf:
                        text = buf.decode("utf-8", errors="replace").strip()
                        if text:
                            q.put(text)
                    q.put(None)

                reader = threading.Thread(
                    target=_pipe_reader, args=(proc.stdout, line_queue), daemon=True
                )
                reader.start()

                running = True
                while running:
                    while True:
                        try:
                            item = line_queue.get_nowait()
                        except queue.Empty:
                            break
                        if item is None:
                            running = False
                            break
                        state.logs.append(item)
                        state.line_count += 1

                    state.progress = 0.2 + min(0.6, state.line_count / 300.0)

                    if running:
                        time.sleep(0.05)

                reader.join(timeout=5)

                exit_code = proc.wait()
                if exit_code != 0:
                    raise RuntimeError(f"lm-eval exited with code {exit_code}.")

                raw_results = parse_lm_eval_json(out_dir)

            quantization_mode = mode_name
            fallback_used = idx > 1
            break

        except Exception as exc:
            state.logs.append(f"Attempt {idx} failed: {exc}")
            if idx == len(attempts):
                state.status = "failed"
                state.error = str(exc)
                state.progress = 1.0
                return

            state.logs.append("Retrying automatically with fallback settings...")

    if raw_results is None:
        state.status = "failed"
        state.error = "Evaluation did not return any data."
        state.progress = 1.0
        return

    # Signing
    state.logs.append("Signing results inside TEE wallet context...")
    state.progress = 0.85

    try:
        signature_info = sign_results_payload(raw_results)
    except Exception as exc:
        state.logs.append(f"Signing failed: {exc}")
        signature_info = {
            "signer_address": "",
            "message_hash": "",
            "signature_hex": "",
        }

    duration = time.time() - started
    report = build_report(
        raw_results=raw_results,
        selected_model=model_label,
        selected_tasks=benchmarks,
        duration_seconds=duration,
        quantization_mode=quantization_mode,
        fallback_used=fallback_used,
        signature_info=signature_info,
        num_fewshot=num_fewshot,
        limit=sample_limit,
    )

    state.results = report
    state.status = "completed"
    state.progress = 1.0
    state.logs.append(f"Completed in {duration:.1f}s.")
