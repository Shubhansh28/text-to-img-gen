import fetch from 'node-fetch';

const HF_API_URL = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0";

export const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        if (!prompt || !prompt.trim()) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Prompt is required." })
            };
        }

        // Make request to Hugging Face
        const response = await fetch(HF_API_URL, {
            headers: {
                Authorization: `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ inputs: prompt }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: errorText || response.statusText })
            };
        }

        const contentType = response.headers.get("content-type");

        // If it's JSON, it's likely a charging/loading message
        if (contentType && contentType.includes("application/json")) {
            const json = await response.json();
            if (json.estimated_time) {
                return {
                    statusCode: 503,
                    body: JSON.stringify({
                        error: `Model is loading. Please try again in ~${Math.ceil(json.estimated_time)} seconds.`,
                        estimated_time: json.estimated_time,
                    })
                };
            }
            return {
                statusCode: 500,
                body: JSON.stringify({ error: JSON.stringify(json) })
            };
        }

        // Return image as base64
        const buffer = await response.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        
        return {
            statusCode: 200,
            headers: {
                "Content-Type": contentType || "image/png",
            },
            body: base64Image,
            isBase64Encoded: true
        };

    } catch (error) {
        console.error("Netlify Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to connect to AI service." })
        };
    }
};
