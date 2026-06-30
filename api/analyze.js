// api/analyze.js - Vercel Serverless Function (Node.js) - 무료 API Key 다중 순회(Round-Robin/Random Rotation) 및 속도 극대화 튜닝 버전

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
    
    // Vercel 환경변수에서 API Key들을 로드합니다 (쉼표로 나열된 다중 키 지원)
    const rawApiKeySetting = process.env.GEMINI_API_KEY;
    if (!rawApiKeySetting) {
      return res.status(500).json({ error: '서버 환경변수(GEMINI_API_KEY)가 등록되지 않았습니다.' });
    }

    // 쉼표로 분할 후 앞뒤 공백 및 줄바꿈 기호를 깨끗이 세척합니다.
    const apiKeys = rawApiKeySetting.split(',')
      .map(k => k.trim().replace(/[\r\n]/g, ""))
      .filter(k => k.length > 0);

    if (apiKeys.length === 0) {
      return res.status(500).json({ error: '등록된 유효한 구글 API Key가 존재하지 않습니다.' });
    }

    // 서버리스 분산 처리 환경을 위해 로드된 키 풀(Key Pool) 중 1개를 무작위 선택하여 할당량을 1/N로 균등 분산시킵니다.
    const randomIndex = Math.floor(Math.random() * apiKeys.length);
    const apiKey = apiKeys[randomIndex];

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
          temperature: 0.1,
          maxOutputTokens: 2048
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
