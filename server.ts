import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

// Discord API call to fetch roles
async function getGuildRoles(guildId: string) {
  const token = process.env.DISCORD_FUNC_TOKEN;
  if (!token) throw new Error("DISCORD_FUNC_TOKEN is missing");
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch roles: ${res.statusText}`);
  }
  return res.json();
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

  app.get("/api/roles/:guildId", async (req, res) => {
    try {
      const roles = await getGuildRoles(req.params.guildId);
      // Filter out @everyone role and managed roles if you want
      const filteredRoles = roles
        .filter((r: any) => r.name !== "@everyone" && !r.managed)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          position: r.position
        }))
        .sort((a: any, b: any) => b.position - a.position);
      res.json(filteredRoles);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
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
