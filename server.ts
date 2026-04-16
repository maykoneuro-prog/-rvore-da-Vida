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
      if (icon) metadata.appIcon = icon; // Store icon for manifest persistence
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      res.json({ success: true, metadata });
    } catch (error) {
      console.error("Error updating metadata:", error);
      res.status(500).json({ error: "Failed to update metadata" });
    }
  });

  // Serve app manifest
  app.get("/manifest.json", (req, res) => {
    const metadataPath = path.join(process.cwd(), "metadata.json");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    
    const manifest = {
      name: metadata.name || "Árvore da Vida",
      short_name: metadata.name || "Árvore",
      icons: [
        {
          src: "/api/app-icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable"
        }
      ],
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#4A6741"
    };
    res.json(manifest);
  });

  // Dynamic icon generator (SVG for emojis or redirect for URLs)
  app.get("/api/app-icon.svg", (req, res) => {
    const metadataPath = path.join(process.cwd(), "metadata.json");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    const icon = metadata.appIcon || "🌳";

    if (icon.startsWith("http")) {
      return res.redirect(icon);
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <rect width="128" height="128" rx="28" fill="#4A6741" />
        <text y="92" x="64" text-anchor="middle" font-size="80">${icon}</text>
      </svg>
    `.trim();

    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
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
