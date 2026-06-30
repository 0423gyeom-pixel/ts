// api/analyze.js - Vercel Serverless Function (Node.js) - 불량 키 자가진단(Self-Diagnostic) 마스킹 노출 및 Quota 분산 버전

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

  // 1. 환경변수 체크 및 로테이션
  const rawApiKeySetting = process.env.GEMINI_API_KEY;
  if (!rawApiKeySetting) {
    return res.status(500).json({ error: '서버 환경변수(GEMINI_API_KEY)가 등록되지 않았습니다.' });
  }

  const apiKeys = rawApiKeySetting.split(',')
    .map(k => k.trim().replace(/[\r\n]/g, ""))
    .filter(k => k.length > 0);

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: '등록된 유효한 구글 API Key가 존재하지 않습니다.' });
  }

  const randomIndex = Math.floor(Math.random() * apiKeys.length);
  const apiKey = apiKeys[randomIndex];
  // 에러 발생 시 어느 키가 오타 났는지 식별할 수 있도록 마스킹 텍스트를 구성 (앞 14자리...뒤 6자리)
  const maskedKeyIdentifier = apiKey.length > 20 
    ? `${apiKey.slice(0, 14)}...${apiKey.slice(-6)}` 
    : apiKey;

  try {
    const { contents } = req.body;
    
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

    // 구글 API 키 거절 에러가 발생한 경우 정밀 정보 마스킹 노출하여 디버깅 제공
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const rawMsg = errJson.error?.message || "Google API 거절";
      
      // 400 Bad Request 등의 원인이 API Key Not Valid 일 경우 식별자 매핑 안내
      if (rawMsg.includes("API key not valid") || rawMsg.includes("key") || response.status === 400) {
        return res.status(400).json({
          error: {
            message: `구글 서버가 해당 API Key를 유효하지 않다고 거부했습니다.\n\n[구글 에러내용]: ${rawMsg}\n[문제의 불량 키 식별자]: ${maskedKeyIdentifier}\n\nVercel 환경변수 값에서 위 식별자 키에 오타가 있는지 확인 후 수정 또는 제거해 주세요.`
          }
        });
      }
      return res.status(response.status).json(errJson);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Vercel Proxy Handler Error:", error);
    return res.status(500).json({ 
      error: {
        message: `백엔드 처리 중 오류 발생: ${error.message || 'Unknown Exception'}\n(사용된 키 식별자: ${maskedKeyIdentifier})`
      } 
    });
  }
}
