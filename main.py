from flask import Flask, render_template, request, jsonify
from PIL import Image
import pytesseract
import io
import base64
# import cv2
# import numpy as np
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

def do_ocr(img):
    try:
        custom_config = r'--oem 1 --psm 6 -c tessedit_char_whitelist=0123456789'
        text = pytesseract.image_to_string(img, config=custom_config)
        digits_only = ''.join(filter(str.isdigit, text))
        return digits_only
    except Exception as e:
        raise Exception("Something in OCR error: " + e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/display')
def display():
    number = request.form.get('number')  # get the number from the POST form
    return render_template('display_result.html', number=number)

@app.route('/upload', methods=['POST'])
def upload():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        img = Image.open(io.BytesIO(file.read()))
        # Digits only config
        
        digits_only = do_ocr(img)
        return jsonify({'result': digits_only})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('image')
def handle_image(data_url):
    # Remove header from base64 string
    header, encoded = data_url.split(",", 1)
    img_bytes = base64.b64decode(encoded)
    img = Image.open(io.BytesIO(img_bytes))

    # Do your OCR here, dummy example:
    # print("Receive image")

    try:
        result = do_ocr(img)
        emit("ack", {"status": "ok", "result": result})
        emit("ocr_result", {"text": result})
    except Exception as e:
        emit("ack", {"status": "error"})

@socketio.on('test')
def handle_image(data):
    print("Receive image", data)

    result = "Example OCR Result"
    # emit('ocr_result', {'text': result})  # Send back to client


if __name__ == '__main__':
    socketio.run(app, debug=True)