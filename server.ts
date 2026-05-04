import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

// Removed discord fetch as it's not needed by frontend anymore
async function getGuildRoles(guildId: string) {
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
