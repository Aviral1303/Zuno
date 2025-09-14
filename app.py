from flask import Flask, request, jsonify
from flask_cors import CORS
# Lazy imports for heavy ML deps; populated when STT is enabled
AutoProcessor = None
AutoModelForSpeechSeq2Seq = None
torch = None
librosa = None
sf = None
np = None
import os
from dotenv import load_dotenv
import sqlite3
import tempfile
import logging
import os.path as osp
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
try:
    from langchain.schema import AIMessage
except Exception:
    AIMessage = None
from openai import OpenAI
try:
    import anthropic
except Exception:
    anthropic = None
import requests
import re
import html as htmllib
import json
import random
import math
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from apscheduler.schedulers.background import BackgroundScheduler
from urllib.parse import urlparse

# Load environment variables
load_dotenv()

# Feature toggles / environment flags
SKIP_WHISPER = str(os.getenv("SKIP_WHISPER", "0")).lower() in ("1", "true", "yes")
DEBUG = str(os.getenv("DEBUG", "0")).lower() in ("1", "true", "yes")
USE_RELOADER = str(os.getenv("USE_RELOADER", "0")).lower() in ("1", "true", "yes")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5001"))
DB_PATH = os.getenv("DB_PATH", os.path.join(os.getcwd(), "zuno.db"))
SCHED_ENABLED = str(os.getenv("SCHED_ENABLED", "1")).lower() in ("1", "true", "yes")
SCHED_INTERVAL_MIN = int(os.getenv("SCHED_INTERVAL_MIN", "30"))
APP_ENV = os.getenv("APP_ENV", "development")

# Knot API Configuration
# Use ENV if present, otherwise fall back to provided credentials (per request; do not modify .env)
KNOT_CLIENT_ID = os.getenv('KNOT_CLIENT_ID') or 'dda0778d-9486-47f8-bd80-6f2512f9bcdb'
KNOT_CLIENT_SECRET = os.getenv('KNOT_CLIENT_SECRET') or '884d84e855054c32a8e39d08fcd9845d'
KNOT_BASE_URL = os.getenv('KNOT_BASE_URL', 'https://development.knotapi.com')
KNOT_API_KEY = os.getenv('KNOT_API_KEY')
KNOT_ENABLED = bool(KNOT_CLIENT_ID and KNOT_CLIENT_SECRET)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# -------------------------------------------------
# Lightweight RAG store for Deal Hunter personalization
# -------------------------------------------------
RAG_STORE: dict[str, list[str]] = {}

def _chunk_transactions(transactions: list[dict], max_chars: int = 450) -> list[str]:
    """Create simple textual chunks from transaction dicts.
    Groups by merchant and month to keep chunks relevant and short.
    """
    try:
        from collections import defaultdict
        from datetime import datetime
    except Exception:
        return []
    by_key = defaultdict(list)
    for t in transactions or []:
        merchant_name = None
        m = t.get("merchant") or {}
        if isinstance(m, dict):
            merchant_name = m.get("name") or m.get("merchant_name")
        elif m:
            merchant_name = str(m)
        merchant_name = merchant_name or (t.get("retailer") or t.get("brand") or "Unknown")
        ts = t.get("datetime") or t.get("ts") or t.get("date") or ""
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z","+00:00"))
            key_month = dt.strftime("%Y-%m")
        except Exception:
            key_month = "unknown"
        key = f"{merchant_name}:{key_month}"
        title = None
        if t.get("products") and isinstance(t["products"], list) and t["products"]:
            title = t["products"][0].get("name")
        title = title or t.get("description") or t.get("title") or "Purchase"
        total = None
        p = t.get("price") or {}
        if isinstance(p, dict):
            total = p.get("total")
        if total is None and isinstance(t.get("price_total"), (int,float)):
            total = t.get("price_total")
        by_key[key].append({"title": title, "total": total, "raw": t})

    chunks: list[str] = []
    for key, items in by_key.items():
        merchant, month = key.split(":", 1)
        lines = [f"Merchant: {merchant}", f"Month: {month}"]
        subtotal = 0.0
        for it in items:
            ttl = it.get("title")
            amt = it.get("total")
            if isinstance(amt, str):
                try:
                    amt = float(amt.replace("$", ""))
                except Exception:
                    amt = None
            if isinstance(amt, (int,float)):
                subtotal += float(amt)
                lines.append(f"- {ttl} (${float(amt):.2f})")
            else:
                lines.append(f"- {ttl}")
            if sum(len(x)+1 for x in lines) > max_chars:
                break
        lines.append(f"Subtotal: ${subtotal:.2f}")
        chunk = "\n".join(lines)
        chunks.append(chunk[:max_chars])
    return chunks[:50]

@app.route('/rag/ingest_transactions', methods=['POST'])
def rag_ingest_transactions():
    try:
        data = request.get_json() or {}
        external_user_id = data.get('external_user_id') or 'zuno_user_123'
        transactions = data.get('transactions') or []
        chunks = _chunk_transactions(transactions)
        RAG_STORE[external_user_id] = chunks
        return jsonify({"ok": True, "external_user_id": external_user_id, "chunks": len(chunks)})
    except Exception as e:
        logger.error(f"rag_ingest failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/dealhunter/rag_search', methods=['POST'])
def dealhunter_rag_search():
    """RAG-augmented search: use stored chunks as context to expand the query, then call dealhunter/claude_search."""
    try:
        data = request.get_json() or {}
        external_user_id = data.get('external_user_id') or 'zuno_user_123'
        query = (data.get('query') or '').strip()
        budget_cents = data.get('budget_cents')
        max_results = int(data.get('max_results') or 6)
        if not query:
            return jsonify({"error": "missing query"}), 400
        chunks = RAG_STORE.get(external_user_id) or []
        base = os.getenv('SELF_BASE_URL') or 'http://localhost:5001'

        # If query is vague (e.g., "suggest me something"), prefer picking 1-2 items from history (Amazon) and searching for those
        def _is_vague(q: str) -> bool:
            ql = (q or '').lower().strip()
            phrases = [
                'suggest me something', 'something i like', 'say me something i like', 'sayme something i like',
                'recommend me', 'what should i buy', 'show me something', 'anything good', 'anything i like'
            ]
            if any(p in ql for p in phrases):
                return True
            # Short/ambiguous queries
            return len(ql.split()) <= 2

        def _fetch_mock_amazon_transactions(external_user_id: str) -> list:
            try:
                params = {
                    'external_user_id': external_user_id,
                    'merchant_id': '44',
                    'limit': '50',
                    'mock': '1'
                }
                res = requests.get(f"{base}/knot/amazon/transactions", params=params, timeout=20)
                js = res.json() if res.status_code == 200 else {}
                data = js.get('data') or {}
                return data.get('transactions') or data.get('data', {}).get('transactions') or []
            except Exception:
                return []

        if _is_vague(query):
            # Anthropic-only: construct queries from mock Amazon history
            tx = _fetch_mock_amazon_transactions(external_user_id)
            items_lines = []
            seen = set()
            for t in tx[:30]:
                name = None
                if isinstance(t.get('products'), list) and t['products']:
                    name = t['products'][0].get('name')
                name = name or t.get('description') or 'Purchase'
                key = name.strip().lower()
                if key in seen:
                    continue
                seen.add(key)
                items_lines.append(f"- {name}")
                if len(items_lines) >= 12:
                    break

            picked_queries = []
            try:
                client = get_anthropic_client()
                system_pick = (
                    "You are a shopping assistant. From the user's recent Amazon purchases, pick up to TWO concrete search queries "
                    "(specific product/category + brand/model) that reflect their tastes. Prefer Amazon-relevant queries. "
                    "Return STRICT JSON array of up to 2 strings. No commentary."
                )
                human_pick = (
                    f"User vague request: '{query}'.\nRecent items:\n" + "\n".join(items_lines) + "\n\nQueries JSON:"
                )
                resp = client.messages.create(
                    model=os.getenv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20240620'),
                    max_tokens=200,
                    system=system_pick,
                    messages=[{"role":"user","content":human_pick}],
                )
                txt = resp.content[0].text if getattr(resp, 'content', None) else ''
                arr = json.loads(txt)
                if isinstance(arr, list):
                    picked_queries = [str(x).strip() for x in arr if str(x).strip()][:2]
            except Exception as e:
                logger.warning(f"Anthropic pick failed: {e}")
                picked_queries = []
            if not picked_queries:
                picked_queries = [ln[2:].strip() for ln in items_lines[:2]]

            combined = []
            for pq in picked_queries:
                try:
                    rs = requests.post(f"{base}/dealhunter/claude_search", json={
                        "query": pq, "budget_cents": budget_cents, "max_results": max(1, max_results // max(1,len(picked_queries)))
                    }, timeout=30)
                    js = rs.json() if rs.status_code == 200 else {"items": []}
                    combined.extend(js.get('items', [])[:2])
                except Exception:
                    continue
            return jsonify({"ok": True, "count": len(combined), "items": combined, "rag": {"used": False, "strategy": "anthropic_only_vague"}})

        # Anthropic-only expansion (RAG disabled but preserved in code)
        try:
            client = get_anthropic_client()
            resp = client.messages.create(
                model=os.getenv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20240620'),
                max_tokens=100,
                system=(
                    "You are a shopping assistant that crafts a SEARCH QUERY for a shopping engine. "
                    "Expand the user's query concisely for web search. Prefer trusted merchants (Amazon, Target, Walmart) and reflect likely preferences. "
                    "Return ONLY the expanded query string (10-16 words)."
                ),
                messages=[{"role":"user","content": f"User query: '{query}'. Expanded query only:"}],
            )
            expanded = resp.content[0].text.strip() if getattr(resp, 'content', None) else query
        except Exception as e:
            logger.warning(f"Anthropic expand failed, fallback to original query: {e}")
            expanded = query
        if len(expanded) < 4:
            expanded = query

        base = os.getenv('SELF_BASE_URL') or 'http://localhost:5001'
        rs = requests.post(f"{base}/dealhunter/claude_search", json={
            "query": expanded, "budget_cents": budget_cents, "max_results": max_results
        }, timeout=30)
        out = rs.json()
        out['rag'] = {"used": True, "expanded_query": expanded, "chunks_used": min(8, len(chunks))}
        return jsonify(out), rs.status_code
    except Exception as e:
        logger.error(f"rag_search failed: {e}")
        return jsonify({"error": str(e)}), 500

# Global variables for model and processor
processor = None
model = None
device = "cpu"  # will be updated when torch is available

# LLM client configured for Cerebras-compatible OpenAI API
def _first_env(keys):
    for k in keys:
        v = os.getenv(k)
        if v:
            return v
    return None

def get_llm():
    base_url = _first_env([
        "CEREBRAS_BASE_URL",
        "CEREBRAS_API_BASE",
        "CEREBRAS_URL",
        "OPENAI_BASE_URL",
    ])
    api_key = _first_env([
        "CEREBRAS_API_KEY",
        "CEREBRASAI_API_KEY",
        "CB_API_KEY",
        "OPENAI_API_KEY",
    ])
    if not api_key or not base_url:
        raise RuntimeError("Missing LLM credentials. Set CEREBRAS_BASE_URL and CEREBRAS_API_KEY (or OPENAI_* equivalents) in .env")
    # model name should match Cerebras deployment; fallback to a common instruct model
    model_name = _first_env(["CEREBRAS_MODEL", "OPENAI_MODEL", "MODEL"]) or "llama3.1-8b-instruct"
    return ChatOpenAI(
        model=model_name,
        temperature=0.2,
        api_key=api_key,
        base_url=base_url,
        max_tokens=512,
    )

def get_openai_client():
    base_url = _first_env([
        "CEREBRAS_BASE_URL",
        "CEREBRAS_API_BASE",
        "CEREBRAS_URL",
        "OPENAI_BASE_URL",
    ])
    api_key = _first_env([
        "CEREBRAS_API_KEY",
        "CEREBRASAI_API_KEY",
        "CB_API_KEY",
        "OPENAI_API_KEY",
    ])
    if not api_key or not base_url:
        raise RuntimeError("Missing LLM credentials. Set CEREBRAS_BASE_URL and CEREBRAS_API_KEY in .env")
    return OpenAI(api_key=api_key, base_url=base_url)

def get_anthropic_client():
    key = os.getenv('ANTHROPIC_API_KEY')
    if not key:
        raise RuntimeError('Missing ANTHROPIC_API_KEY')
    if anthropic is None:
        raise RuntimeError('anthropic package not installed')
    return anthropic.Anthropic(api_key=key)

def resolve_available_model(preferred: str | None = None) -> str:
    try:
        client = get_openai_client()
        models = client.models.list()
        ids = [m.id for m in getattr(models, 'data', [])] or []
        if preferred and preferred in ids:
            return preferred
        # Prefer an instruct/chat model if present
        for pat in ["instruct", "chat", "turbo"]:
            for mid in ids:
                if pat in mid:
                    return mid
        # Fallback to first available
        if ids:
            return ids[0]
    except Exception as e:
        logger.warning(f"Could not list models: {e}")
    # Last resort: default
    return preferred or "gpt-3.5-turbo"

def load_model():
    """Load the Whisper model and processor"""
    global processor, model
    try:
        # Import heavy deps only when needed
        global AutoProcessor, AutoModelForSpeechSeq2Seq, torch, librosa, sf, np, device
        if AutoProcessor is None or AutoModelForSpeechSeq2Seq is None:
            from transformers import AutoProcessor as _AutoProcessor, AutoModelForSpeechSeq2Seq as _AutoModelForSpeechSeq2Seq
            AutoProcessor = _AutoProcessor
            AutoModelForSpeechSeq2Seq = _AutoModelForSpeechSeq2Seq
        if torch is None:
            import torch as _torch
            torch = _torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        if librosa is None:
            import librosa as _librosa
            librosa = _librosa
        if sf is None:
            import soundfile as _sf
            sf = _sf
        if np is None:
            import numpy as _np
            np = _np
        logger.info("Loading Whisper model...")
        processor = AutoProcessor.from_pretrained("openai/whisper-small")
        model = AutoModelForSpeechSeq2Seq.from_pretrained("openai/whisper-small")

        # Set device
        model.to(device)
        logger.info(f"Model loaded successfully on {device}")
        
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        raise e

def get_whisper_generation_kwargs(language: str = "en", task: str = "translate"):
    """Return generation kwargs to force Whisper to output in a given language.
    For English-only outputs, use task='translate' which translates non-English to English.
    """
    try:
        # WhisperProcessor provides decoder prompt ids for language/task control
        prompt_ids = processor.get_decoder_prompt_ids(language=language, task=task)
        return {"forced_decoder_ids": prompt_ids}
    except Exception as _:
        # Fallback: no constraints
        return {}

def preprocess_audio(audio_file_path):
    """Preprocess audio file for Whisper model"""
    try:
        # Import only when needed
        global librosa, np
        if librosa is None:
            import librosa as _librosa
            librosa = _librosa
        if np is None:
            import numpy as _np
            np = _np
        # Load audio file
        audio, sample_rate = librosa.load(audio_file_path, sr=16000)
        
        # Convert to numpy array if needed
        if isinstance(audio, np.ndarray):
            audio = audio.astype(np.float32)
        
        return audio, sample_rate
    except Exception as e:
        logger.error(f"Error preprocessing audio: {str(e)}")
        raise e

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "processor_loaded": processor is not None,
        "stt_enabled": not SKIP_WHISPER
    })

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """Transcribe audio file to text"""
    try:
        # Respect environment toggle
        if SKIP_WHISPER:
            return jsonify({"error": "STT disabled"}), 503
        # Check if model is loaded
        if model is None or processor is None:
            return jsonify({"error": "Model not loaded"}), 500
        
        # Check if audio file is provided
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({"error": "No audio file selected"}), 400

        # Basic content-type check (best-effort)
        allowed_mime_prefixes = ("audio/", "application/octet-stream")
        if audio_file.mimetype and not audio_file.mimetype.startswith(allowed_mime_prefixes):
            logger.warning(f"Unexpected mimetype: {audio_file.mimetype}")
        
        # Determine a safe temporary suffix based on filename/mimetype
        original_ext = osp.splitext(audio_file.filename or "")[1].lower()
        fallback_ext = '.webm' if (audio_file.mimetype and 'webm' in audio_file.mimetype) else '.wav'
        tmp_suffix = original_ext if original_ext in ('.wav', '.mp3', '.m4a', '.flac', '.aac', '.ogg', '.webm') else fallback_ext

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=tmp_suffix) as tmp_file:
            audio_file.save(tmp_file.name)
            
            try:
                # Preprocess audio
                audio, sample_rate = preprocess_audio(tmp_file.name)
                
                # Process with Whisper
                inputs = processor(audio, sampling_rate=sample_rate, return_tensors="pt")
                inputs = {k: v.to(device) for k, v in inputs.items()}

                # Generate transcription (force English output)
                gen_kwargs = get_whisper_generation_kwargs(language="en", task="translate")
                with torch.no_grad():
                    predicted_ids = model.generate(inputs["input_features"].to(device), **gen_kwargs)
                
                # Decode the transcription
                transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
                
                return jsonify({
                    "transcription": transcription,
                    "success": True
                })
                
            finally:
                # Clean up temporary file
                os.unlink(tmp_file.name)
                
    except Exception as e:
        logger.error(f"Error in transcription: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/transcribe_url', methods=['POST'])
def transcribe_from_url():
    """Transcribe audio from URL"""
    try:
        # Respect environment toggle
        if SKIP_WHISPER:
            return jsonify({"error": "STT disabled"}), 503
        # Check if model is loaded
        if model is None or processor is None:
            return jsonify({"error": "Model not loaded"}), 500
        
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({"error": "No URL provided"}), 400
        
        audio_url = data['url']
        
        # Download audio file
        import requests
        response = requests.get(audio_url, timeout=30)
        
        if response.status_code != 200:
            return jsonify({"error": "Failed to download audio file"}), 400
        
        # Save downloaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file.write(response.content)
            tmp_file.flush()    
            
            try:
                # Preprocess audio
                audio, sample_rate = preprocess_audio(tmp_file.name)
                
                # Process with Whisper
                inputs = processor(audio, sampling_rate=sample_rate, return_tensors="pt")
                inputs = {k: v.to(device) for k, v in inputs.items()}

                # Generate transcription (force English output)
                gen_kwargs = get_whisper_generation_kwargs(language="en", task="translate")
                with torch.no_grad():
                    predicted_ids = model.generate(inputs["input_features"].to(device), **gen_kwargs)
                
                # Decode the transcription
                transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
                
                return jsonify({
                    "transcription": transcription,
                    "success": True
                })
                
            finally:
                # Clean up temporary file
                os.unlink(tmp_file.name)
                
    except Exception as e:
        logger.error(f"Error in URL transcription: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/llm/chat', methods=['POST'])
def llm_chat():
    try:
        data = request.get_json() or {}
        user_input = data.get('message') or data.get('prompt')
        history = data.get('history') or []
        system_prompt = data.get('system') or (
            "You are Zuno's helpful shopping concierge."
            " Always respond in fluent, clear English."
            " Avoid repetition; be concise and directly helpful."
        )
        if not user_input:
            return jsonify({"error": "Missing 'message' in body"}), 400

        # First attempt with configured/default model
        try:
            llm = get_llm()
            # Build contextual message list from history
            messages = [SystemMessage(content=system_prompt)]
            def _role_of(item: dict) -> str:
                r = (item.get('role') or item.get('sender') or '').lower()
                return 'user' if r in ('user','human') else 'ai'
            # keep last 12 turns for brevity
            items = history[-12:] if isinstance(history, list) else []
            for it in items:
                try:
                    content = (it.get('content') if isinstance(it, dict) else None) or (it.get('message') if isinstance(it, dict) else None) or ''
                    if not content:
                        continue
                    if _role_of(it) == 'user':
                        messages.append(HumanMessage(content=content))
                    else:
                        if AIMessage is not None:
                            messages.append(AIMessage(content=content))
                        else:
                            # Fallback: include assistant text as part of system to preserve context lightly
                            messages.append(SystemMessage(content=f"Assistant said: {content}"))
                except Exception:
                    continue
            messages.append(HumanMessage(content=user_input))
            # Encourage non-repetitive, focused output (Cerebras may not support penalties)
            llm.temperature = 0.3
            llm.max_tokens = 512
            resp = llm.invoke(messages)
            text = resp.content if hasattr(resp, 'content') else str(resp)
            return jsonify({"reply": text})
        except Exception as e:
            msg = str(e)
            if 'model_not_found' in msg or 'does not exist' in msg:
                # Resolve an available model and retry once
                preferred = _first_env(["CEREBRAS_MODEL", "OPENAI_MODEL", "MODEL"]) or None
                selected = resolve_available_model(preferred)
                llm = ChatOpenAI(
                    model=selected,
                    temperature=0.3,
                    api_key=_first_env(["CEREBRAS_API_KEY","CEREBRASAI_API_KEY","CB_API_KEY","OPENAI_API_KEY"]),
                    base_url=_first_env(["CEREBRAS_BASE_URL","CEREBRAS_API_BASE","CEREBRAS_URL","OPENAI_BASE_URL"]),
                    max_tokens=512,
                )
                messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_input)]
                resp = llm.invoke(messages)
                text = resp.content if hasattr(resp, 'content') else str(resp)
                return jsonify({"reply": text, "model": selected})
            raise
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/llm/health', methods=['GET'])
def llm_health():
    try:
        base_url = _first_env(["CEREBRAS_BASE_URL","CEREBRAS_API_BASE","CEREBRAS_URL","OPENAI_BASE_URL"]) or ""
        model_name = _first_env(["CEREBRAS_MODEL","OPENAI_MODEL","MODEL"]) or "llama3.1-8b-instruct"
        # List available models for visibility
        available = []
        try:
            client = get_openai_client()
            models = client.models.list()
            available = [m.id for m in getattr(models, 'data', [])]
        except Exception as e:
            logger.warning(f"Model list failed: {e}")
        return jsonify({"ok": True, "base_url_present": bool(base_url), "model": model_name, "available_models": available})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

def _validate_env_or_exit():
    """Validate required env in non-development modes. In development, warn only."""
    problems = []
    if not _first_env(["CEREBRAS_BASE_URL","CEREBRAS_API_BASE","CEREBRAS_URL","OPENAI_BASE_URL"]):
        problems.append("Missing LLM base URL (CEREBRAS_* or OPENAI_BASE_URL)")
    if not _first_env(["CEREBRAS_API_KEY","CEREBRASAI_API_KEY","CB_API_KEY","OPENAI_API_KEY"]):
        problems.append("Missing LLM API key (CEREBRAS_* or OPENAI_API_KEY)")
    if APP_ENV in ("production", "staging") and problems:
        raise RuntimeError("; ".join(problems))
    if problems:
        logger.warning("ENV warnings: " + "; ".join(problems))

# --------------------------
# Knot integration (proxy)
# --------------------------

def get_knot_base_url() -> str:
    return KNOT_BASE_URL

def knot_headers() -> dict:
    headers = {
        "Content-Type": "application/json"
    }
    return headers

def knot_auth():
    """Return (username, password) tuple for HTTP Basic Auth."""
    return (KNOT_CLIENT_ID or '', KNOT_CLIENT_SECRET or '')

def knot_post(path: str, payload: dict, timeout: int = 30):
    if not KNOT_ENABLED:
        return 503, False, {"error": "Knot disabled: missing credentials"}
    base = get_knot_base_url()
    url = f"{base}{path}"
    headers = knot_headers()
    logger.info(f"Knot API request: {url} with payload: {payload}")
    resp = requests.post(url, json=payload, headers=headers, auth=knot_auth(), timeout=timeout)
    logger.info(f"Knot API response: {resp.status_code} - {resp.text}")
    try:
        data = resp.json()
    except Exception:
        data = {"text": resp.text}
    return resp.status_code, resp.ok, data

def knot_get(path: str, timeout: int = 30):
    if not KNOT_ENABLED:
        return 503, False, {"error": "Knot disabled: missing credentials"}
    base = get_knot_base_url()
    url = f"{base}{path}"
    headers = knot_headers()
    resp = requests.get(url, headers=headers, auth=knot_auth(), timeout=timeout)
    try:
        data = resp.json()
    except Exception:
        data = {"text": resp.text}
    return resp.status_code, resp.ok, data
def _mock_amazon_transactions(limit: int = 10) -> list[dict]:
    now = datetime.utcnow()
    
    # Realistic product names matching frontend analytics.js
    product_names = [
        "Wireless Bluetooth Earbuds",
        "USB-C Fast Charging Cable (6ft)", 
        "Logitech Wireless Mouse M185",
        "Kitchen Towels 6-Pack, Cotton",
        "Home Decor Set",
        "Household Supplies", 
        "Bulk Groceries",
        "Dinner Order",
        "Weekly Groceries",
        "Lunch Order"
    ]
    
    base = [
        {
            "datetime": (now - timedelta(days=i*7)).isoformat() + "Z",
            "description": "Amazon Purchase",
            "merchant": {"id": 44, "name": "Amazon"},
            "price": {"total": f"{19.99 + i:.2f}"},
            "products": [
                {
                    "external_id": f"ASIN{i:03d}",
                    "name": product_names[i-1] if i-1 < len(product_names) else f"Product {i}",
                    "quantity": 1,
                    "price": {"total": f"{19.99 + i:.2f}"},
                    "url": "https://www.amazon.com/dp/B000000000"
                }
            ]
        }
        for i in range(1, max(2, min(limit, 10)) + 1)
    ]
    return base

def _mock_transactions_for_merchant(merchant_id: int, limit: int = 10) -> tuple[list[dict], dict]:
    names = {
        44: "Amazon",
        12: "Target",
        45: "Walmart",
        40: "Instacart",
        19: "DoorDash",
        36: "UberEats",
        165: "Costco",
    }
    mname = names.get(merchant_id, f"Merchant {merchant_id}")
    txns = _mock_amazon_transactions(limit)
    # overwrite merchant fields to requested merchant
    for t in txns:
        t["merchant"] = {"id": merchant_id, "name": mname}
    return txns, {"id": merchant_id, "name": mname}

@app.route('/knot/health', methods=['GET'])
def knot_health():
    return jsonify({"enabled": KNOT_ENABLED, "base_url": KNOT_BASE_URL})

@app.route('/knot/test', methods=['GET'])
def knot_test():
    """Test Knot API connection"""
    try:
        # Try to create a session to test the API with correct format
        session_payload = {
            "type": "card_switcher",
            "external_user_id": "test_user",
            "phone_number": "+11234567890",
            "email": "test@example.com"
        }
        status_code, ok, data = knot_post("/session/create", session_payload)
        
        return jsonify({
            "status": "ok" if ok else "error",
            "status_code": status_code,
            "data": data,
            "base_url": KNOT_BASE_URL
        })
        
    except Exception as e:
        logger.error(f"Knot test error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/knot/session/create', methods=['POST'])
def knot_session_create():
    """Create a Knot session for user authentication"""
    try:
        data = request.get_json() or {}
        # allow caller to override all documented fields
        external_user_id = data.get('external_user_id', '123abc')
        payload = {
            "type": data.get('type', 'transaction_link'),
            "external_user_id": external_user_id,
        }
        # passthrough optional fields if caller provides them
        for key in [
            'card_id', 'phone_number', 'email', 'card', 'processor_token'
        ]:
            if key in data:
                payload[key] = data[key]
        
        status_code, ok, response_data = knot_post("/session/create", payload)
        
        if ok:
            return jsonify({
                "success": True,
                "session": response_data,
                "client_id": KNOT_CLIENT_ID,
                "environment": "development"
            })
        else:
            return jsonify({
                "success": False,
                "error": response_data.get('error', 'Failed to create session'),
                "details": response_data
            }), 400
            
    except Exception as e:
        logger.error(f"Knot session creation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/knot/webhook', methods=['POST'])
def knot_webhook():
    """Handle Knot webhooks for transaction updates"""
    try:
        data = request.get_json() or {}
        logger.info(f"Received Knot webhook: {data}")
        
        # Handle transaction sync webhook
        if data.get('event_type') == 'transactions.sync.completed':
            # Trigger transaction sync after webhook
            session_id = data.get('session_id')
            if session_id:
                # You can add logic here to automatically sync transactions
                # or notify the frontend to trigger a sync
                logger.info(f"Transaction sync completed for session: {session_id}")
        
        return jsonify({"status": "received"})
        
    except Exception as e:
        logger.error(f"Knot webhook error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/knot/amazon/transactions', methods=['GET'])
def get_amazon_transactions():
    """Fetch Amazon transaction history"""
    try:
        # Optional query overrides
        merchant_id = 44  # Force Amazon
        external_user_id = request.args.get('external_user_id', 'zuno_user_123')
        limit = int(request.args.get('limit', 50))
        session_id = request.args.get('session_id')

        # Directly sync transactions without requiring a session
        transaction_payload = {
            "merchant_id": merchant_id,
            "external_user_id": external_user_id,
            "limit": limit
        }
        if session_id:
            transaction_payload["session_id"] = session_id

        status_code, ok, data = knot_post("/transactions/sync", transaction_payload)

        # Allow a mock fallback for development/sandbox or when Knot disabled
        use_mock = request.args.get('mock', '0').lower() in ('1', 'true', 'yes') or (not KNOT_ENABLED)
        if (not ok or not isinstance(data, dict)) and use_mock:
            mock_txns = _mock_amazon_transactions(limit)
            return jsonify({
                "status_code": 200,
                "ok": True,
                "data": {"transactions": mock_txns, "merchant": {"id": 44, "name": "Amazon"}},
                "merchant_id": 44,
                "mock": True
            }), 200

        return jsonify({
            "status_code": status_code,
            "ok": ok,
            "data": data,
            "merchant_id": merchant_id
        }), 200
        
    except Exception as e:
        logger.error(f"Amazon transactions error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/knot/transactions/sync', methods=['POST'])
def knot_transactions_sync():
    try:
        payload = request.get_json() or {}
        status_code, ok, data = knot_post("/transactions/sync", payload)
        return jsonify({
            "status_code": status_code,
            "ok": ok,
            "data": data
        }), (200 if ok else 502)
    except Exception as e:
        logger.error(f"Knot sync error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/knot/merchants', methods=['GET'])
def knot_merchants():
    # Static mapping for quick reference; can be made dynamic later
    return jsonify({
        "merchants": [
            {"id": 44, "name": "Amazon"},
            {"id": 165, "name": "Costco"},
            {"id": 19, "name": "DoorDash"},
            {"id": 40, "name": "Instacart"},
            {"id": 12, "name": "Target"},
            {"id": 36, "name": "UberEats"},
            {"id": 45, "name": "Walmart"},
        ]
    })

# --------------------------
# Product resolver (URL → title/price)
# --------------------------

def _parse_product_url(url: str) -> dict:
    try:
        from urllib.parse import urlparse
        pu = urlparse(url)
        host = (pu.hostname or '').lower().replace('www.', '')
        path = pu.path or ''

        # Amazon
        if 'amazon.' in host:
            m = re.search(r'/(?:gp/product|dp)/([A-Z0-9]{10})', path, flags=re.I) or re.search(r'/([A-Z0-9]{10})(?:[/?]|$)', path, flags=re.I)
            asin = (m.group(1).upper() if m else None)
            return {"merchant_name": "Amazon", "merchant_id": 44, "product_id": asin}
        # Target
        if 'target.com' in host:
            m = re.search(r'/A-(\d+)', path)
            tid = m.group(1) if m else None
            return {"merchant_name": "Target", "merchant_id": 12, "product_id": tid}
        # Walmart
        if 'walmart.com' in host:
            parts = [p for p in path.split('/') if p]
            last = parts[-1] if parts else ''
            m = re.search(r'(\d+)', last)
            wid = m.group(1) if m else None
            return {"merchant_name": "Walmart", "merchant_id": 45, "product_id": wid}
        # Fallback
        return {"merchant_name": host, "merchant_id": None, "product_id": None}
    except Exception:
        return {"merchant_name": None, "merchant_id": None, "product_id": None}


def _extract_title_and_price(html: str, merchant: str | None = None) -> tuple[str | None, float | None]:
    title = None
    price: float | None = None

    try:
        m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html, flags=re.I)
        if m:
            title = m.group(1).strip()
        if not title:
            m = re.search(r'<title>(.*?)</title>', html, flags=re.I | re.S)
            if m:
                title = re.sub(r'\s+', ' ', m.group(1)).strip()
        if title:
            title = htmllib.unescape(title)
    except Exception:
        pass

    # Merchant-specific price extraction first (to avoid unrelated prices on long pages)
    try:
        mname = (merchant or '').lower()
        if 'amazon' in mname:
            # New PDP: apexPriceToPay -> span.a-offscreen
            m = re.search(r'id=\"apexPriceToPay\"[\s\S]*?class=\"a-offscreen\">\s*\$([0-9,]+\.[0-9]{2})', html, flags=re.I)
            if not m:
                m = re.search(r'id=\"corePrice_feature_div\"[\s\S]*?class=\"a-offscreen\">\s*\$([0-9,]+\.[0-9]{2})', html, flags=re.I)
            if not m:
                m = re.search(r'id=\"priceblock_ourprice\"[^>]*>\s*\$([0-9,]+\.[0-9]{2})', html, flags=re.I)
            if not m:
                # JSON offers price
                m = re.search(r'"offers"[\s\S]*?"price"\s*:\s*"([0-9,]+\.[0-9]{2})"', html, flags=re.I)
            if m:
                price = float(m.group(1).replace(',', ''))

        elif 'target' in mname:
            # Embedded JSON has current_retail
            m = re.search(r'"current_retail"\s*:\s*([0-9]+(?:\.[0-9]{2})?)', html, flags=re.I)
            if not m:
                m = re.search(r'"offers"[\s\S]*?"price"\s*:\s*"?([0-9,]+\.?[0-9]{0,2})"?', html, flags=re.I)
            if m:
                price = float(m.group(1).replace(',', ''))
            # Title from embedded product_description.title or JSON-LD Product name
            if not title:
                t = re.search(r'"product_description"[\s\S]*?"title"\s*:\s*"([^"\\]+)"', html, flags=re.I)
                if t:
                    title = htmllib.unescape(t.group(1)).strip()

        elif 'walmart' in mname:
            # priceInfo.currentPrice.price
            m = re.search(r'"priceInfo"[\s\S]*?"currentPrice"[\s\S]*?"price"\s*:\s*([0-9]+(?:\.[0-9]{2})?)', html, flags=re.I)
            if not m:
                m = re.search(r'"currentPrice"[\s\S]*?"price"\s*:\s*([0-9]+(?:\.[0-9]{2})?)', html, flags=re.I)
            if not m:
                # aria-label on price-main
                m = re.search(r'price-main[\s\S]*?aria-label=\"\$([0-9,]+\.[0-9]{2})\"', html, flags=re.I)
            if m:
                price = float(m.group(1).replace(',', ''))
    except Exception:
        pass

    # Generic JSON-LD Offer fallback
    if price is None:
        try:
            m = re.search(r'"@type"\s*:\s*"Offer"[\s\S]*?"price"\s*:\s*"([0-9][\d\.,]*)"', html, flags=re.I)
            if m:
                price = float(m.group(1).replace(',', ''))
        except Exception:
            pass

    # Generic Product title via JSON-LD
    if not title:
        try:
            t = re.search(r'"@type"\s*:\s*"Product"[\s\S]*?"name"\s*:\s*"([^"\\]+)"', html, flags=re.I)
            if t:
                title = htmllib.unescape(t.group(1)).strip()
        except Exception:
            pass

    # Last resort: first visible $xx.xx near product section — very heuristic; avoid if possible
    if price is None:
        try:
            m = re.search(r'\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))', html)
            if m:
                price = float(m.group(1).replace(',', ''))
        except Exception:
            pass

    return title, price

def _extract_og_meta(html: str) -> dict:
    data = {}
    try:
        m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html, flags=re.I)
        if m:
            data['title'] = htmllib.unescape(m.group(1).strip())
    except Exception:
        pass
    try:
        m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html, flags=re.I)
        if m:
            data['image'] = m.group(1).strip()
    except Exception:
        pass
    try:
        m = re.search(r'<meta[^>]+property=["\']product:price:amount["\'][^>]+content=["\']([^"\']+)["\']', html, flags=re.I)
        if m:
            data['price'] = float(m.group(1).replace(',', ''))
    except Exception:
        pass
    try:
        m = re.search(r'<meta[^>]+property=["\']og:price:amount["\'][^>]+content=["\']([^"\']+)["\']', html, flags=re.I)
        if m:
            data['price'] = float(m.group(1).replace(',', ''))
    except Exception:
        pass
    return data


@app.route('/product/resolve', methods=['POST'])
def product_resolve():
    try:
        data = request.get_json() or {}
        url = data.get('url') or data.get('link')
        if not url:
            return jsonify({"error": "missing url"}), 400

        meta = _parse_product_url(url)
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        try:
            resp = requests.get(url, headers=headers, timeout=12)
            html = resp.text if resp.status_code == 200 else ''
        except Exception as e:
            html = ''
            logger.warning(f"Fetch product page failed: {e}")

        title, price = _extract_title_and_price(html, merchant=meta.get('merchant_name'))
        canonical = (f"{meta.get('merchant_id')}:{meta.get('product_id')}" if meta.get('merchant_id') and meta.get('product_id') else url)

        # Persist snapshot if we have a price and a canonical identifier
        try:
            if price is not None and canonical:
                conn = _db_connect()
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO price_history (canonical_id, price_cents, title, fetched_at) VALUES (?, ?, ?, ?)",
                    (canonical, int(round(price * 100)), title, datetime.utcnow().isoformat())
                )
                conn.commit()
                try:
                    conn.close()
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"price_history insert failed: {e}")

        return jsonify({
            "ok": True,
            "merchant_name": meta.get('merchant_name'),
            "merchant_id": meta.get('merchant_id'),
            "product_id": meta.get('product_id'),
            "title": title,
            "price_usd": price,
            "canonical": canonical
        })
    except Exception as e:
        logger.error(f"Product resolve error: {e}")
        return jsonify({"error": str(e)}), 500

# --------------------------
# Deal Hunter: Claude-assisted web search
# --------------------------

def _host_to_merchant(host: str) -> tuple[int | None, str]:
    h = host.lower().replace('www.', '')
    if 'amazon.' in h:
        return 44, 'Amazon'
    if 'walmart.com' in h:
        return 45, 'Walmart'
    if 'target.com' in h:
        return 12, 'Target'
    if 'costco.com' in h:
        return 165, 'Costco'
    if 'instacart.com' in h:
        return 40, 'Instacart'
    return None, h

def _normalize_result(url: str, title: str | None, snippet: str | None, image: str | None, html: str | None) -> dict:
    host = urlparse(url).hostname or ''
    mid, mname = _host_to_merchant(host)
    item = {
        'title': title,
        'url': url,
        'snippet': snippet,
        'image': image,
        'merchant_name': mname,
        'merchant_id': mid,
        'price_usd': None,
        'source': 'search',
    }
    if html:
        og = _extract_og_meta(html)
        if og.get('title') and not item['title']:
            item['title'] = og['title']
        if og.get('image') and not item['image']:
            item['image'] = og['image']
        if og.get('price') is not None:
            item['price_usd'] = og['price']
        # try site-specific price
        t, p = _extract_title_and_price(html, merchant=mname)
        if p is not None:
            item['price_usd'] = p
        if t and not item['title']:
            item['title'] = t
        item['source'] = 'search+og'
    return item

@app.route('/dealhunter/claude_search', methods=['POST'])
def dealhunter_claude_search():
    try:
        data = request.get_json() or {}
        query = (data.get('query') or '').strip()
        budget_cents = data.get('budget_cents')
        max_results = int(data.get('max_results') or 10)
        max_results = max(1, min(max_results, 10))
        if not query:
            return jsonify({"error": "missing query"}), 400

        # Trusted merchant hosts and product URL patterns
        TRUSTED_HOSTS = (
            'amazon.', 'walmart.com', 'target.com'
        )
        def _is_trusted_host(host: str) -> bool:
            h = (host or '').lower()
            return any(k in h for k in TRUSTED_HOSTS)
        def _is_product_like(url: str) -> bool:
            try:
                h = (urlparse(url).hostname or '').lower()
                p = (urlparse(url).path or '')
                if 'amazon.' in h:
                    return bool(re.search(r'/(?:dp|gp/product)/[A-Z0-9]{10}', p, flags=re.I))
                if 'walmart.com' in h:
                    return '/ip/' in p
                if 'target.com' in h:
                    return bool(re.search(r'/A-\d+', p))
            except Exception:
                return False
            return True

        # 1) Web search via Brave (if available)
        brave_key = os.getenv('BRAVE_API_KEY')
        results = []
        if brave_key:
            try:
                headers = {"X-Subscription-Token": brave_key}
                # Constrain query to trusted domains
                site_filter = " (site:amazon.com OR site:walmart.com OR site:target.com)"
                q = query + site_filter if all(s not in query for s in ['site:amazon.com','site:walmart.com','site:target.com']) else query
                r = requests.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    params={"q": q, "count": 20},
                    headers=headers, timeout=8
                )
                if r.status_code == 200:
                    j = r.json() or {}
                    for ent in (j.get('web', {}).get('results') or []):
                        results.append({
                            'title': ent.get('title'),
                            'url': ent.get('url'),
                            'snippet': ent.get('description'),
                            'image': (ent.get('thumbnail') or {}).get('src'),
                        })
            except Exception as e:
                logger.warning(f"Brave search failed: {e}")

        # 1b) Try Brave shopping vertical (richer price metadata)
        if brave_key and not results:
            try:
                headers = {"X-Subscription-Token": brave_key}
                rq = query + " site:amazon.com OR site:walmart.com OR site:target.com"
                rs = requests.get(
                    "https://api.search.brave.com/res/v1/shopping/search",
                    params={"q": rq, "count": 20},
                    headers=headers, timeout=8
                )
                if rs.status_code == 200:
                    sj = rs.json() or {}
                    for ent in (sj.get('shopping_results') or []):
                        results.append({
                            'title': ent.get('title'),
                            'url': ent.get('url'),
                            'snippet': ent.get('description'),
                            'image': ent.get('thumbnail') or ent.get('image'),
                            'price': ent.get('price'),
                        })
            except Exception as e:
                logger.warning(f"Brave shopping failed: {e}")

        # 2) Enrich a subset with OG/meta
        normalized = []
        for ent in results[:20]:
            url = ent.get('url')
            if not url:
                continue
            # drop non-trusted hosts early
            if not _is_trusted_host((urlparse(url).hostname or '')):
                continue
            if not _is_product_like(url):
                continue
            html = None
            try:
                resp = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200 and len(resp.text) < 2_000_000:
                    html = resp.text
            except Exception:
                html = None
            item = _normalize_result(url, ent.get('title'), ent.get('snippet'), ent.get('image'), html)
            # carry over price from shopping response if present
            try:
                sp = ent.get('price')
                if sp and item.get('price_usd') is None:
                    # normalize $1,234.56 or 1234.56
                    val = float(str(sp).replace('$','').replace(',','').strip())
                    item['price_usd'] = val
            except Exception:
                pass
            normalized.append(item)

        # 3) Filter by budget if present
        if budget_cents is not None:
            try:
                b = float(budget_cents) / 100.0
                normalized = [x for x in normalized if (x.get('price_usd') is None or x.get('price_usd') <= b)]
            except Exception:
                pass

        # Prefer items with known price; keep unknowns only if needed to reach max_results
        with_price = [x for x in normalized if isinstance(x.get('price_usd'), (int, float))]
        without_price = [x for x in normalized if x not in with_price]

        # 4) Ask LLM to pick top items (if configured)
        top = []
        if normalized:
            try:
                llm = get_llm()
                system = (
                    "You are Deal Hunter. Use ONLY the provided items and trusted sellers."
                    " TRUSTED_SELLERS: Amazon, Walmart, Target, Newegg, B&H, Adorama, Micro Center, Costco, Apple, Samsung."
                    " Exclude any item not from these sellers."
                    " Do NOT invent data, prices, or images."
                    " Return STRICT JSON array with objects:"
                    "  title (string), url (string), image (string or null), price_usd (number or null),"
                    "  merchant_name (one of: Amazon, Walmart, Target, Newegg, B&H, Adorama, Micro Center, Costco, Apple, Samsung), reason (one short line)."
                    " If price is unknown, set price_usd to null."
                )
                payload = {
                    "query": query,
                    "budget_usd": (float(budget_cents)/100.0 if budget_cents is not None else None),
                    "items": (with_price + without_price)[:20],
                    "trusted_merchants": ["Amazon","Walmart","Target","Newegg","B&H","Adorama","Micro Center","Costco","Apple","Samsung"],
                }
                msg = (
                    "Pick the best deals (max " + str(max_results) + ") from the provided items for the query/budget."
                    " Use only trusted merchants. Prefer lower prices and clear relevance."
                    " Exclude items missing title or url."
                    " Output JSON only."
                    "\n\n" + json.dumps(payload)
                )
                try:
                    resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=msg)])
                except Exception as e:
                    msgstr = str(e)
                    if ('model_not_found' in msgstr) or ('does not exist' in msgstr):
                        # resolve available model and retry
                        sel = resolve_available_model(_first_env(["CEREBRAS_MODEL","OPENAI_MODEL","MODEL"]))
                        llm = ChatOpenAI(
                            model=sel,
                            temperature=0.3,
                            api_key=_first_env(["CEREBRAS_API_KEY","CEREBRASAI_API_KEY","CB_API_KEY","OPENAI_API_KEY"]),
                            base_url=_first_env(["CEREBRAS_BASE_URL","CEREBRAS_API_BASE","CEREBRAS_URL","OPENAI_BASE_URL"]),
                            max_tokens=512,
                        )
                        resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=msg)])
                    else:
                        raise
                text = resp.content if hasattr(resp, 'content') else str(resp)
                try:
                    arr = json.loads(text)
                    if isinstance(arr, list):
                        # Post-validate LLM output
                        safe = []
                        for it in arr:
                            try:
                                u = it.get('url')
                                host = (urlparse(u).hostname or '')
                                if not u or not _is_trusted_host(host):
                                    continue
                                if not it.get('title'):
                                    continue
                                safe.append(it)
                            except Exception:
                                continue
                        top = safe[:max_results]
                except Exception:
                    # Fallback: simple price sort
                    fallback = with_price + without_price
                    fallback.sort(key=lambda x: (x.get('price_usd') if x.get('price_usd') is not None else 1e9))
                    top = fallback[:max_results]
            except Exception as e:
                logger.warning(f"LLM ranking failed: {e}")
                fallback = with_price + without_price
                fallback.sort(key=lambda x: (x.get('price_usd') if x.get('price_usd') is not None else 1e9))
                top = fallback[:max_results]

        return jsonify({"ok": True, "count": len(top), "items": top})
    except Exception as e:
        logger.error(f"claude_search error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-history/list', methods=['GET'])
def price_history_list():
    try:
        canonical_id = request.args.get('canonical_id')
        since_days = int(request.args.get('since_days', '365'))
        if not canonical_id:
            return jsonify({"error": "missing canonical_id"}), 400
        since_dt = datetime.utcnow() - timedelta(days=max(1, since_days))
        conn = _db_connect()
        cur = conn.cursor()
        cur.execute(
            "SELECT fetched_at, price_cents, title FROM price_history WHERE canonical_id = ? AND fetched_at >= ? ORDER BY fetched_at ASC",
            (canonical_id, since_dt.isoformat())
        )
        rows = cur.fetchall()
        try:
            conn.close()
        except Exception:
            pass
        points = [
            {
                "ts": r[0],
                "price_usd": (r[1] / 100.0) if isinstance(r[1], (int, float)) else None,
                "title": r[2],
            } for r in rows
        ]
        return jsonify({"ok": True, "count": len(points), "points": points})
    except Exception as e:
        logger.error(f"price history list error: {e}")
        return jsonify({"error": str(e)}), 500

def _build_url_from_canonical(canonical: str) -> str | None:
    try:
        parts = str(canonical).split(':', 1)
        if len(parts) != 2:
            return None
        mid = int(parts[0])
        pid = parts[1]
        if mid == 44:
            return f"https://www.amazon.com/dp/{pid}"
        if mid == 12:
            return f"https://www.target.com/p/-/A-{pid}"
        if mid == 45:
            return f"https://www.walmart.com/ip/{pid}"
        return None
    except Exception:
        return None

@app.route('/price-history/backfill_wayback', methods=['POST'])
def price_history_backfill_wayback():
    """Backfill historical prices via Wayback Machine snapshots.
    Body: { canonical_id? or url?, months=6, points=10 }
    """
    try:
        body = request.get_json() or {}
        canonical = body.get('canonical_id')
        url = body.get('url')
        months = int(body.get('months', 6))
        points = int(body.get('points', 10))
        points = max(1, min(points, 24))

        if not url and canonical:
            url = _build_url_from_canonical(canonical)
        if not url:
            return jsonify({"error": "missing url or canonical_id"}), 400

        meta = _parse_product_url(url)
        merchant = meta.get('merchant_name') or ''
        canonical_id = canonical or (f"{meta.get('merchant_id')}:{meta.get('product_id')}" if meta.get('merchant_id') and meta.get('product_id') else url)

        # Time window
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=int(months * 30.5))
        start = start_dt.strftime('%Y%m%d')
        end = end_dt.strftime('%Y%m%d')

        # Query Wayback CDX API
        import urllib.parse as up
        cdx_url = (
            f"https://web.archive.org/cdx/search/cdx?url={up.quote(url)}&from={start}&to={end}&output=json&filter=statuscode:200&collapse=digest"
        )
        try:
            resp = requests.get(cdx_url, timeout=15)
            rows = resp.json() if resp.status_code == 200 else []
        except Exception as e:
            return jsonify({"error": f"wayback_cdx_failed: {e}"}), 502
        if not rows or len(rows) <= 1:
            return jsonify({"ok": False, "snapshots": 0, "reason": "no snapshots"}), 200
        entries = rows[1:]
        # Sample evenly across available snapshots
        step = max(1, len(entries) // points)
        sampled = [entries[i] for i in range(0, len(entries), step)][:points]

        inserted = 0
        conn = _db_connect()
        cur = conn.cursor()
        for r in sampled:
            try:
                ts = r[1]
                orig = r[2]
                arch_url = f"https://web.archive.org/web/{ts}id_/{orig}"
                page = requests.get(arch_url, timeout=20)
                if page.status_code != 200:
                    continue
                title, price = _extract_title_and_price(page.text, merchant=merchant)
                if price is None:
                    continue
                # Convert ts (YYYYMMDDhhmmss) to ISO
                dt = datetime.strptime(ts, '%Y%m%d%H%M%S')
                cur.execute(
                    "INSERT INTO price_history (canonical_id, price_cents, title, fetched_at) VALUES (?, ?, ?, ?)",
                    (canonical_id, int(round(price * 100)), title, dt.isoformat())
                )
                inserted += 1
            except Exception as _:
                continue
        conn.commit()
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"ok": True, "inserted": inserted, "snapshots": len(sampled)})
    except Exception as e:
        logger.error(f"price history backfill error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-history/llm_series', methods=['POST'])
def price_history_llm_series():
    """Generate a price series using the configured LLM (Cerebras/OpenAI-compatible).
    Body: { canonical_id? or url?, timeframe: one of ["1D","5D","1M","6M","1Y"], points? }
    Returns: { ok, points: [{ts, price_usd}], llm_generated: true }
    Note: This produces LLM-estimated series, not guaranteed to be factual.
    """
    try:
        body = request.get_json() or {}
        canonical = body.get('canonical_id')
        url = body.get('url')
        timeframe = str(body.get('timeframe') or '6M').upper()
        points = int(body.get('points') or 50)
        points = max(10, min(points, 200))

        if not url and canonical:
            url = _build_url_from_canonical(canonical)
        if not url:
            return jsonify({"error": "missing url or canonical_id"}), 400

        # Try to fetch current price/title for grounding
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        current_title = None
        current_price = None
        try:
            resp = requests.get(url, headers=headers, timeout=12)
            html = resp.text if resp.status_code == 200 else ''
            meta = _parse_product_url(url)
            current_title, current_price = _extract_title_and_price(html, merchant=meta.get('merchant_name'))
        except Exception:
            pass

        # Ask the LLM to produce a JSON array of {ts, price_usd}
        try:
            llm = get_llm()
        except Exception as e:
            return jsonify({"error": f"llm_unavailable: {e}"}), 503

        now_iso = datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
        system_prompt = (
            "You produce realistic price time series for retail products in JSON only."
            " Output strictly a JSON array of objects with keys 'ts' (ISO8601 UTC) and 'price_usd' (number)."
        )
        human_prompt = (
            f"Product URL: {url}\n"
            f"Timeframe: {timeframe}\n"
            f"Points: {points}\n"
            f"Current time (UTC): {now_iso}\n"
            f"Known title (optional): {current_title or ''}\n"
            f"Known current price USD (optional): {current_price if current_price is not None else ''}\n\n"
            "Rules:\n"
            "- Distribute timestamps evenly across the timeframe ending now.\n"
            "- Keep price within plausible retail range and near the known current price when provided.\n"
            "- Return ONLY JSON, no prose."
        )
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)]
        resp = llm.invoke(messages)
        raw = resp.content if hasattr(resp, 'content') else str(resp)
        try:
            data = json.loads(raw)
            series = [
                {"ts": str(p.get('ts')), "price_usd": float(p.get('price_usd'))}
                for p in data if isinstance(p, dict) and p.get('ts') and p.get('price_usd') is not None
            ]
        except Exception:
            # fallback: empty
            series = []
        return jsonify({"ok": True, "points": series, "llm_generated": True})
    except Exception as e:
        logger.error(f"price history llm series error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-history/seed_demo', methods=['POST'])
def price_history_seed_demo():
    try:
        body = request.get_json() or {}
        days = int(body.get('days', 365))
        num_points = int(body.get('points', 36))
        jitter_pct = float(body.get('jitter_pct', 0.2))  # +/- 20%
        external_user_id = body.get('external_user_id')

        conn = _db_connect()
        cur = conn.cursor()
        if external_user_id:
            cur.execute("SELECT id, canonical_id, note FROM price_watch WHERE external_user_id = ?", (external_user_id,))
        else:
            cur.execute("SELECT id, canonical_id, note FROM price_watch")
        rows = cur.fetchall()
        watches = [(r[0], r[1], r[2]) for r in rows if r[1]]

        if not watches:
            try:
                conn.close()
            except Exception:
                pass
            return jsonify({"ok": True, "seeded": 0, "reason": "no watches"})

        now = datetime.utcnow()
        seeded = 0
        for _, canonical, note in watches:
            # Choose a realistic base price
            base = random.uniform(20.0, 400.0)
            # Pick a gentle long-term drift: slight downtrend or flat
            trend_direction = random.choice([-1, 0])
            drift_pct = 0.03 if trend_direction == -1 else 0.0  # up to ~3% decline over the year
            # Seasonal amplitude small to avoid big swings
            seasonal_amp = random.uniform(0.01, 0.05)  # 1% - 5%
            # One-time sale drop somewhere in the series
            sale_idx = random.randint(int(num_points * 0.3), int(num_points * 0.9)) if num_points >= 10 else None
            sale_drop_pct = random.uniform(0.05, 0.15)  # 5% - 15%

            for i in range(num_points):
                t = i / max(1, num_points - 1)
                # Long-term drift (monotonic slight decline if chosen)
                drift = (1.0 - drift_pct * t)
                # Mild seasonal pattern
                seasonal = 1.0 + seasonal_amp * math.sin(2.0 * math.pi * t)
                price = base * drift * seasonal
                # Occasional small noise (very mild)
                price *= (1.0 + min(0.02, jitter_pct) * (random.random() - 0.5))
                # Apply a single sale drop point to make it look real
                if sale_idx is not None and i == sale_idx:
                    price *= (1.0 - sale_drop_pct)

                ts = (now - timedelta(days=int(days * (1.0 - t)))).isoformat()
                cur.execute(
                    "INSERT INTO price_history (canonical_id, price_cents, title, fetched_at) VALUES (?, ?, ?, ?)",
                    (canonical, int(round(max(1.0, price) * 100)), note, ts)
                )
                seeded += 1
        conn.commit()
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"ok": True, "seeded": seeded})
    except Exception as e:
        logger.error(f"price history seed demo error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/optimize/payment', methods=['POST'])
def optimize_payment():
    """Stub rewards optimizer.
    Input: { merchant_id, amount_cents?, category? }
    Output: { recommended_payment_method, rationale }
    """
    try:
        data = request.get_json() or {}
        merchant_id = data.get('merchant_id')
        amount_cents = data.get('amount_cents', None)
        # Placeholder scoring: choose brand by merchant category heuristics
        brand = 'VISA'
        if merchant_id in [12, 45]:
            brand = 'MASTERCARD'  # big-box
        elif merchant_id in [44]:
            brand = 'AMEX'  # amazon sometimes offers promos
        rationale = f"Based on merchant #{merchant_id} and typical category multipliers, {brand} likely maximizes rewards."
        return jsonify({
            "recommended_payment_method": {"brand": brand},
            "rationale": rationale
        })
    except Exception as e:
        logger.error(f"Optimize error: {e}")
        return jsonify({"error": str(e)}), 500

# --------------------------
# Subscriptions auditor (scaffold)
# --------------------------

def _parse_dt(value: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat((value or "").replace("Z", "+00:00"))
        # Ensure timezone-aware in UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None

def _detect_recurring(transactions: list[dict]) -> list[dict]:
    """Very simple heuristic: same merchant/product names appearing with ~monthly cadence."""
    by_key: dict[str, list[datetime]] = defaultdict(list)
    for t in transactions:
        dt = _parse_dt(t.get("datetime") or t.get("ts") or "")
        if not dt:
            continue
        merchant_name = None
        m = t.get("merchant") or {}
        if isinstance(m, dict):
            merchant_name = m.get("name")
        else:
            merchant_name = str(m)
        # prefer product-level recurrence if products present
        prods = t.get("products") or []
        if prods:
            for p in prods:
                key = f"prod::{merchant_name or ''}::{p.get('name','')}"
                by_key[key].append(dt)
        else:
            key = f"merchant::{merchant_name or ''}"
            by_key[key].append(dt)

    candidates = []
    for key, dates in by_key.items():
        if len(dates) < 2:
            continue
        dates.sort()
        gaps = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
        if not gaps:
            continue
        avg_gap = sum(gaps) / len(gaps)
        # monthly-ish cadence between 25 and 35 days
        if 25 <= avg_gap <= 35:
            candidates.append({
                "key": key,
                "occurrences": len(dates),
                "avg_gap_days": avg_gap,
            })
    return candidates

@app.route('/subscriptions/audit', methods=['POST'])
def subscriptions_audit():
    try:
        data = request.get_json() or {}
        external_user_id = data.get('external_user_id', 'demo')
        merchants = data.get('merchants') or [44, 12, 45, 40, 19, 36, 165]
        limit = int(data.get('limit', 50))
        lookback_days = int(data.get('lookback_days', 90))
        since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        all_txns = []
        for mid in merchants:
            txns = []
            if KNOT_ENABLED:
                status, ok, resp = knot_post("/transactions/sync", {
                    "merchant_id": mid,
                    "external_user_id": external_user_id,
                })
                if ok and isinstance(resp, dict):
                    txns = (resp.get("transactions") or resp.get("data", {}).get("transactions") or [])
            else:
                txns, _ = _mock_transactions_for_merchant(mid, limit)
            for t in txns:
                dt = _parse_dt(t.get("datetime") or t.get("ts") or "")
                if not dt or dt >= since_dt:
                    all_txns.append(t)

        candidates = _detect_recurring(all_txns)
        return jsonify({
            "total_transactions": len(all_txns),
            "candidates": candidates
        })
    except Exception as e:
        logger.error(f"Subscriptions audit error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/subscriptions/cancel_draft', methods=['POST'])
def subscriptions_cancel_draft():
    """Generate a cancel email draft for a subscription candidate.
    Input: { merchant_name, product_name?, external_user_id? }
    Output: { subject, body }
    """
    try:
        data = request.get_json() or {}
        merchant = (data.get('merchant_name') or '').strip() or 'Your Service'
        product = (data.get('product_name') or '').strip()
        user = (data.get('external_user_id') or 'customer').strip()
        subject = f"Request to cancel {product or merchant} subscription"
        body_lines = [
            f"Hello {merchant} Support,",
            "",
            f"I'd like to cancel my subscription to {product or merchant} effective immediately.",
            "Please confirm the cancellation and any applicable refund per your policy.",
            "",
            f"Account/Name: {user}",
            "",
            "Thank you,",
            user,
        ]
        return jsonify({"subject": subject, "body": "\n".join(body_lines)})
    except Exception as e:
        logger.error(f"Cancel draft error: {e}")
        return jsonify({"error": str(e)}), 500

#############################
# SQLite: price watch storage
#############################

def _db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    try:
        conn = _db_connect()
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS price_watch (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                external_user_id TEXT NOT NULL,
                order_id TEXT,
                canonical_id TEXT,
                target_price_cents INTEGER,
                window_days INTEGER,
                note TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        # matches table for watch hits
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS price_watch_match (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                watch_id INTEGER NOT NULL,
                found_price_cents INTEGER,
                details TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(watch_id) REFERENCES price_watch(id)
            );
            """
        )
        # price history snapshots
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                canonical_id TEXT NOT NULL,
                price_cents INTEGER NOT NULL,
                title TEXT,
                fetched_at TEXT NOT NULL
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_price_history_canonical ON price_history(canonical_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_price_history_time ON price_history(fetched_at)")
        conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass

def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}

def _evaluate_watches_once(limit_per_merchant: int = 10) -> int:
    """Evaluate watches against latest transaction data (mock if Knot disabled).
    For demo: if any transaction with a numeric total <= target_price matches same merchant namespace in canonical_id, record a match.
    Returns number of matches created.
    """
    conn = _db_connect()
    cur = conn.cursor()
    cur.execute("SELECT * FROM price_watch")
    watches = [dict(row) for row in cur.fetchall()]

    match_count = 0
    for w in watches:
        target_cents = w.get('target_price_cents')
        canonical = (w.get('canonical_id') or '')
        # infer merchant id from canonical like "<mid>:<external_id>"
        parts = canonical.split(':', 1)
        try:
            mid = int(parts[0]) if len(parts) == 2 else 44
        except Exception:
            mid = 44
        # fetch recent txns (mock or real)
        txns = []
        if KNOT_ENABLED:
            status, ok, resp = knot_post('/transactions/sync', {
                'merchant_id': mid,
                'external_user_id': w.get('external_user_id', 'abc'),
                'limit': limit_per_merchant,
            })
            if ok and isinstance(resp, dict):
                body = resp if 'transactions' in resp else resp.get('data', {})
                txns = body.get('transactions') or []
        else:
            txns, _ = _mock_transactions_for_merchant(mid, limit_per_merchant)
        # evaluate simple rule
        def _parse_total(t) -> int | None:
            try:
                s = (t.get('price') or {}).get('total')
                if s is None:
                    return None
                return int(round(float(s) * 100))
            except Exception:
                return None
        for t in txns:
            cents = _parse_total(t)
            if cents is None:
                continue
            if target_cents is not None and cents <= int(target_cents):
                # record a match
                cur.execute(
                    "INSERT INTO price_watch_match (watch_id, found_price_cents, details, created_at) VALUES (?, ?, ?, ?)",
                    (w['id'], cents, json.dumps({'txn': t}), datetime.utcnow().isoformat())
                )
                conn.commit()
                match_count += 1
                break  # one hit per watch per run
    try:
        conn.close()
    except Exception:
        pass
    return match_count

@app.route('/price-protection/watch', methods=['POST'])
def price_protection_watch():
    """Create a price watch (backwards-compatible endpoint)."""
    try:
        payload = request.get_json() or {}
        external_user_id = payload.get('external_user_id') or 'demo'
        order_id = payload.get('order_id')
        canonical_id = payload.get('canonical_id')
        target_price_cents = payload.get('target_price_cents')
        window_days = payload.get('window_days')
        note = payload.get('note')
        created_at = datetime.utcnow().isoformat()

        conn = _db_connect()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO price_watch (external_user_id, order_id, canonical_id, target_price_cents, window_days, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (external_user_id, order_id, canonical_id, target_price_cents, window_days, note, created_at)
        )
        conn.commit()
        new_id = cur.lastrowid
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"ok": True, "watch_id": new_id})
    except Exception as e:
        logger.error(f"Price watch error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-protection/list', methods=['GET'])
def price_protection_list():
    """List price watches, optionally filtered by external_user_id via query param."""
    try:
        external_user_id = request.args.get('external_user_id')
        conn = _db_connect()
        cur = conn.cursor()
        if external_user_id:
            cur.execute("SELECT * FROM price_watch WHERE external_user_id = ? ORDER BY id DESC", (external_user_id,))
        else:
            cur.execute("SELECT * FROM price_watch ORDER BY id DESC")
        rows = cur.fetchall()
        watches = [_row_to_dict(r) for r in rows]
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"watches": watches})
    except Exception as e:
        logger.error(f"Price watch list error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-protection/check', methods=['POST'])
def price_protection_check():
    try:
        created = _evaluate_watches_once()
        return jsonify({"ok": True, "matches_created": created})
    except Exception as e:
        logger.error(f"Price watch check error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-protection/matches', methods=['GET'])
def price_protection_matches():
    try:
        external_user_id = request.args.get('external_user_id')
        conn = _db_connect()
        cur = conn.cursor()
        if external_user_id:
            cur.execute(
                "SELECT m.* FROM price_watch_match m JOIN price_watch w ON m.watch_id = w.id WHERE w.external_user_id = ? ORDER BY m.id DESC",
                (external_user_id,)
            )
        else:
            cur.execute("SELECT * FROM price_watch_match ORDER BY id DESC")
        rows = cur.fetchall()
        matches = [_row_to_dict(r) for r in rows]
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"matches": matches})
    except Exception as e:
        logger.error(f"Price watch matches error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-protection/watch/<int:watch_id>', methods=['GET'])
def price_protection_get(watch_id: int):
    try:
        conn = _db_connect()
        cur = conn.cursor()
        cur.execute("SELECT * FROM price_watch WHERE id = ?", (watch_id,))
        row = cur.fetchone()
        try:
            conn.close()
        except Exception:
            pass
        if not row:
            return jsonify({"error": "not_found"}), 404
        return jsonify({"watch": _row_to_dict(row)})
    except Exception as e:
        logger.error(f"Price watch get error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-protection/watch/<int:watch_id>', methods=['DELETE'])
def price_protection_delete(watch_id: int):
    try:
        conn = _db_connect()
        cur = conn.cursor()
        cur.execute("DELETE FROM price_watch WHERE id = ?", (watch_id,))
        deleted = cur.rowcount
        conn.commit()
        try:
            conn.close()
        except Exception:
            pass
        if deleted == 0:
            return jsonify({"error": "not_found"}), 404
        return jsonify({"ok": True, "deleted": deleted})
    except Exception as e:
        logger.error(f"Price watch delete error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/price-protection/watch/<int:watch_id>', methods=['PATCH', 'PUT'])
def price_protection_update(watch_id: int):
    try:
        payload = request.get_json() or {}
        # Allowed updatable fields
        allowed = [
            'order_id', 'canonical_id', 'target_price_cents', 'window_days', 'note', 'external_user_id'
        ]
        fields = []
        values = []
        for k in allowed:
            if k in payload:
                fields.append(f"{k} = ?")
                values.append(payload[k])
        if not fields:
            return jsonify({"error": "no_fields_to_update"}), 400
        values.append(watch_id)
        conn = _db_connect()
        cur = conn.cursor()
        cur.execute(f"UPDATE price_watch SET {', '.join(fields)} WHERE id = ?", tuple(values))
        updated = cur.rowcount
        conn.commit()
        if updated == 0:
            try:
                conn.close()
            except Exception:
                pass
            return jsonify({"error": "not_found"}), 404
        # Return updated row
        cur.execute("SELECT * FROM price_watch WHERE id = ?", (watch_id,))
        row = cur.fetchone()
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"watch": _row_to_dict(row)})
    except Exception as e:
        logger.error(f"Price watch update error: {e}")
        return jsonify({"error": str(e)}), 500

# --------------------------
# Deal Hunter (using Knot data)
# --------------------------

def _normalize_products_from_knot(txns: list[dict], merchant: dict) -> list[dict]:
    products: list[dict] = []
    mname = (merchant or {}).get('name')
    mid = (merchant or {}).get('id')
    for t in txns:
        prods = t.get('products') or []
        adjustments = (t.get('price') or {}).get('adjustments') or []
        has_discount = any(a.get('type') == 'DISCOUNT' for a in adjustments)
        for p in prods:
            price_info = p.get('price') or {}
            # prefer 'total' then 'sub_total' then unit_price * quantity
            total = None
            if isinstance(price_info.get('total'), str):
                try:
                    total = float(price_info.get('total'))
                except Exception:
                    total = None
            if total is None and isinstance(price_info.get('sub_total'), str):
                try:
                    total = float(price_info.get('sub_total'))
                except Exception:
                    total = None
            if total is None:
                try:
                    unit = float(price_info.get('unit_price')) if price_info.get('unit_price') else None
                    qty = float(p.get('quantity') or 1)
                    if unit is not None:
                        total = unit * qty
                except Exception:
                    total = None

            products.append({
                "external_id": p.get('external_id'),
                "title": p.get('name'),
                "url": p.get('url'),
                "merchant_id": mid,
                "merchant": mname,
                "quantity": p.get('quantity'),
                "price_total": total,
                "has_discount": has_discount,
            })
    return products

def _keyword_match(title: str, query: str) -> bool:
    if not query:
        return True
    if not title:
        return False
    qwords = [w.strip().lower() for w in query.split() if w.strip()]
    t = title.lower()
    return all(w in t for w in qwords)

@app.route('/dealhunter/search', methods=['POST'])
def dealhunter_search():
    try:
        data = request.get_json() or {}
        query = data.get('query', '')
        budget_cents = data.get('budget_cents')
        merchants = data.get('merchants') or [44, 12, 45]  # Amazon, Target, Walmart
        limit = int(data.get('limit', 20))
        explain = bool(data.get('explain', False))
        explain_top_k = int(data.get('explain_top_k', 3))
        want_mock = bool(data.get('mock', False)) or (not KNOT_ENABLED)

        # Fan out to Knot for each merchant (small N sequential for simplicity)
        all_products: list[dict] = []
        for mid in merchants:
            if want_mock:
                txns, m_info = _mock_transactions_for_merchant(mid, 10)
                prods = _normalize_products_from_knot(txns, m_info)
                all_products.extend(prods)
            else:
                status, ok, resp = knot_post('/transactions/sync', {
                    "merchant_id": mid,
                    "external_user_id": data.get('external_user_id', 'abc'),
                    "limit": 10,
                })
                if not ok or not isinstance(resp, dict):
                    continue
                body = resp if 'transactions' in resp else resp.get('data', {})
                txns = body.get('transactions') or []
                merchant_info = body.get('merchant') or {"id": mid}
                prods = _normalize_products_from_knot(txns, merchant_info)
                all_products.extend(prods)

        # Deduplicate by (merchant_id, external_id)
        dedup = {}
        for p in all_products:
            key = f"{p.get('merchant_id')}::{p.get('external_id')}"
            if key not in dedup:
                dedup[key] = p

        items = list(dedup.values())

        # Filter by keyword and budget
        items = [p for p in items if _keyword_match(p.get('title') or '', query)]
        if budget_cents is not None:
            try:
                budget = float(budget_cents) / 100.0
                items = [p for p in items if (p.get('price_total') is None or p.get('price_total') <= budget)]
            except Exception:
                pass

        # Score: cheaper first, discount preferred
        def score(p: dict):
            base = p.get('price_total') if p.get('price_total') is not None else 1e9
            discount_bonus = -50.0 if p.get('has_discount') else 0.0
            return base + discount_bonus

        items.sort(key=score)
        items = items[:limit]

        # Optional LLM explanations for top K
        if explain and items:
            try:
                llm = get_llm()
                k = min(len(items), max(0, explain_top_k))
                for i in range(k):
                    it = items[i]
                    title = it.get('title') or ''
                    price = it.get('price_total')
                    merchant = it.get('merchant')
                    user_query = query or 'general deal'
                    system_prompt = (
                        "You are Zuno's helpful shopping concierge. Always reply in clear English."
                        " Provide a short, 1-2 sentence justification why this item is a good pick,"
                        " based on the user's query, price and any discount signals. Avoid repetition."
                    )
                    messages = [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=(
                            f"User query: {user_query}. Item: '{title}' from {merchant}. "
                            f"Approx price: {price if price is not None else 'unknown'}. "
                            "Give a concise reason to pick this item."
                        )),
                    ]
                    try:
                        resp = llm.invoke(messages)
                        text = resp.content if hasattr(resp, 'content') else str(resp)
                        it['explanation'] = text
                    except Exception as _e:
                        # Skip explanation on failure
                        it['explanation'] = None
            except Exception as _outer:
                # If LLM is unavailable, proceed without explanations
                pass

        return jsonify({
            "count": len(items),
            "query": query,
            "items": items
        })
    except Exception as e:
        logger.error(f"Dealhunter error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/purchase/preview', methods=['POST'])
def purchase_preview():
    try:
        data = request.get_json() or {}
        canonical_id = data.get('canonical_id')
        url = data.get('url')
        qty = int(data.get('qty') or 1)
        address_id = data.get('address_id') or 'addr_demo_1'
        payment_id = data.get('payment_id') or 'pay_demo_1'

        # Resolve product meta (best-effort)
        title = None
        image = None
        price_usd = None
        merchant = None
        if url:
            try:
                meta_res = requests.post(f"{request.host_url.rstrip('/')}/product/resolve", json={"url": url}, timeout=20)
                meta = meta_res.json() if meta_res.status_code == 200 else {}
                if meta.get('ok'):
                    title = meta.get('title')
                    image = meta.get('image')
                    price_usd = meta.get('price_usd')
                    merchant = meta.get('merchant_name')
                    canonical_id = meta.get('canonical') or canonical_id
            except Exception:
                pass
        merchant = merchant or 'Amazon'
        title = title or 'Item'
        price_usd = float(price_usd) if isinstance(price_usd, (int, float, str)) and str(price_usd) else 29.99
        subtotal = price_usd * qty
        shipping = 0.00 if subtotal >= 35 else 4.99
        tax = round(subtotal * 0.08, 2)
        total = round(subtotal + shipping + tax, 2)

        preview_token = f"prev_{int(datetime.utcnow().timestamp())}_{random.randint(1000,9999)}"
        payload = {
            "ok": True,
            "preview_token": preview_token,
            "merchant": merchant,
            "item": {
                "title": title,
                "image": image,
                "canonical_id": canonical_id or url or "unknown",
                "unit_price_usd": round(price_usd, 2),
                "qty": qty,
            },
            "fees": {"shipping": shipping, "tax": tax},
            "total_usd": total,
            "ship_to": {"address_id": address_id},
            "pay_with": {"payment_id": payment_id},
            "expires_in_sec": 180,
        }
        return jsonify(payload)
    except Exception as e:
        logger.error(f"purchase_preview error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/purchase/confirm', methods=['POST'])
def purchase_confirm():
    try:
        data = request.get_json() or {}
        token = data.get('preview_token')
        if not token:
            return jsonify({"error": "missing preview_token"}), 400
        # In real flow: validate token, run checkout with merchant/Knot
        order_id = f"ord_{int(datetime.utcnow().timestamp())}_{random.randint(1000,9999)}"
        return jsonify({"ok": True, "order_id": order_id, "status": "PLACED", "placed_at": datetime.utcnow().isoformat() + "Z"})
    except Exception as e:
        logger.error(f"purchase_confirm error: {e}")
        return jsonify({"error": str(e)}), 500

# Tool schemas (for future function-calling LLMs)
PURCHASE_TOOLS = {
    "purchase_preview": {
        "description": "Create a purchase preview for an item before checkout.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Product URL if available"},
                "canonical_id": {"type": "string", "description": "Canonical id like 44:ASIN or 12:A-xxxxx"},
                "qty": {"type": "integer", "minimum": 1, "default": 1},
                "address_id": {"type": "string"},
                "payment_id": {"type": "string"}
            },
            "required": [],
            "additionalProperties": False
        }
    },
    "purchase_confirm": {
        "description": "Confirm a previously created purchase preview.",
        "parameters": {
            "type": "object",
            "properties": {
                "preview_token": {"type": "string"}
            },
            "required": ["preview_token"],
            "additionalProperties": False
        }
    }
}

if __name__ == '__main__':
    # Load model on startup unless disabled via env toggle
    if not SKIP_WHISPER:
        load_model()
    # Ensure database schema exists
    try:
        init_db()
    except Exception as e:
        logger.error(f"DB init failed: {e}")
    # Validate env
    try:
        _validate_env_or_exit()
    except Exception as e:
        logger.error(f"Startup env validation failed: {e}")
        raise
    # Start background scheduler
    scheduler = None
    if SCHED_ENABLED:
        try:
            scheduler = BackgroundScheduler(daemon=True)
            scheduler.add_job(_evaluate_watches_once, 'interval', minutes=SCHED_INTERVAL_MIN, max_instances=1, id='watch_eval')
            scheduler.start()
            logger.info(f"Scheduler started (every {SCHED_INTERVAL_MIN} minutes)")
        except Exception as e:
            logger.error(f"Scheduler failed to start: {e}")
    # Run the Flask app (no reloader by default for background runs)
    app.run(debug=DEBUG, host=HOST, port=PORT, use_reloader=USE_RELOADER, threaded=True)
