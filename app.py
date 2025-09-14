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
from openai import OpenAI
import requests
import re
import html as htmllib
import json
import random
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from apscheduler.schedulers.background import BackgroundScheduler

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

# Knot API Configuration (no hardcoded secrets)
KNOT_CLIENT_ID = os.getenv('KNOT_CLIENT_ID')
KNOT_CLIENT_SECRET = os.getenv('KNOT_CLIENT_SECRET')
KNOT_BASE_URL = os.getenv('KNOT_BASE_URL', 'https://development.knotapi.com')
KNOT_API_KEY = os.getenv('KNOT_API_KEY')
KNOT_ENABLED = bool(KNOT_CLIENT_ID and KNOT_CLIENT_SECRET)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_input)]
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
    base = [
        {
            "datetime": (now - timedelta(days=i*7)).isoformat() + "Z",
            "description": "Amazon Purchase",
            "merchant": {"id": 44, "name": "Amazon"},
            "price": {"total": f"{19.99 + i:.2f}"},
            "products": [
                {
                    "external_id": f"ASIN{i:03d}",
                    "name": f"Sample Item {i}",
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
            base = random.uniform(20.0, 400.0)
            for i in range(num_points):
                # Spread points across the window, add sine wave + random jitter
                t = i / max(1, num_points - 1)
                price = base * (1.0 + 0.1 * (random.random() - 0.5) + 0.15 * (2.0 * (t - 0.5)))
                price *= (1.0 + jitter_pct * (random.random() - 0.5))
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
