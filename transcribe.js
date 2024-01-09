import "dotenv/config";
import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { RealtimeService } from "assemblyai";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", async (ws) => {
  console.info("New connection");
  const transcriber = new RealtimeService({
    apiKey: process.env.ASSEMBLYAI_API_KEY,
    encoding: "pcm_mulaw",
    sampleRate: 8000
  })
  const connectionPromise = transcriber.connect();

  transcriber.on("transcript.partial", ({ text }) => {
    if (!text) return;
    console.log(text);
  });
  transcriber.on("transcript.final", ({ text }) => {
    console.log(text);
    console.log();
  });
  transcriber.on("open", console.info);
  transcriber.on("error", console.error);
  transcriber.on("close", console.info);

  ws.on("message", async (message) => {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case "connected":
        console.info("A new call has started.");
        break;

      case "start":
        console.info("Twilio media stream started");
        break;

      case "media":
        // Wait for the connection to be established
        await connectionPromise;
        transcriber.sendAudio(msg.media.payload);
        break;

      case "stop":
        console.info("Call has ended");
        await transcriber.close();
        break;
    }
  });

  await connectionPromise;
});

app.get("/", (_, res) => res.send("Twilio Live Stream App"));

app.post("/", async (req, res) => {
  res.set("Content-Type", "text/xml");
  res.send(
    `<Response>
       <Start>
         <Stream url="wss://${req.headers.host}" />
       </Start>
       <Say>
         Start speaking to see your audio transcribed in the console.
       </Say>
       <Pause length="60" />
     </Response>`
  );
});

console.log("Listening on Port 8080");
server.listen(8080);
