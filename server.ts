import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy route for Google Places Autocomplete
  app.get("/api/places/autocomplete", async (req, res) => {
    const { input } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Google Maps API Key not configured" });
    }

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.append("input", input as string);
      url.searchParams.append("key", apiKey);
      url.searchParams.append("components", "country:ca"); // Restrict to Canada for Vancouver context

      const response = await fetch(url.toString());
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy route for Google Maps Directions
  app.get("/api/directions", async (req, res) => {
    const { origin, destination, mode, arrival_time, departure_time, alternatives } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Google Maps API Key not configured" });
    }

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
      url.searchParams.append("origin", origin as string);
      url.searchParams.append("destination", destination as string);
      url.searchParams.append("mode", (mode as string) || "transit");
      url.searchParams.append("key", apiKey);
      
      if (arrival_time) url.searchParams.append("arrival_time", arrival_time as string);
      if (departure_time) url.searchParams.append("departure_time", departure_time as string);
      if (alternatives) url.searchParams.append("alternatives", alternatives as string);

      const response = await fetch(url.toString());
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy route for Translink RTTI (Now using GTFS-RT V3)
  app.get("/api/translink/buses", async (req, res) => {
    const { routeNo } = req.query;
    const apiKey = process.env.TRANSLINK_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Translink API Key not configured" });
    }

    try {
      const url = `https://gtfsapi.translink.ca/v3/gtfsposition?apikey=${apiKey}`;
      console.log(`[Translink Proxy] Fetching GTFS-RT Position: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Translink API returned ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
      
      // Map to the format the frontend expects
      const buses = feed.entity
        .filter(entity => {
          if (!entity.vehicle) return false;
          // Filter by route if provided
          if (routeNo && entity.vehicle.trip?.routeId !== routeNo) return false;
          return true;
        })
        .map(entity => ({
          VehicleNo: entity.vehicle?.vehicle?.id || "N/A",
          RouteNo: entity.vehicle?.trip?.routeId || "N/A",
          Latitude: entity.vehicle?.position?.latitude || 0,
          Longitude: entity.vehicle?.position?.longitude || 0,
          RecordedTime: new Date().toISOString()
        }));

      res.json(buses);
    } catch (error: any) {
      console.error("Translink Proxy Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy route for other Translink endpoints (generic)
  app.get("/api/translink/*", async (req, res) => {
    res.status(404).json({ error: "This endpoint is deprecated. Use /api/translink/buses" });
  });

  // Vite integration
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
