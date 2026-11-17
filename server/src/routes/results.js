import express from "express";

export function createResultsRouter({ store }) {
  const router = express.Router();

  router.get("/results", (_req, res) => {
    const files = store.listResultFiles();
    const active = store.getDefaultItems();
    res.json({
      success: true,
      files,
      defaultFilename: active.filename,
      items: active.items,
    });
  });

  router.get("/results/:filename", (req, res) => {
    const result = store.readResultItems(req.params.filename);
    if (result.type === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      return res.send(result.content);
    }
    return res.json({ success: true, filename: result.filename, items: result.items });
  });

  return router;
}

