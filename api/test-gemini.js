import dotenv from 'dotenv';
dotenv.config();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "GEMINI_API_KEY가 .env에 설정되지 않았습니다." });
    }
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const apiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "안녕 제미나이? 한 줄로 짧게 대답해." }] }]
      })
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`API Error ${apiRes.status}: ${errorText}`);
    }

    const data = await apiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "(응답 없음)";
    return res.status(200).json({ ok: true, reply: text });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
