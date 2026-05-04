import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";

// For server-side Firebase
import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
import fs from "fs";
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const db = getFirestore(firebaseConfig.firestoreDatabaseId);

function hashId(id: string) {
  return crypto.createHash("sha256").update(id).digest("hex");
}

async function getGuildRoles(guildId: string) {
  // This is a placeholder or you can implement Discord Bot API call here
  // For now, return empty to let it compile
  return [];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Secure Discord OAuth2 Exchange
  apiRouter.get("/discord/exchange", (req, res) => {
    res.status(405).json({ error: "Method Not Allowed. Please use POST for token exchange." });
  });

  apiRouter.post("/discord/exchange", async (req, res) => {
    const { code, state } = req.body;
    console.log(`[OAuth2] Received Request - Path: ${req.originalUrl}, Method: ${req.method}`);
    console.log(`[OAuth2] Exchange attempt. State: ${state}`);
    
    if (!code) {
      console.error("[OAuth2] Missing code in request body");
      return res.status(400).json({ error: "Missing code" });
    }

    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.get("origin")}/callback`;

      if (!clientId || !clientSecret) {
        throw new Error("Discord credentials not configured in environment");
      }

      // 1. Exchange Code for Token
      console.log("[OAuth2] Exchanging code for token...");
      const tokenResponse = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const { access_token } = tokenResponse.data;

      // 2. Fetch User Info
      console.log("[OAuth2] Fetching user info from Discord...");
      const userResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const discordUser = userResponse.data;
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const hashedIp = hashId(String(ip));
      
      const logId = `${state}_${discordUser.id}`;

      // 3. Write to Firestore securely on the server
      console.log(`[Firestore] Writing log for user: ${discordUser.username} (${logId})`);
      const logRef = db.collection("verificationLogs").doc(logId);
      await logRef.set({
        id: logId,
        userId: discordUser.id,
        discordTag: discordUser.discriminator !== "0" ? `${discordUser.username}#${discordUser.discriminator}` : discordUser.username,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        guildId: state,
        hashedIp: hashedIp,
        verifiedAt: Date.now(),
        expireAt: Date.now() + 90 * 24 * 60 * 60 * 1000
      });

      console.log("[OAuth2] Exchange successful!");
      res.json({ 
        success: true, 
        user: {
          id: discordUser.id,
          username: discordUser.username,
          tag: discordUser.discriminator !== "0" ? `${discordUser.username}#${discordUser.discriminator}` : discordUser.username
        },
        logId: logId
      });

    } catch (e: any) {
      const errorData = e.response?.data || e.message;
      console.error("[OAuth2] Exchange error details:", JSON.stringify(errorData));
      res.status(500).json({ error: errorData });
    }
  });

  apiRouter.get("/roles/:guildId", async (req, res) => {
    try {
      const roles = await getGuildRoles(req.params.guildId);
      const filteredRoles = Array.isArray(roles) ? roles
        .filter((r: any) => r.name !== "@everyone" && !r.managed)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          position: r.position
        }))
        .sort((a: any, b: any) => b.position - a.position) : [];
      res.json(filteredRoles);
    } catch (e: any) {
      console.error("Discord fetching err:", e.message);
      res.status(400).json({ error: e.message });
    }
  });

  // Mount API Router
  app.use("/api", apiRouter);

  // JSON error handler for non-existent /api routes
  app.all("/api/*", (req, res) => {
    console.warn(`[Route Not Found] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API Route ${req.originalUrl} NOT FOUND with method ${req.method}` });
  });
  
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
