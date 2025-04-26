// Setup webcam
const video = document.getElementById("video");
let isSending = false;
let lastCaptureTime = Date.now();
let fps = 10;
let captureInterval = 1000 / fps;
let detected = false;
let currentStream = null; // Add this at the top
let cameraReadyTime = null;
let ocrResultsBuffer = [];
const MAX_SCAN_DURATION = 40000; // 40 seconds in ms
let scanStartTime = null;
const MAX_BUFFER_SIZE = 10; // check every 10 frames
const CONSISTENCY_THRESHOLD = 0.5; // 90%

// socket
const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("ocr_result", (data) => {
  if (detected) return;
  if (data.text.length <= 0) {
    isSending = false;
    return;
  }

  // Display result
  //   document.getElementById("result").innerText = "Detected: " + data.text;

  // Stop camera and sending if result is found
  if (data.text && data.text.trim() == "") {
    isSending = false;
    return;
  }
  // Add to buffer
  //   console.log("OCR Result:", data.text);
  ocrResultsBuffer.push(data.text);
  if (ocrResultsBuffer.length > MAX_BUFFER_SIZE) {
    ocrResultsBuffer.shift(); // remove oldest
  }
  //   console.log(ocrResultsBuffer);
  // Count frequency
  const counts = {};
  console.log(counts);
  for (const result of ocrResultsBuffer) {
    counts[result] = (counts[result] || 0) + 1;
  }
  // Check if any result reaches 90%
  const accepted = Object.entries(counts).find(([value, count]) => {
    return count / ocrResultsBuffer.length >= CONSISTENCY_THRESHOLD;
  });
  if (accepted && ocrResultsBuffer.length > 3) {
    const [finalResult] = accepted;
    console.log("✅ Stable result:", finalResult);

    detected = true;
    document.getElementById("result").innerText = "Detected: " + finalResult;
    stopCameraCapture();
    moveNextPage(finalResult);
    console.log("Detection complete. Camera stopped.");

    // freeze camera or redirect to result page
    //   stopCameraCapture();
    //   window.location.href = `/display_result?digit=${finalResult}`; // or use POST
  }

  isSending = false; // Let next frame send if needed (though we stop now)
});

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

    // // Test Cropped result
    // // Preview the cropped region on the page
    // const previewCanvas = document.getElUse Levenshtein distance or fuzzy match if OCR sometimes returns messy close matches.

    // previewCanvas.width = cropWidth;
    // previewCanvas.height = cropHeight;
    // const previewCtx = previewCanvas.getContext("2d");
    // previewCtx.drawImage(tempCanvas, 0, 0);

    const imageData = tempCanvas.toDataURL("image/jpeg");

    if (!imageData || imageData === "data:,") {
      console.warn("Captured image data is empty, skipping.");
      return;
    }

    socket.emit("image", imageData);
    isSending = true;
    lastCaptureTime = Date.now();
  }
}

socket.on("ack", (data) => {
  console.log("Server ack:", data);
  // console.log("Read: ", parsed.result);
  isSending = false; // allow next frame
});

const renderVideo = () => {
  // The video will continue rendering at its normal FPS (native video FPS)
  requestAnimationFrame(renderVideo);

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

  // Capture and send an image only at 10 FPS
  captureAndSendImage();
};

// Start the video rendering and frame capture loop
video.addEventListener("canplay", () => {
  console.log("Video is ready!");
  setTimeout(() => {
    document.getElementById("cameraStatus").innerText = "Camera ready!";
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
