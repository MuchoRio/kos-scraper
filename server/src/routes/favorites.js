import express from "express";
import { AppError } from "../utils/validation.js";

export function createFavoritesRouter({ store }) {
  const router = express.Router();

  router.get("/favorites", (_req, res) => {
    res.json({ success: true, items: store.readFavorites() });
  });

  router.post("/favorites/toggle", (req, res) => {
    const item = req.body?.item;
    if (!item || typeof item !== "object" || !item.url) {
      throw new AppError("Item favorit wajib memiliki properti url.", 400);
    }
    const current = store.readFavorites();
    const exists = current.some((x) => x.url === item.url);
    const next = exists ? current.filter((x) => x.url !== item.url) : [item, ...current];
    store.saveFavorites(next);
    res.json({ success: true, saved: !exists, items: next });
  });

  return router;
}

