import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

// Simple in-memory storage for staged files
const stagedFiles = new Map<string, {
  id: string;
  filename: string;
  type: string;
  data: any;
  uploadedAt: string;
}>();

// 1. STAGE - Upload and store data
router.post("/stage", async (req, res) => {
  try {
    const { filename, type, data } = req.body;
    
    const stagedFile = {
      id: randomUUID(),
      filename: filename || `staged-${Date.now()}.json`,
      type: type || "unknown",
      data: data,
      uploadedAt: new Date().toISOString()
    };
    
    stagedFiles.set(stagedFile.id, stagedFile);
    
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
    const files = Array.from(stagedFiles.values()).map(file => ({
      id: file.id,
      filename: file.filename,
      type: file.type,
      uploadedAt: file.uploadedAt,
      size: JSON.stringify(file.data).length
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
    const file = stagedFiles.get(id);
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.json({
      success: true,
      file: {
        id: file.id,
        filename: file.filename,
        type: file.type,
        data: file.data,
        uploadedAt: file.uploadedAt
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
    const deleted = stagedFiles.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.json({ success: true, message: "File deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export { router as simpleStagingAPI };