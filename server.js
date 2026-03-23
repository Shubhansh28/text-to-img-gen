require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// ===== Configuration =====
const HF_API_URL =
    "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0";
const HF_TOKEN = process.env.HF_TOKEN;

// Serve static files (index.html, style.css, script.js)
app.use(express.static(path.join(__dirname)));

// Parse JSON bodies
app.use(express.json());

// ===== Proxy endpoint =====
app.post("/api/generate", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required." });
    }

    try {
        const response = await fetch(HF_API_URL, {
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ inputs: prompt }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res
                .status(response.status)
                .json({ error: errorText || response.statusText });
        }

        const contentType = response.headers.get("content-type");

        // If model is loading, HF returns JSON with estimated_time
        if (contentType && contentType.includes("application/json")) {
            const json = await response.json();
            if (json.estimated_time) {
                return res.status(503).json({
                    error: `Model is loading. Please try again in ~${Math.ceil(json.estimated_time)} seconds.`,
                    estimated_time: json.estimated_time,
                });
            }
            return res.status(500).json({ error: JSON.stringify(json) });
        }

        // Stream the image back to the client
        const buffer = await response.arrayBuffer();
        res.set("Content-Type", contentType || "image/png");
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error("Proxy error:", err.message);
        res.status(500).json({ error: "Failed to connect to AI service." });
    }
});

app.listen(PORT, () => {
    console.log(`\n  ✦ ImagiGen server running at http://localhost:${PORT}\n`);
});
