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
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Secure Discord OAuth2 Exchange
  app.post("/api/discord/exchange", async (req, res) => {
    console.log("Discord exchange requested:", {
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      origin: req.get("origin")
    });

    const { code, state } = req.body;
    
    if (!code) {
      console.warn("Discord exchange failed: Missing code");
      return res.status(400).json({ error: "Missing code" });
    }

    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.get("origin")}/callback`;

      console.log("Exchange params:", {
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        redirectUri
      });

      if (!clientId || !clientSecret) {
        throw new Error("Discord credentials (DISCORD_CLIENT_ID/SECRET) not configured in environment settings");
      }

      // 1. Exchange Code for Token
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
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token } = tokenResponse.data;
      console.log("Token exchange successful");

      // 2. Fetch User Info
      const userResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const discordUser = userResponse.data;
      console.log("User info fetched:", discordUser.username);

      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const hashedIp = hashId(String(ip));
      
      // Match the format used by the Python bot: {guildId}_{userId}
      const logId = `${state}_${discordUser.id}`;

      // 3. Write to Firestore securely on the server
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
        expireAt: Date.now() + 90 * 24 * 60 * 60 * 1000 // 90 days
      });
      
      console.log("Firestore write successful for:", logId);

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
      console.error("Exchange error detail:", errorData);
      res.status(500).json({ error: errorData });
    }
  });

  app.get("/api/roles/:guildId", async (req, res) => {
    try {
      const roles = await getGuildRoles(req.params.guildId);
      // Filter out @everyone role and managed roles if you want
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
