import os
import io
import joblib
import numpy as np
import json
import pandas as pd
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'default_fallback_key')

# --- 配置：请将下面的 URL 替换为你 GCS 中的实际公共 URL ---
MODEL_URL = "https://storage.googleapis.com/deaf-blind-assistant-bucket/sign_model.pkl"
SCALER_URL = "https://storage.googleapis.com/deaf-blind-assistant-bucket/scaler.pkl"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "normalized_sign_data.csv")

# 全局缓存模型，避免每次请求都重复下载
_cached_model = None
_cached_scaler = None

def load_ml_models():
    global _cached_model, _cached_scaler
    if _cached_model is None or _cached_scaler is None:
        try:
            # 从云端下载模型数据
            model_res = requests.get(MODEL_URL, timeout=30)
            scaler_res = requests.get(SCALER_URL, timeout=30)
            
            if model_res.status_code == 200 and scaler_res.status_code == 200:
                # 使用 io.BytesIO 将二进制内容转换成文件对象，供 joblib 加载
                _cached_model = joblib.load(io.BytesIO(model_res.content))
                _cached_scaler = joblib.load(io.BytesIO(scaler_res.content))
            else:
                print(f"Failed to fetch models. Status: {model_res.status_code}")
                return None, None
        except Exception as e:
            print(f"Error loading models from cloud: {e}")
            return None, None
            
    return _cached_model, _cached_scaler

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/translator')
def translator():
    return render_template('translate.html')

@app.route('/generator')
def generator():
    return render_template('generator.html')

@app.route('/voice-translator')
def voice_translator():
    return render_template('voice_translate.html')

@app.route('/translate-sign', methods=['POST'])
def translate():
    try:
        model, scaler = load_ml_models()
        if model is None or scaler is None:
            return jsonify({"status": "error", "message": "ML Model could not be loaded."})
            
        data = request.json
        landmarks_list = data.get('landmarks', [])
        if len(landmarks_list) != 84:
            return jsonify({"status": "error", "message": f"Expected 84 features, got {len(landmarks_list)}"})
            
        flat_landmarks = np.array(landmarks_list).reshape(1, -1)
        scaled_features = scaler.transform(flat_landmarks)
        prediction = model.predict(scaled_features)[0]
        
        return jsonify({"status": "success", "translated_text": str(prediction)})
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/get-sign-sequence', methods=['POST'])
def get_sign_sequence():
    data = request.json
    word = data.get('text', '').lower().strip()
    if not word:
        return jsonify({"status": "error", "message": "No text provided."})

    # 首先尝试从本地 json 文件夹加载
    sign_path = os.path.join(BASE_DIR, "signs", f"{word}.json")
    if os.path.exists(sign_path):
        try:
            with open(sign_path, 'r') as f:
                sequence = json.load(f)
            return jsonify({"status": "success", "sequence": sequence})
        except Exception:
            pass
        
    # 如果没有，则尝试从 CSV 加载
    if os.path.exists(CSV_FILE):
        try:
            df = pd.read_csv(CSV_FILE, header=None, engine='c')
            matches = df[df.iloc[:, 0].astype(str).str.lower() == word]
            if not matches.empty:
                sequence = matches.iloc[:, 1:].values.tolist()
                return jsonify({"status": "success", "sequence": sequence})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Error: {str(e)}"})

    return jsonify({"status": "error", "message": "Sign not found."})

if __name__ == '__main__':
    app.run(debug=False)