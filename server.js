import express from "express";
import Tesseract from "tesseract.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// This will simulate __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT;

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "templates")); // your templates folder

// const worker = await Tesseract.createWorker("eng", 1, {
//   logger: (m) => console.log(m),
// });

// await worker.setParameters({
//   tessedit_char_whitelist: "0123456789",
// });

app.use(express.static(path.join(__dirname, "static"), { maxAge: "1d" }));

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

app.use(express.json({ limit: "10mb" })); // Increase limit if images are big

// app.post("/upload", async (req, res) => {
//   try {
//     let base64Data = req.body.image;

//     // If it contains "data:image/..." prefix, remove it
//     if (base64Data.startsWith("data:image")) {
//       base64Data = base64Data.split(",")[1];
//     }

//     // Decode and process with Tesseract
//     const buffer = Buffer.from(base64Data, "base64");

//     const result = await Promise.race([
//       worker.recognize(buffer),
//       new Promise((_, reject) =>
//         setTimeout(() => reject(new Error("OCR Timeout")), 10000)
//       ), // 10s timeout
//     ]);

//     const {
//       data: { text, confidence },
//     } = result;
//     console.log(`${text} ${confidence}%`);

//     if (confidence < 70) {
//       return res.json({ text: "" });
//     }

//     res.json({ text });
//   } catch (err) {
//     console.error("OCR error:", err);
//     res.status(500).json({ error: "Failed to process image" });
//   }
// });

// const gracefulShutdown = async () => {
//   console.log("Shutting down server...");
//   await worker.terminate();
//   server.close(() => {
//     console.log("Server closed");
//     process.exit(0);
//   });
// };

// process.on("SIGINT", gracefulShutdown);
// process.on("SIGTERM", gracefulShutdown);
// process.on("exit", gracefulShutdown);

const server = app.listen(PORT || 5000, () => {
  console.log("SERVER STARTED! on http://localhost:", PORT);
});
