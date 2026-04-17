import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to update metadata.json and manifest info
  app.post("/api/metadata", (req, res) => {
    try {
      const { name, icon } = req.body;
      const metadataPath = path.join(process.cwd(), "metadata.json");
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      
      if (name) metadata.name = name;
      if (icon) metadata.appIcon = icon; 
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      res.json({ success: true, metadata });
    } catch (error) {
      console.error("Error updating metadata:", error);
      res.status(500).json({ error: "Failed to update metadata" });
    }
  });

  // Serve app manifest
  app.get("/manifest.json", (req, res) => {
    try {
      const metadataPath = path.join(process.cwd(), "metadata.json");
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      
      const appName = metadata.name || "Árvore da Vida";
      const iconUrl = metadata.appIcon?.startsWith("http") ? metadata.appIcon : "/api/app-icon.svg";
      let iconType = "image/svg+xml";
      if (iconUrl.endsWith(".png")) iconType = "image/png";
      if (iconUrl.endsWith(".jpg") || iconUrl.endsWith(".jpeg")) iconType = "image/jpeg";
      if (iconUrl.endsWith(".ico")) iconType = "image/x-icon";

      const manifest = {
        name: appName,
        short_name: appName.length > 12 ? appName.substring(0, 10) + ".." : appName,
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#4A6741"
      };
      res.json(manifest);
    } catch (e) {
      console.error("Manifest error:", e);
      res.status(500).json({ error: "Manifest error" });
    }
  });

  // Dynamic icon generator
  app.get("/api/app-icon.svg", (req, res) => {
    try {
      const metadataPath = path.join(process.cwd(), "metadata.json");
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      const icon = metadata.appIcon || "🌳";

      if (icon.startsWith("http")) {
        return res.redirect(icon);
      }

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
          <rect width="128" height="128" rx="32" fill="#4A6741" />
          <text y="92" x="64" text-anchor="middle" font-family="Arial, sans-serif" font-size="75" fill="white">${icon}</text>
        </svg>
      `.trim();

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(svg);
    } catch (e) {
      console.error("Icon error:", e);
      res.status(500).send("Error generating icon");
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
