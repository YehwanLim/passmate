import { analyzeCoverLetter } from '../server/api/analyze.js';

export default async function handler(req: any, res: any) {
  // CORS 처리 (필요시)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    // 새 형식(questions[]) 또는 이전 형식(content string) 지원
    const input = payload?.questions ? payload : payload?.content;

    if (!input) {
      return res.status(400).json({ error: 'questions 또는 content가 필요합니다.' });
    }

    const result = await analyzeCoverLetter(input);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
