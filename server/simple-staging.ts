import express from "express";
import { storage } from "./storage";

const router = express.Router();

// 1. STAGE - Upload and store data
router.post("/stage", async (req, res) => {
  try {
    const { filename, type, data } = req.body;
    
    const stagedFile = await storage.createStagedFile({
      filename: filename || `staged-${Date.now()}.json`,
      type: type || "unknown",
      data: JSON.stringify(data)
    });
    
    res.json({ 
      success: true, 
      id: stagedFile.id,
      message: "File staged successfully" 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to stage file" });
  }
});

// 2. LIST - Get all staged files
router.get("/list", async (req, res) => {
  try {
    const allFiles = await storage.getStagedFiles();
    const files = allFiles.map(file => ({
      id: file.id,
      filename: file.filename,
      type: file.type,
      uploadedAt: new Date(file.uploadedAt).toISOString(),
      size: file.data.length
    }));
    
    res.json({ 
      success: true, 
      files: files,
      total: files.length 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to list files" });
  }
});

// 3. DOWNLOAD - Get staged file data
router.get("/download/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const file = await storage.getStagedFile(id);
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.json({
      success: true,
      file: {
        id: file.id,
        filename: file.filename,
        type: file.type,
        data: JSON.parse(file.data),
        uploadedAt: new Date(file.uploadedAt).toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to download file" });
  }
});

// Delete staged file
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteStagedFile(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.json({ success: true, message: "File deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export { router as simpleStagingAPI };