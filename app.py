from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
import torch
import librosa
import soundfile as sf
import numpy as np
import os
from dotenv import load_dotenv
import tempfile
import logging
import os.path as osp
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from openai import OpenAI

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Global variables for model and processor
processor = None
model = None
device = "cuda" if torch.cuda.is_available() else "cpu"

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
        "processor_loaded": processor is not None
    })

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """Transcribe audio file to text"""
    try:
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

if __name__ == '__main__':
    # Load model on startup
    load_model()
    
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5001)
