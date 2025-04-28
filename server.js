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

const gracefulShutdown = async () => {
  console.log("Shutting down server...");
  await worker.terminate();
  app.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("exit", gracefulShutdown);

app.listen(PORT || 5000, () => {
  console.log("SERVER STARTED! on http://localhost:", PORT);
});
