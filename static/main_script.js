// Setup webcam
const video = document.getElementById("video");
let isSending = false;
let lastCaptureTime = Date.now();
let fps = 5;
let captureInterval = 1000 / fps;
let detected = false;
let currentStream = null; // Add this at the top
let cameraReadyTime = null;
let ocrResultsBuffer = [];
const MAX_SCAN_DURATION = 40000; // 40 seconds in ms
let scanStartTime = null;
const MAX_BUFFER_SIZE = 10; // check every 10 frames
const CONSISTENCY_THRESHOLD = 0.5; // 90%
const deviceSelector = document.getElementById("deviceSelector");

let ocrWorker = null;

async function getDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}
async function startCamera(deviceId) {
  cameraReadyTime = Date.now() + 3000;
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }

  try {
    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: "environment",
      },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    video.srcObject = stream;
    // cameraStatus.style.display = "none";
  } catch (err) {
    console.error("Camera error:", err);
    cameraStatus.innerText = "Failed to access camera";
  }
}
async function setupCamera() {
  const devices = await getDevices();
  deviceSelector.innerHTML = "";

  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.text = device.label || `Camera ${device.deviceId}`;
    deviceSelector.appendChild(option);
  });

  deviceSelector.onchange = () => {
    document.getElementById("cameraStatus").style.display = "block";
    cameraReadyTime = Date.now() + 3000;
    document.getElementById("cameraStatus").innerText = "Loading camera!";
    startCamera(deviceSelector.value);
    setTimeout(() => {
      document.getElementById("cameraStatus").innerText = "Camera ready!";

      setTimeout(() => {
        document.getElementById("cameraStatus").style.display = "none";
      }, 2000);
    }, 3050);
  };

  if (devices.length > 0) {
    startCamera(devices[0].deviceId);
  } else {
    cameraStatus.innerText = "No cameras found";
  }
}

setupCamera();

async function initWorker() {
  ocrWorker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => console.log(m), // optional
  });
  await ocrWorker.setParameters({
    tessedit_char_whitelist: "0123456789",
  });
}

function confirmResult(text) {
  text = text.trim();
  ocrResultsBuffer.push(text);
  if (ocrResultsBuffer.length > MAX_BUFFER_SIZE) {
    ocrResultsBuffer.shift(); // remove oldest
  }
  const counts = {};
  for (const result of ocrResultsBuffer) {
    counts[result] = (counts[result] || 0) + 1;
  }

  console.log(counts);

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
  }
}

function resetFuction() {
  detected = false;
  isSending = false;
  document.getElementById("result").innerText = "Detected: ";
  // startCamera();
}

async function ocrCanvas(canvas) {
  const {
    data: { text, confidence },
  } = await ocrWorker.recognize(canvas);
  if (confidence < 70) return "";
  return text;
}

async function captureAndSendImage() {
  if (!cameraReadyTime || Date.now() < cameraReadyTime) return;
  if (ocrWorker == null) return;
  if (isSending || detected) return;
  console.log("test");

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
    const targetWidth = 320;
    const targetHeight = 180;

    // Draw cropped region to a temporary canvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext("2d");

    // Instead of using putImageData (which is 1:1), we draw and resize here:
    tempCtx.drawImage(
      canvas, // source canvas
      cropX,
      cropY, // source crop start
      cropWidth,
      cropHeight, // source crop size
      0,
      0, // target start
      targetWidth,
      targetHeight // target size
    );

    const imageData = tempCanvas.toDataURL("image/jpeg");

    if (!imageData || imageData === "data:,") {
      console.warn("Captured image data is empty, skipping.");
      return;
    }

    try {
      isSending = true;
      const ocrExecTime = Date.now();
      const ocrResult = await ocrCanvas(tempCanvas);
      console.log(ocrResult);
      console.log(`Exec Time: ${Date.now() - ocrExecTime}ms`);
      if (ocrResult.trim() === "") {
        isSending = false;
        return;
      }
      // detected = true;
      // document.getElementById("result").innerText = "Detected: " + ocrResult;
      confirmResult(ocrResult);
      isSending = false;
    } catch (error) {
      console.log(error);
    }

    // socket.emit("image", imageData);
    lastCaptureTime = Date.now();
  }
}

const renderVideo = () => {
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
  // The video will continue rendering at its normal FPS (native video FPS)
  requestAnimationFrame(renderVideo);
  // console.log("test");

  captureAndSendImage();
};

// Start the video rendering and frame capture loop
video.addEventListener("canplay", () => {
  console.log("Video is ready!");
  setTimeout(() => {
    document.getElementById("cameraStatus").innerText = "Camera ready!";
    setTimeout(() => {
      document.getElementById("cameraStatus").style.display = "none";
    }, 2000);
  }, 3000);

  renderVideo(); // start loop only after it's ready
});

function moveNextPage(detectedNumber) {
  terminateWorker();
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

window.onload = async () => {
  await initWorker();
  console.log("OCR worker ready!");
};

async function terminateWorker() {
  if (ocrWorker) {
    await ocrWorker.terminate();
  }
}
