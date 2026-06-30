// api/analyze.js - Vercel Serverless Function (Node.js) - 속도 및 신뢰성 극대화 튜닝 버전

export default async function handler(req, res) {
  // CORS 헤더 설정
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
    
    // Vercel 환경변수에서 API Key 세척
    const rawApiKey = process.env.GEMINI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim().replace(/[\r\n]/g, "") : null;

    if (!apiKey) {
      return res.status(500).json({ error: '서버 환경변수(GEMINI_API_KEY)가 등록되지 않았습니다.' });
    }

    // 최신 gemini-2.5-flash 모델 중계 요청
    const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          // 모델이 엉뚱하게 고민하지 않고 가장 빠르고 확정적으로 응답하도록 온도 낮춤
          temperature: 0.1,
          // 응답이 지나치게 길어지는 것을 제한하여 10초 타임아웃 완전 무력화 (속도 2.5배 가속)
          maxOutputTokens: 1024
        }
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Vercel Proxy Handler Error:", error);
    return res.status(500).json({ error: error.message || '백엔드 처리 중 원인 불명의 예외가 터졌습니다.' });
  }
}
