export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // 2. Validate API key exists on server
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[gemini] GEMINI_API_KEY is not configured.");
      return res.status(500).json({ error: "Server configuration error: API key is missing." });
    }

    // 3. Parse and validate request body
    // Vercel automatically parses JSON request bodies into req.body
    const prompt = req.body?.prompt;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Missing or empty 'prompt' field in request body." });
    }

    // 4. Call Gemini API
    const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt.trim() }],
          },
        ],
      }),
    });

    // 5. Handle non-OK response from Gemini
    if (!geminiRes.ok) {
      const errorData = await geminiRes.text();
      console.error(`[gemini] Gemini API error ${geminiRes.status}:`, errorData);
      return res.status(502).json({ error: `Gemini API returned an error (${geminiRes.status}).` });
    }

    // 6. Parse Gemini response
    const data = await geminiRes.json();

    // Check for API-level error object inside JSON response
    if (data.error) {
      console.error("[gemini] Gemini API error object:", data.error);
      return res.status(502).json({ error: `Gemini API error: ${data.error.message}` });
    }

    // 7. Extract generated text
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.error("[gemini] No text found in Gemini response:", JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: "Gemini returned an empty response." });
    }

    // 8. Return clean response to frontend
    return res.status(200).json({ text: generatedText });

  } catch (error) {
    console.error("[gemini] Unhandled error:", error.message || error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
