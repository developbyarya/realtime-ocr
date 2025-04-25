import cv2
import pytesseract
import time

# OPTIONAL: Path to tesseract if not in PATH
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Available preprocessing methods
def preprocess(frame, method):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    if method == "none":
        return gray
    elif method == "threshold":
        return cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)[1]
    elif method == "adaptive":
        return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY, 11, 2)
    elif method == "blur":
        return cv2.GaussianBlur(gray, (5, 5), 0)
    elif method == "morph":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        return cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    else:
        return gray

methods = ["none", "threshold", "adaptive", "blur", "morph"]
method_index = 0

cap = cv2.VideoCapture(0)

custom_config = r'--oem 1 --psm 6 -c tessedit_char_whitelist=0123456789'

while True:
    ret, frame = cap.read()
    if not ret:
        break

    processed = preprocess(frame, methods[method_index])
    ocr_result = pytesseract.image_to_string(processed, config=custom_config)

    # Display OCR text
    display_frame = frame.copy()
    cv2.putText(display_frame, f"OCR ({methods[method_index]}): {ocr_result.strip()[:40]}", 
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    # Show original and processed
    cv2.imshow("Original", display_frame)
    cv2.imshow("Processed", processed)

    key = cv2.waitKey(1) & 0xFF

    # Press 'm' to switch methods
    if key == ord('m'):
        method_index = (method_index + 1) % len(methods)
    elif key == 27:  # ESC to quit
        break
    # time.sleep(1 / 20)

cap.release()
cv2.destroyAllWindows()
