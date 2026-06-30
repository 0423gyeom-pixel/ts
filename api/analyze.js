// api/analyze.js - Vercel Serverless Function (Node.js)

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
    
    // Vercel 환경변수에서 API Key를 읽되, 앞뒤 공백 및 줄바꿈(\n, \r)을 완벽하게 trim 세척합니다.
    const rawApiKey = process.env.GEMINI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim().replace(/[\r\n]/g, "") : null;

    if (!apiKey) {
      return res.status(500).json({ error: '서버 환경변수(GEMINI_API_KEY)가 등록되지 않았습니다. Vercel 설정을 완료해 주세요.' });
    }

    // 최신 gemini-2.5-flash 모델 사용 및 JSON 스키마 강제 세팅을 포함하여 Google API로 중계 요청합니다.
    const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Vercel Proxy Handler Error:", error);
    // 에러 메시지 반환
    return res.status(500).json({ error: error.message || '백엔드 처리 중 원인 불명의 예외가 터졌습니다.' });
  }
}
