import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import Tesseract from "tesseract.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cors from "cors";

// This will simulate __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "templates")); // your templates folder

const httpServer = createServer(app);
const io = new Server(httpServer, {});
const worker = await Tesseract.createWorker("eng", 1, {
  logger: (m) => console.log(m),
});

await worker.setParameters({
  tessedit_char_whitelist: "0123456789",
});

app.use(express.static(path.join(__dirname, "static")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "main_page.html"));
});

app.get("/scan", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "index.html"));
});

app.post("/display", (req, res) => {
  const detectedNumber = req.body.number; // 'number' is the input name

  res.render("display_hasil", { number: detectedNumber });
});

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("image", async (data) => {
    console.log("Received OCR request");
    // console.log(data);

    try {
      const pureBase64 = data.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(pureBase64, "base64");

      const {
        data: { text, confidence },
      } = await worker.recognize(imageBuffer);
      console.log("Read: ", text);
      socket.emit("ocr_result", { text, confidence });
    } catch (error) {
      console.error("OCR Error:", error);
      socket.emit("ocrError", { error: error.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const gracefulShutdown = async () => {
  console.log("Shutting down server...");
  await worker.terminate();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("exit", gracefulShutdown);

httpServer.listen(5000, () => {
  console.log("SERVER STARTED!");
});
