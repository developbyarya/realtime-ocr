// Setup webcam
const video = document.getElementById("video");
let isSending = false;
let lastCaptureTime = Date.now();
let fps = 10;
let captureInterval = 1000 / fps;
let detected = false;
let currentStream = null; // Add this at the top

// socket
const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("ocr_result", (data) => {
  if (data.text.length <= 0) {
    return;
    isSending = false;
  }
  console.log("OCR Result:", data.text);

  // Display result
  document.getElementById("result").innerText = "Detected: " + data.text;

  // Stop camera and sending if result is found
  if (data.text && data.text.trim() !== "") {
    detected = true;
    console.log("Detection complete. Camera stopped.");
  }

  isSending = false; // Let next frame send if needed (though we stop now)
});

navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((stream) => {
    video.srcObject = stream;
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
  if (isSending) return;

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

    const imageData = canvas.toDataURL("image/jpeg");

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
  //   requestAnimationFrame(renderVideo);

  // Capture and send an image only at 10 FPS
  captureAndSendImage();
};

// Start the video rendering and frame capture loop
video.addEventListener("canplay", () => {
  console.log("Video is ready!");
  renderVideo(); // start loop only after it's ready
});
