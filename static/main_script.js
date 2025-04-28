// Setup webcam
const video = document.getElementById("video");
let isSending = false;
let lastCaptureTime = Date.now();
let fps = 2;
let captureInterval = 1000 / fps;
let detected = false;
let currentStream = null; // Add this at the top
let cameraReadyTime = null;
let ocrResultsBuffer = [];
const MAX_SCAN_DURATION = 30000; // 40 seconds in ms
let scanStartTime = null;
const MAX_BUFFER_SIZE = 10; // check every 10 frames
const CONSISTENCY_THRESHOLD = 0.51;

function verifyResult(text) {
  if (text.trim() == "") {
    isSending = false;
    return;
  }
  // Add to buffer
  //   console.log("OCR Result:", data.text);
  ocrResultsBuffer.push(text.trim());
  if (ocrResultsBuffer.length > MAX_BUFFER_SIZE) {
    ocrResultsBuffer.shift(); // remove oldest
  }
  //   console.log(ocrResultsBuffer);
  // Count frequency
  const counts = {};
  for (const result of ocrResultsBuffer) {
    counts[result] = (counts[result] || 0) + 1;
  }

  console.log(counts);
  // Check if any result reaches 90%
  const accepted = Object.entries(counts).find(([value, count]) => {
    return count / ocrResultsBuffer.length >= CONSISTENCY_THRESHOLD;
  });
  if (accepted && ocrResultsBuffer.length > 2) {
    const [finalResult] = accepted;
    console.log("✅ Stable result:", finalResult);

    detected = true;
    document.getElementById("result").innerText = "Detected: " + finalResult;
    stopCameraCapture();
    moveNextPage(finalResult);
    console.log("Detection complete. Camera stopped.");
  }

  isSending = false; // Let next frame send if needed (though we stop now)
}

navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((stream) => {
    video.srcObject = stream;
    cameraReadyTime = Date.now() + 3000;
    scanStartTime = Date.now(); // Mark the start of scanning
  })
  .catch((err) => {
    console.error("Error accessing webcam:", err);
  });

function resetFuction() {
  detected = false;
  isSending = false;
  document.getElementById("result").innerText = "Detected: ";
  // startCamera();
}

function captureAndSendImage() {
  if (!cameraReadyTime || Date.now() < cameraReadyTime) return;
  if (isSending | detected) return;

  const currentTime = Date.now();

  if (currentTime - lastCaptureTime >= captureInterval) {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

    const width = video.videoWidth;
    const height = video.videoHeight;

    // Only proceed if video has valid dimensions
    if (width === 0 || height === 0) {
      console.warn("Video not ready yet, skipping frame.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    // Calculate crop box in video pixel coordinates
    const cropWidth = width * 0.6;
    const cropHeight = (cropWidth * 9) / 16; // maintain aspect ratio of 16:9

    const cropX = (width - cropWidth) / 2;
    const cropY = (height - cropHeight) / 2;

    const croppedImageData = context.getImageData(
      cropX,
      cropY,
      cropWidth,
      cropHeight
    );

    // Draw cropped region to a temporary canvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(croppedImageData, 0, 0);

    // Step 2: Create a SMALLER canvas
    const resizedCanvas = document.createElement("canvas");

    // Example: target smaller width, e.g., 320px wide
    const targetWidth = 320;
    const scaleFactor = targetWidth / cropWidth;
    const targetHeight = cropHeight * scaleFactor;

    resizedCanvas.width = targetWidth;
    resizedCanvas.height = targetHeight;

    // Step 3: Draw and scale the cropped image into resized canvas
    const resizedCtx = resizedCanvas.getContext("2d");
    resizedCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    // Step 4: Export as base64
    const imageData = resizedCanvas.toDataURL("image/jpeg", 0.7); // You can also adjust JPEG quality here (0.7 = 70%)

    if (!imageData || imageData === "data:,") {
      console.warn("Captured image data is empty, skipping.");
      return;
    }

    isSending = true;
    lastCaptureTime = Date.now();
    sendImage(imageData);
  }
}

async function sendImage(base64Image) {
  try {
    const response = await fetch("/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: base64Image }),
    });

    const result = await response.json();
    verifyResult(result.text);
    console.log("OCR Result:", result.text);

    // Display result on your page
    document.getElementById("result").innerText = `Detected: ${result.text}`;
  } catch (error) {
    console.error("Error sending image:", error);
  }
}

const renderVideo = () => {
  // The video will continue rendering at its normal FPS (native video FPS)

  if (
    !detected &&
    scanStartTime &&
    Date.now() - scanStartTime >= MAX_SCAN_DURATION
  ) {
    console.error("⛔ Scan timed out. No result detected.");
    stopCameraCapture();
    document.getElementById("result").innerText =
      "❌ Gagal mendeteksi. Coba lagi.";
    document.getElementById("back-button").style.display = "block";
    return;
  }

  requestAnimationFrame(renderVideo);

  // Capture and send an image only at 10 FPS
  captureAndSendImage();
};

// Start the video rendering and frame capture loop
video.addEventListener("canplay", () => {
  console.log("Video is ready!");
  setTimeout(() => {
    document.getElementById("cameraStatus").innerText = "Camera ready!";
    setTimeout(() => {
      document.getElementById("cameraStatus").style.opacity = 0;
    }, 1000);
  }, 3000);

  renderVideo(); // start loop only after it's ready
});

function moveNextPage(detectedNumber) {
  // Mimic formSubmit
  const formEl = document.createElement("form");
  formEl.style.display = "none";
  formEl.action = "/display";
  formEl.method = "POST";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "number";
  input.value = detectedNumber;

  formEl.appendChild(input);
  document.body.appendChild(formEl);
  formEl.submit();
}

function stopCameraCapture() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  isSending = true; // block further sends
}
