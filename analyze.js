// api/analyze.js - Vercel Serverless Function (Node.js)

export default async function handler(req, res) {
  // CORS 헤더 설정 (다양한 도메인 접속 허용)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contents } = req.body;
    // Vercel Dashboard 환경변수에 등록될 GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: '서버에 API Key가 설정되지 않았습니다. Vercel 환경변수 설정을 완료해 주세요.' });
    }

    // Google Gemini API로 직접 HTTP 요청
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Proxy handler error:", error);
    return res.status(500).json({ error: 'AI 분석 요청 처리 중 백엔드 오류가 발생했습니다.' });
  }
}
