# v8eval

Independent AI model verification platform. Prove your model works — keep your weights private.

Built with FastAPI (API backend) + Next.js (frontend), running inside EigenCompute TEE for cryptographically signed, verifiable evaluation reports.

---

## Features

- **Models supported:**
  - `Qwen/Qwen2.5-1.5B-Instruct`
  - `microsoft/Phi-3.5-mini-instruct` (tries 4-bit first, falls back if unsupported)
  - `google/gemma-2-2b-it`
- **Benchmarks:**
  - `arc_challenge`
  - `hellaswag`
- Multi-page frontend: landing page, verification tool, shareable proof pages
- Real-time log streaming via SSE during evaluation runs
- Cryptographic signing of results inside TEE wallet context
- Light/dark theme with persistent toggle

---

## Architecture

```
Frontend (Next.js static export → served by FastAPI):
  /                  → Landing page (marketing, waitlist)
  /verify            → Verification tool (model selection, run benchmarks, live logs)
  /proof?id={run_id} → Shareable proof page (scores, signature, verification details)

Backend (FastAPI API):
  POST /api/run                → Start an evaluation (returns run_id)
  GET  /api/stream/{run_id}    → SSE endpoint for real-time logs + progress
  GET  /api/result/{run_id}    → Get final results JSON
  GET  /api/models             → List available models + benchmarks
```

Next.js `output: 'export'` produces static HTML/JS/CSS at build time. FastAPI serves these from `frontend/out/` and handles the `/api/*` endpoints. Single process, single container.

---

## Local Setup & Run

### 1. Clone and install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set MNEMONIC to a test mnemonic for local signing
```

`.env` variables:

| Variable             | Description                                              | Default                        |
|----------------------|----------------------------------------------------------|--------------------------------|
| `MNEMONIC`           | BIP-39 wallet mnemonic for signing results               | (required for signing)         |
| `APP_ADDRESS`        | App address placeholder shown in the report              | `<app-address-placeholder>`    |
| `DOCKER_IMAGE_DIGEST`| Docker digest placeholder shown in the report            | `<docker-image-digest-placeholder>` |
| `N_SHOT`             | Few-shot count passed to lm-eval                         | `0`                            |
| `LM_EVAL_LIMIT`      | Limit number of samples (leave blank for full benchmark) | (none)                         |

### 4. Run the app

```bash
python app.py
```

App is available at: `http://localhost:8000`

### Frontend development

For frontend-only development with hot reload:

```bash
cd frontend
npm run dev
```

This runs Next.js dev server on port 3000 and proxies `/api/*` requests to `http://localhost:8000` (requires the FastAPI backend running separately).

---

## Docker

### Build

```bash
docker build -t v8eval .
```

### Run

```bash
docker run --rm -p 8000:8000 \
  -e MNEMONIC="your test mnemonic here" \
  v8eval
```

App is available at: `http://localhost:8000`

---

## Deploy on EigenCompute (Sepolia)

### 3-command deploy

```bash
ecloud compute app create --name verifiable-evals-demo --language python --template-repo minimal
cd verifiable-evals-demo
ecloud compute app deploy --chain sepolia
```

> After `create`, replace the generated files with files from this repo before running `deploy`.

On EigenCompute, `MNEMONIC` is injected automatically at runtime by KMS — no manual secret management needed.

---

## Verification

The app signs `sha256(canonical_json(lm_eval_results))` using:

```python
account = Account.from_mnemonic(os.getenv("MNEMONIC"))
account.sign_message(encode_defunct(text=message_hash))
```

Anyone can verify off-chain by checking:
- Signer address
- Message hash (SHA-256)
- Signature hex

---

## Project Structure

```
eigencloud/
├── app.py              # FastAPI app — API endpoints + static file serving
├── eval_runner.py      # Eval logic: lm-eval subprocess, model configs, signing
├── frontend/           # Next.js app
│   ├── app/
│   │   ├── layout.tsx          # Root layout (fonts, theme, nav/footer)
│   │   ├── page.tsx            # Landing page
│   │   ├── verify/page.tsx     # Verification tool page
│   │   ├── proof/page.tsx      # Shareable proof page
│   │   └── globals.css         # Design system (CSS variables, all styles)
│   ├── components/             # Shared React components
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.ts
├── requirements.txt    # Python dependencies
├── Dockerfile          # Multi-stage: build Next.js, then Python runtime
├── .env.example        # Environment variable template
├── sheets-setup.md     # Google Sheets waitlist integration guide
└── README.md
```

---

## Credits

Verifiable private model evals idea by [Gajesh Naik](https://eigencloud.xyz).
Built on EigenCompute — independent TEE-signed model verification.
