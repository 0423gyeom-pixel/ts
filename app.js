// app.js - 토익스피킹 AI 발음 및 답변 연습 웹 애플리케이션 코어 로직

// 전역 런타임 자바스크립트 오류 포착기
window.onerror = function(message, source, lineno, colno, error) {
  alert(`[JS 에러 감지]\n메시지: ${message}\n소스: ${source}\n라인: ${lineno}, 열: ${colno}\n상세: ${error ? error.stack : 'N/A'}`);
  return false;
};

// 전역 상태 관리 객체
const state = {
  currentPart: 'part1', // 'part1' ~ 'part5'
  currentQuestionIndex: 0,
  questions: {}, // questions.js에서 가져올 데이터
  testMode: 'single', // 'single' (문항별 연습) 또는 'full' (전체 응시)
  micStream: null, // 상시 마이크 스트림 보관용
  
  // 시뮬레이터 상태
  gameState: 'idle', // 'idle', 'preparing', 'speaking'
  timer: 0,
  totalTimerDuration: 0,
  timerInterval: null,
  
  // 오디오 녹음 관련
  mediaRecorder: null,
  audioChunks: [],
  audioBlob: null,
  audioUrl: null,
  
  // 음성 인식 (STT) 관련
  recognition: null,
  isRecognitionActive: false,
  liveTranscript: '',
  fullTranscriptText: '', // 최종 분석용 누적 텍스트
  
  // 다중 질문 파트 전용 서브 인덱스 (Part 3, Part 4)
  subQuestionIndex: 0, // 0 -> Q5/Q8, 1 -> Q6/Q9, 2 -> Q7/Q10
  
  // 유저 환경설정
  targetGoal: 'IH',
  apiKey: '',
  currentPlayingAudio: null,
  countdownCallback: null,
  audioContext: null,
  analyser: null,
  visualizerAnimationId: null,
  
  // 실전 긴장감 모드 및 백색소음 관련
  examAmbientMode: false,
  ambientAudioCtx: null,
  ambientNoiseSource: null,
  ambientGain: null,
  isSpeakingGuide: false,
  shadowingWords: []
};

// Web Audio API를 이용한 비프음 생성 함수
function playBeep(frequency = 800, duration = 0.5) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("비프음 재생에 실패했습니다. 브라우저 정책 때문일 수 있습니다:", e);
  }
}

// Web Audio API를 활용한 가상 실전 시험장 웅성거림 백색소음 합성기
function startAmbientNoise() {
  if (!state.examAmbientMode) return;
  stopAmbientNoise();

  try {
    state.ambientAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const sampleRate = state.ambientAudioCtx.sampleRate;
    const bufferSize = 2 * sampleRate;
    const noiseBuffer = state.ambientAudioCtx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    state.ambientNoiseSource = state.ambientAudioCtx.createBufferSource();
    state.ambientNoiseSource.buffer = noiseBuffer;
    state.ambientNoiseSource.loop = true;
    
    const lowpass = state.ambientAudioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 280;
    
    const bandpass = state.ambientAudioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1100;
    bandpass.Q.value = 1.0;
    
    state.ambientGain = state.ambientAudioCtx.createGain();
    state.ambientGain.gain.value = 0.015;
    
    state.ambientNoiseSource.connect(lowpass);
    lowpass.connect(bandpass);
    bandpass.connect(state.ambientGain);
    state.ambientGain.connect(state.ambientAudioCtx.destination);
    
    state.ambientNoiseSource.start(0);
    console.log("시험장 앰비언트 노이즈 실시간 합성 재생 시작");
  } catch (err) {
    console.warn("앰비언트 노이즈 합성 실패:", err);
  }
}

function stopAmbientNoise() {
  try {
    if (state.ambientNoiseSource) {
      state.ambientNoiseSource.stop();
      state.ambientNoiseSource.disconnect();
      state.ambientNoiseSource = null;
    }
    if (state.ambientGain) {
      state.ambientGain.disconnect();
      state.ambientGain = null;
    }
    if (state.ambientAudioCtx && state.ambientAudioCtx.state !== 'closed') {
      state.ambientAudioCtx.close();
      state.ambientAudioCtx = null;
    }
    console.log("시험장 앰비언트 노이즈 재생 정지 완료");
  } catch (e) {
    console.warn("앰비언트 정지 처리 예외 무시:", e);
  }
}

// 실제 시험장 안내 성우 방송 비동기 재생 엔진
function playVoiceGuide(text) {
  return new Promise((resolve) => {
    if (!state.examAmbientMode) {
      resolve();
      return;
    }
    
    state.isSpeakingGuide = true;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      
      utterance.onend = () => {
        state.isSpeakingGuide = false;
        resolve();
      };
      utterance.onerror = () => {
        state.isSpeakingGuide = false;
        resolve();
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      state.isSpeakingGuide = false;
      resolve();
    }
  });
}

// 실시간 스피치 섀도잉 하이라이트용 단어 스팬 분할 렌더링 함수
function renderShadowingWords(text) {
  const container = document.getElementById('passage-text');
  if (!container) return;
  container.innerHTML = '';
  
  // 공백 단위로 쪼개서 특수 기호와 공백을 분리 보존하며 span 구성
  const tokens = text.split(/(\s+)/);
  state.shadowingWords = [];
  
  tokens.forEach(token => {
    if (token.trim() === '') {
      container.appendChild(document.createTextNode(token));
    } else {
      const cleanWord = token.replace(/[^a-zA-Z]/g, '').toLowerCase();
      
      const span = document.createElement('span');
      span.className = 'word-node';
      span.textContent = token;
      
      if (cleanWord.length > 0) {
        span.setAttribute('data-word', cleanWord);
        span.setAttribute('data-index', state.shadowingWords.length);
        state.shadowingWords.push({
          word: cleanWord,
          element: span,
          matched: false
        });
      }
      container.appendChild(span);
    }
  });
}

// 안전한 Lucide 아이콘 생성 헬퍼
function safeCreateIcons() {
  try {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (e) {
    console.warn("Lucide 아이콘 생성 예외 무시:", e);
  }
}

// Blob 데이터를 Base64 문자열로 변환하는 비동기 헬퍼
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// AI 동적 생성 문제의 타이머 값 누락 방지를 위한 안전 기본 시간 주입 가드
function sanitizeQuestionTimeData(data, part) {
  if (!data) return;
  
  if (part === 'part1' || part === 'part2') {
    if (typeof data.prepTime === 'undefined' || isNaN(parseInt(data.prepTime))) data.prepTime = 45;
    if (typeof data.respTime === 'undefined' || isNaN(parseInt(data.respTime))) data.respTime = 45;
  }
  else if (part === 'part3' || part === 'part4') {
    if (data.questions && Array.isArray(data.questions)) {
      data.questions.forEach((q, idx) => {
        if (typeof q.prepTime === 'undefined' || isNaN(parseInt(q.prepTime))) q.prepTime = 3;
        if (typeof q.respTime === 'undefined' || isNaN(parseInt(q.respTime))) {
          q.respTime = (idx === 2) ? 30 : 15;
        }
      });
    }
  }
  else if (part === 'part5') {
    if (typeof data.prepTime === 'undefined' || isNaN(parseInt(data.prepTime))) data.prepTime = 45;
    if (typeof data.respTime === 'undefined' || isNaN(parseInt(data.respTime))) data.respTime = 60;
  }
}

// 모바일 및 PC 통합 100% 무적 구글 Fallback 하이브리드 TTS 엔진
function speakText(text) {
  if (!text) return;
  
  // 이미 진행 중인 기기 내장 음성이 있다면 즉시 중단
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  try {
    // 1순위: 모바일 Safari/Chrome/모든 웹뷰에서 차단되지 않는 구글 번역 TTS 오디오 재생
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
    const audio = new Audio(url);
    audio.rate = 0.9;
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn("구글 Fallback TTS 재생 거부됨, 내장 SpeechSynthesis 실행:", err);
        speakSpeechSynthesis(text);
      });
    }
  } catch (err) {
    console.warn("구글 Fallback TTS 초기화 예외, 내장 SpeechSynthesis 실행:", err);
    speakSpeechSynthesis(text);
  }
}

// 2순위: 기기 내장 Web Speech API 백업
function speakSpeechSynthesis(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } else {
    alert("이 기기 브라우저에서는 음성 합성(TTS) 재생이 제공되지 않습니다.");
  }
}

// 실시간 마이크 오디오 파형 시각화(Audio Visualizer) 드로잉 엔진
function startAudioVisualizer(stream) {
  if (!stream || !ui.audioVisualizer) return;
  
  // 기존 애니메이션 루틴 정지
  stopAudioVisualizer();

  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    
    const source = state.audioContext.createMediaStreamSource(stream);
    source.connect(state.analyser);
    
    const canvas = ui.audioVisualizer;
    const ctx = canvas.getContext('2d');
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // 캔버스 크기를 부모 크기와 매칭
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    function draw() {
      state.visualizerAnimationId = requestAnimationFrame(draw);
      
      state.analyser.getByteTimeDomainData(dataArray);
      
      // 배경 투명 지우기
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 부드러운 네온 보라색 그라데이션 선 설정
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
      
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 0.0 ~ 2.0
        const y = (v * canvas.height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
    
    draw();
    
    // 리사이즈 리스너 보관용 속성 동적 추가
    canvas._resizeHandler = resizeCanvas;
  } catch (err) {
    console.warn("오디오 시각화 엔진 초기화 실패:", err);
  }
}

function stopAudioVisualizer() {
  if (state.visualizerAnimationId) {
    cancelAnimationFrame(state.visualizerAnimationId);
    state.visualizerAnimationId = null;
  }
  
  const canvas = ui.audioVisualizer;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (canvas._resizeHandler) {
      window.removeEventListener('resize', canvas._resizeHandler);
      canvas._resizeHandler = null;
    }
  }
  
  if (state.analyser) {
    state.analyser.disconnect();
    state.analyser = null;
  }
  
  if (state.audioContext && state.audioContext.state !== 'closed') {
    state.audioContext.close();
    state.audioContext = null;
  }
}

// 건너뛰기 버튼 상태 동기화 헬퍼
function updateSkipButtonUI() {
  if (!ui || !ui.btnSkipTest) return;
  
  if (state.gameState === 'idle') {
    ui.btnSkipTest.style.display = 'none';
  } else {
    ui.btnSkipTest.style.display = 'inline-flex';
    if (state.gameState === 'preparing') {
      ui.btnSkipTest.innerHTML = '<i data-lucide="fast-forward"></i><span>준비 건너뛰기</span>';
    } else if (state.gameState === 'speaking') {
      ui.btnSkipTest.innerHTML = '<i data-lucide="check-circle"></i><span>답변 완료</span>';
    }
    safeCreateIcons();
  }
}

// UI 요소 셀렉터
const ui = {
  // 사이드바 및 헤더
  navItems: document.querySelectorAll('.nav-item'),
  partTitle: document.getElementById('current-part-title'),
  partDesc: document.getElementById('current-part-desc'),
  goalSelect: document.getElementById('goal-select'),
  apiStatusBadge: document.getElementById('api-status-badge'),
  btnSettings: document.getElementById('btn-settings'),
  modeRadios: document.querySelectorAll('input[name="test-mode"]'),
  btnMicToggle: document.getElementById('btn-mic-toggle'),
  btnMicToggleIcon: document.getElementById('btn-mic-toggle-icon'),
  btnMicToggleText: document.getElementById('btn-mic-toggle-text'),
  
  // 문제 카드 영역
  btnPrevQ: document.getElementById('btn-prev-question'),
  btnNextQ: document.getElementById('btn-next-question'),
  qIndexText: document.getElementById('question-index'),
  instructionText: document.getElementById('instruction-text'),
  
  // 파트별 콘텐츠 영역
  partContents: {
    part1: document.getElementById('content-part1'),
    part2: document.getElementById('content-part2'),
    part3: document.getElementById('content-part3'),
    part4: document.getElementById('content-part4'),
    part5: document.getElementById('content-part5')
  },
  
  // Part 1
  passageText: document.getElementById('passage-text'),
  
  // Part 2
  pictureImg: document.getElementById('picture-img'),
  
  // Part 3
  part3QuestionsList: document.querySelector('.part3-questions-list'),
  part3Context: document.getElementById('part3-context'),
  part3QItems: document.querySelectorAll('.part3-question-item'),
  part3Q5: document.getElementById('part3-q5-text'),
  part3Q6: document.getElementById('part3-q6-text'),
  part3Q7: document.getElementById('part3-q7-text'),
  
  // Part 4
  part4DocTitle: document.getElementById('part4-doc-title'),
  part4DocDate: document.getElementById('part4-doc-date'),
  part4TableBody: document.getElementById('part4-table-body'),
  part4QLabel: document.getElementById('part4-current-q-label'),
  part4QText: document.getElementById('part4-q-text'),
  part4QuestionTabs: document.querySelector('.part4-question-tabs'),
  part4QTabs: document.querySelectorAll('.part4-q-tab'),
  
  // Part 5
  part5QText: document.getElementById('part5-question-text'),
  
  // 타이머 및 컨트롤
  timerStateLabel: document.getElementById('timer-state-label'),
  timerProgress: document.getElementById('timer-progress'),
  timerClock: document.getElementById('timer-clock'),
  
  micStatusContainer: document.querySelector('.mic-status-container'),
  micStatusText: document.getElementById('mic-status-text'),
  sttLivePreview: document.getElementById('stt-live-preview'),
  
  btnStartTest: document.getElementById('btn-start-test'),
  btnSkipTest: document.getElementById('btn-skip-test'),
  btnPlayAudio: document.getElementById('btn-play-audio'),
  btnAnalyze: document.getElementById('btn-analyze'),
  
  // 피드백 패널
  feedbackSection: document.getElementById('feedback-section'),
  feedbackTargetGoal: document.getElementById('feedback-target-goal'),
  highlightedTranscript: document.getElementById('highlighted-transcript'),
  estimatedToeicScore: document.getElementById('estimated-toeic-score'),
  estimatedToeicLevel: document.getElementById('estimated-toeic-level'),
  scorePronVal: document.getElementById('score-pron-val'),
  scorePronFill: document.getElementById('score-pron-fill'),
  scoreIntoVal: document.getElementById('score-into-val'),
  scoreIntoFill: document.getElementById('score-into-fill'),
  scoreGramVal: document.getElementById('score-gram-val'),
  scoreGramFill: document.getElementById('score-gram-fill'),
  scoreVocVal: document.getElementById('score-voc-val'),
  scoreVocFill: document.getElementById('score-voc-fill'),
  audioVisualizer: document.getElementById('audio-visualizer'),
  pronFeedbackText: document.getElementById('pron-feedback-text'),
  structFeedbackText: document.getElementById('struct-feedback-text'),
  correctionTableBody: document.getElementById('correction-table-body'),
  modelTargetBadge: document.getElementById('model-target-badge'),
  modelAnswerText: document.getElementById('model-answer-text'),
  modelAnswerTipsText: document.getElementById('model-answer-tips-text'),
  btnReadModel: document.getElementById('btn-read-model'),
  // 모달 및 로딩
  settingsModal: document.getElementById('settings-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  geminiApiKeyInput: document.getElementById('gemini-api-key'),
  loadingOverlay: document.getElementById('loading-overlay'),
  
  // 신규 문제 생성 및 즐겨찾기
  btnGenerateQ: document.getElementById('btn-generate-q'),
  btnFavoriteToggle: document.getElementById('btn-favorite-toggle'),
  btnMicToggle: document.getElementById('btn-mic-toggle'),
  favoritesList: document.getElementById('favorites-list'),
  btnSettingsFloating: document.getElementById('btn-settings-floating')
};

// 1. 애플리케이션 초기화
function init() {
  // questions.js 로드 검증 자가 진단
  if (!window.toeicSpeakingQuestions && !window.TOEIC_SPEAKING_QUESTIONS) {
    alert("[시스템 알림] questions.js(기본 문제 데이터)가 정상적으로 로드되지 않았습니다!\n깃허브 저장소에 'questions.js' 파일이 소문자로 정확히 업로드되어 있는지 확인해 주세요.");
  }

  // Lucide 아이콘 초기화
  safeCreateIcons();
  
  // 로컬 스토리지에서 설정 및 API Key 로드
  state.apiKey = localStorage.getItem('gemini_api_key') || '';
  state.targetGoal = localStorage.getItem('toeic_target_goal') || 'IH';
  state.testMode = localStorage.getItem('toeic_test_mode') || 'single';
  state.examAmbientMode = localStorage.getItem('toeic_exam_ambient') === 'true';
  
  // UI에 상태 반영
  ui.geminiApiKeyInput.value = state.apiKey;
  ui.goalSelect.value = state.targetGoal;
  
  const ambientCheckbox = document.getElementById('settings-exam-ambient');
  if (ambientCheckbox) {
    ambientCheckbox.checked = state.examAmbientMode;
  }
  
  ui.modeRadios.forEach(radio => {
    if (radio.value === state.testMode) {
      radio.checked = true;
    }
  });
  updateApiBadge();

  // API Key가 없으면 3초 원클릭 가이드 모달 자동 활성화
  if (!state.apiKey) {
    setTimeout(() => {
      ui.settingsModal.classList.add('active');
    }, 800);
  }
  
  // 문제 데이터 병합 바인딩 (questions.js + 로컬 저장소 동적 문제)
  const baseQuestions = window.toeicSpeakingQuestions || window.TOEIC_SPEAKING_QUESTIONS || { part1: [], part2: [], part3: [], part4: [], part5: [] };
  
  // 예제 문제에 고유 ID 부여 (base-[part]-[idx])
  Object.keys(baseQuestions).forEach(part => {
    baseQuestions[part].forEach((q, idx) => {
      q.id = `base-${part}-${idx}`;
    });
  });
  
  // 로컬 저장소 동적 문제 데이터 로드
  const savedDynamic = localStorage.getItem('toeic_dynamic_questions');
  let dynamicQuestions = savedDynamic ? JSON.parse(savedDynamic) : { part1: [], part2: [], part3: [], part4: [], part5: [] };
  
  // 비정상 세포 현미경 사진(photo-1576086213369-97a306d36557) 데이터 자동 영구 필터링 소거
  if (dynamicQuestions.part2) {
    dynamicQuestions.part2 = dynamicQuestions.part2.filter(q => !q.imageUrl || !q.imageUrl.includes('photo-1576086213369-97a306d36557'));
    localStorage.setItem('toeic_dynamic_questions', JSON.stringify(dynamicQuestions));
  }
  
  // 안전하게 데이터 병합 (동적 AI 문항은 항상 가장 최신 1개만 노출하여 덮어쓰기 구현)
  state.questions = {
    part1: [...baseQuestions.part1, ...(dynamicQuestions.part1 && dynamicQuestions.part1.length > 0 ? [dynamicQuestions.part1[dynamicQuestions.part1.length - 1]] : [])],
    part2: [...baseQuestions.part2, ...(dynamicQuestions.part2 && dynamicQuestions.part2.length > 0 ? [dynamicQuestions.part2[dynamicQuestions.part2.length - 1]] : [])],
    part3: [...baseQuestions.part3, ...(dynamicQuestions.part3 && dynamicQuestions.part3.length > 0 ? [dynamicQuestions.part3[dynamicQuestions.part3.length - 1]] : [])],
    part4: [...baseQuestions.part4, ...(dynamicQuestions.part4 && dynamicQuestions.part4.length > 0 ? [dynamicQuestions.part4[dynamicQuestions.part4.length - 1]] : [])],
    part5: [...baseQuestions.part5, ...(dynamicQuestions.part5 && dynamicQuestions.part5.length > 0 ? [dynamicQuestions.part5[dynamicQuestions.part5.length - 1]] : [])]
  };
  
  // 이벤트 리스너 등록
  bindEvents();
  
  // 초기 화면 렌더링
  renderQuestion();
  
  // Web Speech API 초기화 지원 검사
  initSTT();
}

// API 상태 배지 업데이트
function updateApiBadge() {
  if (state.apiKey) {
    ui.apiStatusBadge.className = 'api-status-badge connected';
    ui.apiStatusBadge.querySelector('.status-text').textContent = 'API 키 등록됨';
  } else {
    ui.apiStatusBadge.className = 'api-status-badge disconnected';
    ui.apiStatusBadge.querySelector('.status-text').textContent = 'API 키 미등록';
  }
}

// 2. 이벤트 리스너 바인딩
function bindEvents() {
  // 사이드바 카테고리 탭 클릭
  ui.navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (state.gameState !== 'idle') {
        alert("시험이 진행 중일 때는 유형을 바꿀 수 없습니다.");
        return;
      }
      ui.navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      const part = item.getAttribute('data-part');
      state.currentPart = part;
      
      if (part === 'favorites') {
        // 즐겨찾기 보관함 진입 시
        renderFavoritesList();
        
        // 문제 카드와 하단 스피치 컨트롤 패널, 피드백 가림
        document.querySelector('.question-section').classList.add('hidden');
        document.querySelector('.control-section').classList.add('hidden');
        ui.feedbackSection.classList.add('hidden');
        
        // 파트별 본문 콘텐츠 숨김 및 보관함 콘텐츠 노출
        Object.keys(ui.partContents).forEach(key => {
          ui.partContents[key].classList.remove('active');
        });
        document.getElementById('content-favorites').classList.add('active');
        document.getElementById('content-dashboard').classList.remove('active');
      } else if (part === 'dashboard') {
        // 나의 성적 대시보드 진입 시
        renderDashboard();
        
        // 문제 카드와 하단 스피치 컨트롤 패널, 피드백 가림
        document.querySelector('.question-section').classList.add('hidden');
        document.querySelector('.control-section').classList.add('hidden');
        ui.feedbackSection.classList.add('hidden');
        
        // 파트별 본문 콘텐츠 숨김 및 대시보드 콘텐츠 노출
        Object.keys(ui.partContents).forEach(key => {
          ui.partContents[key].classList.remove('active');
        });
        document.getElementById('content-favorites').classList.remove('active');
        document.getElementById('content-dashboard').classList.add('active');
      } else {
        state.currentQuestionIndex = 0;
        state.subQuestionIndex = 0;
        
        // 숨겼던 문제 카드와 컨트롤 패널 복원
        document.querySelector('.question-section').classList.remove('hidden');
        document.querySelector('.control-section').classList.remove('hidden');
        
        // 보관함 및 대시보드 비활성화
        document.getElementById('content-favorites').classList.remove('active');
        document.getElementById('content-dashboard').classList.remove('active');
        
        renderQuestion();
        resetSimulator();
      }
    });
  });
  
  // 이전/다음 문제 스위처
  ui.btnPrevQ.addEventListener('click', () => {
    if (state.currentPart === 'favorites') return;
    if (state.currentQuestionIndex > 0) {
      state.currentQuestionIndex--;
      state.subQuestionIndex = 0;
      renderQuestion();
      resetSimulator();
    }
  });
  
  ui.btnNextQ.addEventListener('click', () => {
    if (state.currentPart === 'favorites') return;
    const maxIndex = state.questions[state.currentPart].length;
    if (state.currentQuestionIndex < maxIndex - 1) {
      state.currentQuestionIndex++;
      state.subQuestionIndex = 0;
      renderQuestion();
      resetSimulator();
    }
  });
  
  // 목표 등급 변경 이벤트
  ui.goalSelect.addEventListener('change', (e) => {
    state.targetGoal = e.target.value;
    localStorage.setItem('toeic_target_goal', state.targetGoal);
  });
  
  // 응시 모드 토글 라디오 이벤트
  ui.modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (state.gameState !== 'idle') {
        alert("연습이 진행 중일 때는 응시 모드를 변경할 수 없습니다.");
        // 이전 값으로 복원
        ui.modeRadios.forEach(r => r.checked = (r.value === state.testMode));
        return;
      }
      state.testMode = e.target.value;
      localStorage.setItem('toeic_test_mode', state.testMode);
      resetSimulator();
      renderQuestion();
    });
  });
  
  // Part 3 개별 질문 클릭 이벤트
  ui.part3QItems.forEach((item, idx) => {
    item.addEventListener('click', () => {
      if (state.testMode !== 'single') return; // 전체 응시 모드에선 클릭 무시
      if (state.gameState !== 'idle') return;  // 연습 중엔 클릭 무시
      
      state.subQuestionIndex = idx;
      updatePart3ActiveQuestionUI();
    });
  });
  
  // Part 4 개별 탭 클릭 이벤트
  ui.part4QTabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      if (state.testMode !== 'single') return;
      if (state.gameState !== 'idle') return;
      
      state.subQuestionIndex = idx;
      updatePart4ActiveQuestionUI();
    });
  });
  
  // Settings 모달 제어
  ui.btnSettings.addEventListener('click', () => {
    ui.settingsModal.classList.add('active');
  });
  
  if (ui.btnSettingsFloating) {
    ui.btnSettingsFloating.addEventListener('click', () => {
      ui.settingsModal.classList.add('active');
    });
  }
  
  ui.btnCloseModal.addEventListener('click', () => {
    ui.settingsModal.classList.remove('active');
  });
  
  ui.btnSaveSettings.addEventListener('click', () => {
    const key = ui.geminiApiKeyInput.value.trim();
    state.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
    
    const ambientCheckbox = document.getElementById('settings-exam-ambient');
    if (ambientCheckbox) {
      state.examAmbientMode = ambientCheckbox.checked;
      localStorage.setItem('toeic_exam_ambient', state.examAmbientMode);
    }
    
    updateApiBadge();
    ui.settingsModal.classList.remove('active');
    alert("설정이 성공적으로 저장되었습니다.");
  });
  
  // 연습 시작 / 정지 버튼
  ui.btnStartTest.addEventListener('click', () => {
    if (state.gameState === 'idle') {
      startToeicSimulation();
    } else {
      stopSimulation();
    }
  });
  
  // 연습 단계 건너뛰기 버튼
  ui.btnSkipTest.addEventListener('click', () => {
    skipCountdown();
  });
  
  // 녹음 오디오 재생 / 중지 토글 버튼
  ui.btnPlayAudio.addEventListener('click', () => {
    if (state.currentPlayingAudio) {
      // 재생 중인 오디오가 이미 존재한다면 -> 즉각 중지 처리
      try {
        state.currentPlayingAudio.pause();
        state.currentPlayingAudio.currentTime = 0;
      } catch (e) {
        console.warn("오디오 중지 처리 예외 무시:", e);
      }
      state.currentPlayingAudio = null;
      ui.btnPlayAudio.innerHTML = '<i data-lucide="play"></i><span>답변 듣기</span>';
      safeCreateIcons();
      return;
    }

    if (state.audioUrl) {
      const audio = new Audio(state.audioUrl);
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        state.currentPlayingAudio = audio;
        ui.btnPlayAudio.innerHTML = '<i data-lucide="square"></i><span>듣기 중지</span>';
        safeCreateIcons();
        
        playPromise.then(() => {
          audio.onended = () => {
            state.currentPlayingAudio = null;
            ui.btnPlayAudio.innerHTML = '<i data-lucide="play"></i><span>답변 듣기</span>';
            safeCreateIcons();
          };
        }).catch(err => {
          console.warn("오디오 재생 거부 예외 감지:", err);
          alert("이 모바일 환경 브라우저(인앱 등)에서는 음성 녹음 파일 재생 기능이 제한되거나 차단되었습니다. 모바일 Chrome/Safari 이용을 권장합니다.");
          state.currentPlayingAudio = null;
          ui.btnPlayAudio.innerHTML = '<i data-lucide="play"></i><span>답변 듣기</span>';
          safeCreateIcons();
        });
      }
    }
  });
  
  // AI 분석 요청 버튼
  ui.btnAnalyze.addEventListener('click', () => {
    requestAiFeedback();
  });
  
  // 추천 답변 TTS 듣기
  ui.btnReadModel.addEventListener('click', () => {
    const textToSpeak = ui.modelAnswerText.innerText;
    if (!textToSpeak) return;
    
    // 모바일 무적 재생 하이브리드 TTS 실행
    speakText(textToSpeak);
  });

  // AI 문제 생성 이벤트
  ui.btnGenerateQ.addEventListener('click', generateAiQuestion);

  // 즐겨찾기 보관 토글 이벤트
  ui.btnFavoriteToggle.addEventListener('click', toggleCurrentFavorite);

  // 마이크 수동 연결 토글
  ui.btnMicToggle.addEventListener('click', toggleManualMic);
}

// 마이크 수동 설정 ON/OFF 비동기 함수
async function toggleManualMic() {
  if (state.gameState !== 'idle') {
    alert("연습이 진행 중일 때는 마이크 연결 설정을 변경할 수 없습니다.");
    return;
  }
  
  if (!state.micStream) {
    try {
      state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // UI 업데이트
      ui.btnMicToggle.className = 'mic-toggle-btn connected';
      ui.btnMicToggle.innerHTML = '<i data-lucide="mic"></i><span>마이크 켜짐</span>';
      safeCreateIcons();
      console.log("마이크 스트림 상시 획득 성공");
      
      // 실시간 시각화 시작
      startAudioVisualizer(state.micStream);
    } catch (err) {
      console.error("마이크 접근 실패:", err);
      alert("마이크 연결 실패: 브라우저 환경설정에서 마이크 권한을 허용해 주세요.");
    }
  } else {
    state.micStream.getTracks().forEach(track => track.stop());
    state.micStream = null;
    
    // UI 업데이트
    ui.btnMicToggle.className = 'mic-toggle-btn disconnected';
    ui.btnMicToggle.innerHTML = '<i data-lucide="mic-off"></i><span>마이크 대기</span>';
    safeCreateIcons();
    console.log("마이크 스트림 상시 획득 해제");
    
    // 실시간 시각화 중지
    stopAudioVisualizer();
  }
}

// 3. 문제 렌더링 시스템
function renderQuestion() {
  const part = state.currentPart;
  const index = state.currentQuestionIndex;
  const partDataList = state.questions[part];
  
  if (!partDataList || partDataList.length === 0) return;
  
  const data = partDataList[index];
  sanitizeQuestionTimeData(data, part);
  
  // 즐겨찾기 버튼 상태 실시간 동기화
  updateFavoriteBtnState();
  
  // 이전/다음 버튼 비활성화 상태 업데이트
  ui.btnPrevQ.disabled = (index === 0);
  ui.btnNextQ.disabled = (index === partDataList.length - 1);
  ui.qIndexText.textContent = `문제 ${index + 1} / ${partDataList.length}`;
  
  // 지시문 세팅
  ui.instructionText.textContent = data.instruction;
  
  // 타이틀 변경
  let partTitleKr = "";
  let partDescKr = "";
  
  switch (part) {
    case 'part1':
      partTitleKr = "유형 1: Read a text aloud (문장 읽기)";
      partDescKr = "화면의 지문을 주어진 시간 동안 준비하고 소리 내어 읽으십시오.";
      break;
    case 'part2':
      partTitleKr = "유형 2: Describe a picture (사진 묘사)";
      partDescKr = "화면의 사진을 주어진 시간 동안 준비하고 가능한 한 자세히 묘사하십시오.";
      break;
    case 'part3':
      partTitleKr = "유형 3: Respond to questions (질문에 답하기)";
      partDescKr = "전화 인터뷰라 가정하고 각 질문에 대해 준비 시간 후 즉각 답하십시오.";
      break;
    case 'part4':
      partTitleKr = "유형 4: Respond to questions using info (제공된 정보로 답하기)";
      partDescKr = "제공된 표를 주어진 시간 동안 분석하고, 이를 바탕으로 이어지는 질문에 답하십시오.";
      break;
    case 'part5':
      partTitleKr = "유형 5: Express an opinion (의견 제시하기)";
      partDescKr = "특정 주제에 대해 본인의 의견을 논리적으로 말하십시오.";
      break;
  }
  
  ui.partTitle.textContent = partTitleKr;
  ui.partDesc.textContent = partDescKr;
  
  // 파트별 콘텐츠 영역 활성화
  Object.keys(ui.partContents).forEach(key => {
    if (key === part) {
      ui.partContents[key].classList.add('active');
    } else {
      ui.partContents[key].classList.remove('active');
    }
  });
  
  // 데이터 바인딩
  if (part === 'part1') {
    renderShadowingWords(data.text);
  } 
  else if (part === 'part2') {
    ui.pictureImg.src = "";
    document.querySelector('.img-loader').style.display = 'flex';
    
    // 이미지 프리로드
    const img = new Image();
    img.src = data.imageUrl;
    img.onload = () => {
      ui.pictureImg.src = data.imageUrl;
      document.querySelector('.img-loader').style.display = 'none';
    };
  } 
  else if (part === 'part3') {
    ui.part3Context.textContent = data.context;
    ui.part3Q5.textContent = data.questions[0].text;
    ui.part3Q6.textContent = data.questions[1].text;
    ui.part3Q7.textContent = data.questions[2].text;
    
    // 문항별 연습 모드일 때 클릭 가능하도록 인터랙티브 클래스 부여
    if (state.testMode === 'single') {
      ui.part3QuestionsList.classList.add('interactive');
    } else {
      ui.part3QuestionsList.classList.remove('interactive');
    }
    
    // 질문 활성화 클래스 초기화
    updatePart3ActiveQuestionUI();
  } 
  else if (part === 'part4') {
    ui.part4DocTitle.textContent = data.infoTitle;
    ui.part4DocDate.textContent = data.infoDate;
    
    // 테이블 빌드
    ui.part4TableBody.innerHTML = '';
    data.infoDetails.forEach(row => {
      const tr = document.createElement('tr');
      const tdTime = document.createElement('td');
      tdTime.textContent = row.time;
      const tdDetail = document.createElement('td');
      tdDetail.innerHTML = `<strong>${row.event}</strong>${row.speaker ? `<br><span style="color: var(--text-secondary);">${row.speaker}</span>` : ''}`;
      tr.appendChild(tdTime);
      tr.appendChild(tdDetail);
      ui.part4TableBody.appendChild(tr);
    });
    
    if (state.testMode === 'single') {
      ui.part4QuestionTabs.classList.add('interactive');
      document.querySelector('.part4-question-box').classList.remove('disabled-box');
      updatePart4ActiveQuestionUI();
    } else {
      ui.part4QuestionTabs.classList.remove('interactive');
      ui.part4QLabel.textContent = `Q${data.questions[0].num}`;
      ui.part4QText.textContent = "표를 읽고 분석하는 시간입니다 (45초).";
      document.querySelector('.part4-question-box').classList.add('disabled-box');
      
      // 탭 기본 활성화 세팅
      ui.part4QTabs.forEach((tab, idx) => {
        if (idx === 0) tab.classList.add('active');
        else tab.classList.remove('active');
      });
    }
  } 
  else if (part === 'part5') {
    ui.part5QText.innerHTML = data.questionText.replace(/\n/g, '<br>');
  }
}

// Part 3 하위 질문 UI 활성화 변경
function updatePart3ActiveQuestionUI() {
  ui.part3QItems.forEach((item, idx) => {
    const isSelected = idx === state.subQuestionIndex;
    // single 모드일 때는 대기 중에도 선택된 질문이 활성화되어 노출되어야 함
    const shouldHighlight = (state.testMode === 'single') ? isSelected : (state.gameState !== 'idle' && isSelected);
    
    if (shouldHighlight) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
    
    // 실전 전체 응시 모드 가드: 대기 중이 아닐 때는 현재 차례인 문항의 텍스트만 노출
    const questionTextEl = item.querySelector('p');
    if (questionTextEl) {
      if (state.testMode === 'full' && state.gameState !== 'idle') {
        if (isSelected) {
          questionTextEl.style.display = 'block';
        } else {
          questionTextEl.style.display = 'none';
        }
      } else {
        questionTextEl.style.display = 'block';
      }
    }
  });
}

// Part 4 하위 질문 UI 활성화 변경 및 텍스트 갱신
function updatePart4ActiveQuestionUI() {
  const part = state.currentPart;
  const index = state.currentQuestionIndex;
  const data = state.questions[part][index];
  const qData = data.questions[state.subQuestionIndex];
  
  ui.part4QLabel.textContent = `Question ${qData.num}`;
  
  // idle 상태일 때만 질문 텍스트 노출 (준비 단계나 답변 단계에서는 알아서 진행에 맞춰 렌더링되므로)
  if (state.gameState === 'idle') {
    ui.part4QText.textContent = qData.text;
  }
  
  ui.part4QTabs.forEach((tab, idx) => {
    if (idx === state.subQuestionIndex) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

// 4. Web Speech API (STT) 초기화
function initSTT() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("이 브라우저는 Web Speech API(음성 인식)를 완전히 지원하지 않습니다. Chrome을 권장합니다.");
    ui.sttLivePreview.textContent = "음성 인식이 지원되지 않는 브라우저입니다. Chrome 브라우저를 사용해 주세요.";
    return;
  }
  
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'en-US'; // 토익스피킹은 영어 말하기 시험
  
  state.recognition.onstart = () => {
    state.isRecognitionActive = true;
    console.log("STT 음성 인식 시작됨");
  };
  
  state.recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    if (finalTranscript) {
      state.liveTranscript += finalTranscript;
    }
    
    // 실시간 라이브 프리뷰 노출
    const displayText = state.liveTranscript + interimTranscript;
    ui.sttLivePreview.textContent = displayText || "말씀을 시작하세요...";
    
    // 실시간 섀도잉 단어 매칭 및 색상 변화 적용
    if (state.currentPart === 'part1' && state.shadowingWords && state.shadowingWords.length > 0 && displayText) {
      const userWords = displayText.toLowerCase().replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
      
      let lastMatchedIdx = -1;
      state.shadowingWords.forEach((target, targetIdx) => {
        const searchStart = lastMatchedIdx + 1;
        const foundIdx = userWords.indexOf(target.word, searchStart);
        
        if (foundIdx !== -1) {
          target.matched = true;
          target.element.classList.add('match-correct');
          lastMatchedIdx = foundIdx;
        }
      });
      
      // 현재 리딩 포커스 단어(match-current) 하이라이팅
      state.shadowingWords.forEach((target, targetIdx) => {
        target.element.classList.remove('match-current');
        if (targetIdx === lastMatchedIdx + 1) {
          target.element.classList.add('match-current');
        }
      });
    }
  };
  
  state.recognition.onerror = (event) => {
    console.error("STT 에러 발생:", event.error);
    if (event.error === 'not-allowed') {
      ui.sttLivePreview.textContent = "마이크 사용 권한이 거부되었습니다. 주소창 옆 마이크 아이콘을 확인하세요.";
    }
  };
  
  state.recognition.onend = () => {
    state.isRecognitionActive = false;
    console.log("STT 음성 인식 종료됨");
  };
}

// STT 시작
function startSTT() {
  if (state.recognition && !state.isRecognitionActive) {
    state.liveTranscript = '';
    ui.sttLivePreview.textContent = "음성을 인식하기 시작합니다...";
    try {
      state.recognition.start();
    } catch (e) {
      console.warn("STT 시작 실패:", e);
    }
  }
}

// STT 중지 및 텍스트 반환
function stopSTT() {
  if (state.recognition && state.isRecognitionActive) {
    state.recognition.stop();
  }
  return state.liveTranscript.trim();
}

// 5. 오디오 녹음 시스템 (MediaRecorder)
async function startAudioRecording() {
  state.audioChunks = [];
  try {
    // 상시 마이크 스트림이 연결되어 있으면 그것을 재사용, 없으면 임시로 획득
    let stream = state.micStream;
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    
    state.mediaRecorder = new MediaRecorder(stream);
    
    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.audioChunks.push(event.data);
      }
    };
    
    state.mediaRecorder.onstop = () => {
      state.audioBlob = new Blob(state.audioChunks, { type: 'audio/wav' });
      state.audioUrl = URL.createObjectURL(state.audioBlob);
      ui.btnPlayAudio.disabled = false;
      console.log("오디오 녹음 완료, 재생 준비됨:", state.audioUrl);
      
      // 상시 마이크 스트림이 연결되지 않았을 때만 마이크 채널 종료 및 시각화 종료
      if (!state.micStream) {
        stream.getTracks().forEach(track => track.stop());
        stopAudioVisualizer();
      }
    };
    
    state.mediaRecorder.start();
    ui.micStatusContainer.classList.add('recording');
    ui.micStatusText.textContent = "답변 녹음 및 인식 중...";
    
    // 상시 마이크가 아닐 때도 visualizer 켜기
    if (!state.micStream) {
      startAudioVisualizer(stream);
    }
  } catch (err) {
    console.error("마이크 접근 실패:", err);
    ui.micStatusText.textContent = "마이크 획득 실패 (권한 필요)";
    alert("마이크 연결 실패: 브라우저 환경설정에서 마이크 권한을 허용해 주세요.");
  }
}

function stopAudioRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  ui.micStatusContainer.classList.remove('recording');
  ui.micStatusText.textContent = "녹음 완료";
}

// 준비 시간 등으로 녹음 일시 정지 (다중 질문 흐름용)
function pauseAudioRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
    state.mediaRecorder.pause();
    if (state.recognition && state.isRecognitionActive) {
      state.recognition.stop(); // STT도 잠시 중단
    }
    ui.micStatusContainer.classList.remove('recording');
    ui.micStatusText.textContent = "준비 시간 대기 중 (녹음 일시정지)";
  }
}

// 녹음 재개
function resumeAudioRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state === 'paused') {
    state.mediaRecorder.resume();
    startSTT(); // STT 재개
    ui.micStatusContainer.classList.add('recording');
    ui.micStatusText.textContent = "답변 녹음 및 인식 중...";
  }
}

// 6. 타이머 및 시험 시뮬레이터 제어
function resetSimulator() {
  clearInterval(state.timerInterval);
  stopAmbientNoise();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.gameState = 'idle';
  state.timer = 0;
  state.totalTimerDuration = 0;
  ui.timerClock.textContent = "00";
  ui.timerProgress.style.width = "0%";
  ui.timerStateLabel.className = 'state-idle';
  ui.timerStateLabel.textContent = '대기 중';
  ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>연습 시작</span>';
  ui.btnStartTest.className = 'btn btn-primary';
  ui.btnPlayAudio.disabled = true;
  ui.btnAnalyze.disabled = true;
  ui.feedbackSection.classList.add('hidden');
  
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  if (state.recognition && state.isRecognitionActive) {
    state.recognition.stop();
  }
  ui.micStatusContainer.classList.remove('recording');
  ui.micStatusText.textContent = "마이크 대기";
  ui.sttLivePreview.textContent = "말씀하시면 여기에 실시간으로 텍스트가 표시됩니다...";
  state.fullTranscriptText = '';
  
  if (state.shadowingWords && state.shadowingWords.length > 0) {
    state.shadowingWords.forEach(target => {
      target.matched = false;
      target.element.classList.remove('match-correct', 'match-current');
    });
  }
  
  if (!state.micStream) {
    stopAudioVisualizer();
  }
  
  updateSkipButtonUI();
  safeCreateIcons();
}

// 시뮬레이션 시작 분기
function startToeicSimulation() {
  state.gameState = 'preparing';
  ui.btnStartTest.innerHTML = '<i data-lucide="square"></i><span>연습 중단</span>';
  ui.btnStartTest.className = 'btn btn-secondary';
  ui.btnPlayAudio.disabled = true;
  ui.btnAnalyze.disabled = true;
  ui.feedbackSection.classList.add('hidden');
  state.fullTranscriptText = '';
  updateSkipButtonUI();
  safeCreateIcons();
  
  const part = state.currentPart;
  const data = state.questions[part][state.currentQuestionIndex];
  sanitizeQuestionTimeData(data, part);
  
  if (part === 'part3') {
    if (state.testMode === 'single') {
      runPart3FlowSingle(data);
    } else {
      state.subQuestionIndex = 0;
      runPart3Flow(data);
    }
  } else if (part === 'part4') {
    if (state.testMode === 'single') {
      runPart4FlowSingle(data);
    } else {
      state.subQuestionIndex = 0;
      runPart4Flow(data);
    }
  } else {
    // 일반 파트 (Part 1, Part 2, Part 5)
    runStandardFlow(data.prepTime, data.respTime);
  }
}

// 강제 중단
function stopSimulation() {
  resetSimulator();
}

// 7. 파트별 흐름 로직

// (A) 일반 파트 흐름 (Part 1, 2, 5)
function runStandardFlow(prepTime, respTime) {
  const part = state.currentPart;
  let prepGuide = "Begin preparing now.";
  let respGuide = "Begin speaking now.";
  
  if (part === 'part1') {
    prepGuide = "You will have 45 seconds to prepare the text. Begin preparing now.";
    respGuide = "Begin reading aloud now.";
  } else if (part === 'part2') {
    prepGuide = "You will have 45 seconds to prepare. Begin preparing now.";
    respGuide = "Begin speaking now.";
  } else if (part === 'part5') {
    prepGuide = "You will have 45 seconds to prepare. Begin preparing now.";
    respGuide = "Begin speaking now.";
  }

  // 1단계: 준비 시간
  state.gameState = 'preparing';
  updateSkipButtonUI();
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = '준비 시간';
  
  // 안내 멘트 방송 완료 후 카운트다운 시작
  playVoiceGuide(prepGuide).then(() => {
    // 멘트가 종료되면 비프음 출력 후 타이머 가동
    playBeep(800, 0.4);
    
    runCountdown(prepTime, () => {
      // 2단계: 답변 시간 가이드 방송 재생
      playVoiceGuide(respGuide).then(() => {
        // 비프음 재생 후 답변 단계로 진입
        playBeep(800, 0.8);
        
        state.gameState = 'speaking';
        updateSkipButtonUI();
        ui.timerStateLabel.className = 'state-prep';
        ui.timerStateLabel.textContent = '답변 시간';
        
        // 웅성거림 백색소음 실시간 합성 시작
        startAmbientNoise();
        
        startAudioRecording().then(() => {
          startSTT();
        });
        
        runCountdown(respTime, () => {
          // 종료 단계
          playBeep(600, 0.8);
          
          // 웅성거림 중지
          stopAmbientNoise();
          
          stopAudioRecording();
          const sttResult = stopSTT();
          state.fullTranscriptText = sttResult;
          
          state.gameState = 'idle';
          updateSkipButtonUI();
          ui.timerStateLabel.className = 'state-idle';
          ui.timerStateLabel.textContent = '연습 완료';
          ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
          ui.btnStartTest.className = 'btn btn-primary';
          ui.btnAnalyze.disabled = false;
          safeCreateIcons();
        });
      });
    });
  });
}

// (B-1) Part 3 전체 응시 흐름 (질문 3개 연속)
function runPart3Flow(data) {
  // 전체 오디오 녹음을 하나로 통합하기 위해 시작할 때 마이크 스트림 활성화
  startAudioRecording().then(() => {
    // 마이크는 준비 단계일 때는 일시 정지(침묵 방지)
    pauseAudioRecording();
    runPart3QuestionStep(data);
  });
}

function runPart3QuestionStep(data) {
  const subIdx = state.subQuestionIndex;
  const qData = data.questions[subIdx];
  
  updatePart3ActiveQuestionUI();
  
  state.gameState = 'preparing';
  updateSkipButtonUI();
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
  ui.timerClock.textContent = "--";
  ui.timerProgress.style.width = "0%";
  
  // 첫 질문일 경우에만 파트 소개 안내 음성 가이드 출력
  const flowPromise = (subIdx === 0) 
    ? playVoiceGuide("In this part of the test, you will answer three questions. Begin speaking now.") 
    : Promise.resolve();

  flowPromise.then(() => {
    // 실제 토스 시험처럼 오디오 질문을 TTS로 구현
    speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
      // 3초 준비 시간 작동
      ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
      
      runCountdown(qData.prepTime, () => {
        // 답변 시간 진입 안내 가이드 방송 재생 (Begin speaking now)
        playVoiceGuide("Begin speaking now.").then(() => {
          playBeep(800, 0.4);
          
          // 답변 시작 및 녹음 재개
          state.gameState = 'speaking';
          updateSkipButtonUI();
          ui.timerStateLabel.className = 'state-resp';
          ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
          
          // 웅성거림 백색소음 시작
          startAmbientNoise();
          
          resumeAudioRecording();
          
          runCountdown(qData.respTime, () => {
            playBeep(600, 0.4);
            
            // 웅성거림 중지
            stopAmbientNoise();
            
            // 현재까지의 답변 STT 누적
            const curStt = stopSTT();
            state.fullTranscriptText += `[Question ${qData.num}: ${qData.text}]\nYour Answer: ${curStt || '(Silence)'}\n\n`;
            
            // 일시정지
            pauseAudioRecording();
            
            // 다음 질문 체크
            if (state.subQuestionIndex < 2) {
              state.subQuestionIndex++;
              runPart3QuestionStep(data);
            } else {
              // 모든 서브 질문 종료
              stopAudioRecording(); // 최종 녹음 끝
              
              state.gameState = 'idle';
              updateSkipButtonUI();
              ui.timerStateLabel.className = 'state-idle';
              ui.timerStateLabel.textContent = '연습 완료';
              ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
              ui.btnStartTest.className = 'btn btn-primary';
              ui.btnAnalyze.disabled = false;
              safeCreateIcons();
              
              ui.part3QItems.forEach(item => item.classList.remove('active'));
            }
          });
        });
      });
    });
  });
}

// (B-2) Part 3 문항별 개별 연습 흐름 (1개 질문 후 즉시 완료)
function runPart3FlowSingle(data) {
  startAudioRecording().then(() => {
    // 준비 시간 동안 녹음 일시 정지
    pauseAudioRecording();
    
    const qData = data.questions[state.subQuestionIndex];
    updatePart3ActiveQuestionUI();
    
    state.gameState = 'preparing';
    updateSkipButtonUI();
    ui.timerStateLabel.className = 'state-prep';
    ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
    ui.timerClock.textContent = "--";
    ui.timerProgress.style.width = "0%";
    
    speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
      ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
      
      runCountdown(qData.prepTime, () => {
        playVoiceGuide("Begin speaking now.").then(() => {
          playBeep(800, 0.4);
          
          state.gameState = 'speaking';
          updateSkipButtonUI();
          ui.timerStateLabel.className = 'state-resp';
          ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
          
          // 웅성거림 백색소음 시작
          startAmbientNoise();
          
          resumeAudioRecording();
          
          runCountdown(qData.respTime, () => {
            playBeep(600, 0.4);
            
            // 웅성거림 중지
            stopAmbientNoise();
            
            stopAudioRecording();
            const sttResult = stopSTT();
            state.fullTranscriptText = `[Question ${qData.num}: ${qData.text}]\nYour Answer: ${sttResult || '(Silence)'}`;
            
            state.gameState = 'idle';
            updateSkipButtonUI();
            ui.timerStateLabel.className = 'state-idle';
            ui.timerStateLabel.textContent = '연습 완료';
            ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
            ui.btnStartTest.className = 'btn btn-primary';
            ui.btnAnalyze.disabled = false;
            safeCreateIcons();
          });
        });
      });
    });
  });
}

// (C-1) Part 4 전체 응시 흐름 (표 분석 45초 -> 질문 3개 연속)
function runPart4Flow(data) {
  // 표 분석 시간 45초 카운트다운 시작
  state.gameState = 'preparing';
  updateSkipButtonUI();
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = '정보 확인 시간';
  
  // 표 활성화 (비활성화 비주얼 해제)
  document.querySelector('.part4-question-box').classList.remove('disabled-box');
  
  // 아젠다 확인 안내 방송 완료 후 45초 확인 작동
  playVoiceGuide("You will have 45 seconds to read the schedule. Begin preparing now.").then(() => {
    playBeep(800, 0.4);
    
    runCountdown(45, () => {
      playBeep(800, 0.8);
      
      // 녹음기 시작 및 바로 일시정지 (마이크 켜기)
      startAudioRecording().then(() => {
        pauseAudioRecording();
        runPart4QuestionStep(data);
      });
    });
  });
}

function runPart4QuestionStep(data) {
  const subIdx = state.subQuestionIndex;
  const qData = data.questions[subIdx];
  
  // UI에 현재 질문 바인딩
  ui.part4QLabel.textContent = `Question ${qData.num}`;
  ui.part4QText.textContent = "질문을 음성으로 듣는 중입니다...";
  
  state.gameState = 'preparing';
  updateSkipButtonUI();
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
  ui.timerClock.textContent = "--";
  ui.timerProgress.style.width = "0%";
  
  speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
    // 질문 리스트에 텍스트 띄움
    ui.part4QText.textContent = qData.text;
    ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
    
    runCountdown(qData.prepTime, () => {
      // 답변 시작 가이드 방송 재생 (Begin speaking now)
      playVoiceGuide("Begin speaking now.").then(() => {
        playBeep(800, 0.4);
        
        // 답변 시작 및 녹음 재개
        state.gameState = 'speaking';
        updateSkipButtonUI();
        ui.timerStateLabel.className = 'state-resp';
        ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
        
        // 웅성거림 백색소음 가동
        startAmbientNoise();
        
        resumeAudioRecording();
        
        runCountdown(qData.respTime, () => {
          playBeep(600, 0.4);
          
          // 웅성거림 중지
          stopAmbientNoise();
          
          // 현재까지의 답변 STT 누적
          const curStt = stopSTT();
          state.fullTranscriptText += `[Question ${qData.num}: ${qData.text}]\nYour Answer: ${curStt || '(Silence)'}\n\n`;
          
          pauseAudioRecording();
          
          if (state.subQuestionIndex < 2) {
            state.subQuestionIndex++;
            runPart4QuestionStep(data);
          } else {
            // 최종 녹음 완료
            stopAudioRecording();
            
            state.gameState = 'idle';
            updateSkipButtonUI();
            ui.timerStateLabel.className = 'state-idle';
            ui.timerStateLabel.textContent = '연습 완료';
            ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
            ui.btnStartTest.className = 'btn btn-primary';
            ui.btnAnalyze.disabled = false;
            safeCreateIcons();
          }
        });
      });
    });
  });
}

// (C-2) Part 4 문항별 개별 연습 흐름 (표 분석 없이 선택 질문 즉시 완료)
function runPart4FlowSingle(data) {
  startAudioRecording().then(() => {
    pauseAudioRecording();
    
    const qData = data.questions[state.subQuestionIndex];
    updatePart4ActiveQuestionUI();
    
    state.gameState = 'preparing';
    updateSkipButtonUI();
    ui.timerStateLabel.className = 'state-prep';
    ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
    ui.timerClock.textContent = "--";
    ui.timerProgress.style.width = "0%";
    
    speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
      ui.part4QText.textContent = qData.text;
      ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
      
      runCountdown(qData.prepTime, () => {
        playVoiceGuide("Begin speaking now.").then(() => {
          playBeep(800, 0.4);
          
          state.gameState = 'speaking';
          updateSkipButtonUI();
          ui.timerStateLabel.className = 'state-resp';
          ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
          
          // 웅성거림 백색소음 시작
          startAmbientNoise();
          
          resumeAudioRecording();
          
          runCountdown(qData.respTime, () => {
            playBeep(600, 0.4);
            
            // 웅성거림 중지
            stopAmbientNoise();
            
            stopAudioRecording();
            const sttResult = stopSTT();
            state.fullTranscriptText = `[Question ${qData.num}: ${qData.text}]\nYour Answer: ${sttResult || '(Silence)'}`;
            
            state.gameState = 'idle';
            updateSkipButtonUI();
            ui.timerStateLabel.className = 'state-idle';
            ui.timerStateLabel.textContent = '연습 완료';
          ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
          ui.btnStartTest.className = 'btn btn-primary';
          ui.btnAnalyze.disabled = false;
          safeCreateIcons();
        });
      });
    });
  });
});
}

// 질문 읽어주는 TTS 래퍼 함수 (가상 딜레이 포함)
function speakQuestion(text, callback) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => {
      setTimeout(callback, 800); // 질문 끝나고 0.8초 여유 후 시작
    };
    utterance.onerror = (e) => {
      console.warn("TTS 리딩 실패, 바로 콜백 실행:", e);
      setTimeout(callback, 2000); // 실패 시 가상 대기 2초
    };
    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("TTS speak 호출 예외 무시 및 바로 콜백 실행:", err);
      setTimeout(callback, 2000);
    }
  } else {
    // 지원하지 않는 경우 가상 대기 후 실행
    setTimeout(callback, 4000);
  }
}

// 공통 카운트다운 함수
function runCountdown(seconds, callback) {
  clearInterval(state.timerInterval);
  state.timer = seconds;
  state.totalTimerDuration = seconds;
  state.countdownCallback = callback; // 콜백 보관
  
  updateTimerUI();
  
  state.timerInterval = setInterval(() => {
    state.timer--;
    updateTimerUI();
    
    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      state.countdownCallback = null;
      callback();
    }
  }, 1000);
}

// 카운트다운 건너뛰기 헬퍼
function skipCountdown() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    if (state.countdownCallback) {
      const cb = state.countdownCallback;
      state.countdownCallback = null;
      cb();
    }
  }
}

// 타이머 UI 갱신
function updateTimerUI() {
  ui.timerClock.textContent = state.timer < 10 ? `0${state.timer}` : state.timer;
  
  if (state.totalTimerDuration > 0) {
    const progressPercent = (state.timer / state.totalTimerDuration) * 100;
    ui.timerProgress.style.width = `${progressPercent}%`;
  } else {
    ui.timerProgress.style.width = '0%';
  }
}

// 8. Gemini API 연동 및 피드백 생성
async function requestAiFeedback() {
  if (!state.apiKey) {
    alert("정상적인 서비스 이용을 위해선 API Key를 등록해야 합니다. 설정 화면에서 API Key를 입력해 주세요.");
    ui.settingsModal.classList.add('active');
    return;
  }
  

  
  const part = state.currentPart;
  const qData = state.questions[part][state.currentQuestionIndex];
  
  // 분석 프롬프트 설계
  let questionPromptContext = "";
  
  if (part === 'part1') {
    questionPromptContext = `유형: Part 1 - Read a text aloud\n제시문(Passage):\n"${qData.text}"`;
  } else if (part === 'part2') {
    questionPromptContext = `유형: Part 2 - Describe a picture\n사진 설명(참고용): ${qData.imageDescription}`;
  } else if (part === 'part3') {
    if (state.testMode === 'single') {
      const currentSubQ = qData.questions[state.subQuestionIndex];
      questionPromptContext = `유형: Part 3 - Respond to questions (문항별 개별 연습)\n시나리오 상황: ${qData.context}\n연습 문항 Q${currentSubQ.num}: "${currentSubQ.text}"`;
    } else {
      questionPromptContext = `유형: Part 3 - Respond to questions (전체 세트 응시 - 3개 문항 연달아 진행)\n시나리오 상황: ${qData.context}\n출제된 3개 질문 목록:\n- Q5: ${qData.questions[0].text}\n- Q6: ${qData.questions[1].text}\n- Q7: ${qData.questions[2].text}`;
    }
  } else if (part === 'part4') {
    const detailsText = qData.infoDetails.map(d => `- ${d.time}: ${d.event} (${d.speaker})`).join('\n');
    const baseContext = `유형: Part 4 - Respond to questions using information provided\n제시된 표 정보:\n제목: ${qData.infoTitle}\n${qData.infoDate}\n세부 일정:\n${detailsText}`;
    
    if (state.testMode === 'single') {
      const currentSubQ = qData.questions[state.subQuestionIndex];
      questionPromptContext = `${baseContext}\n\n연습 문항 Q${currentSubQ.num}: "${currentSubQ.text}"`;
    } else {
      questionPromptContext = `${baseContext}\n\n출제된 3개 질문 목록:\n- Q8: ${qData.questions[0].text}\n- Q9: ${qData.questions[1].text}\n- Q10: ${qData.questions[2].text}`;
    }
  } else if (part === 'part5') {
    questionPromptContext = `유형: Part 5 - Express an opinion\n질문:\n"${qData.questionText}"`;
  }
  
  let userSpeechText = (state.fullTranscriptText || state.liveTranscript || "").trim();
  let audioBase64 = null;
  
  // 훈련 중 녹음된 사용자 실제 목소리(audioBlob)를 Base64로 인코딩하여 구비
  if (state.audioBlob) {
    try {
      audioBase64 = await blobToBase64(state.audioBlob);
    } catch (e) {
      console.warn("오디오 데이터 인코딩 실패:", e);
    }
  }
  
  // 음성 파일도 없고, 텍스트 자막도 완전히 빈값일 최악의 상황에만 수동 텍스트 팝업으로 방어
  if (!audioBase64 && (!userSpeechText || userSpeechText === '음성을 인식하기 시작합니다...' || userSpeechText.length < 3)) {
    const manualText = window.prompt(
      "📢 [음성 파일 미감지 안내]\n" +
      "녹음된 음성 파일이 유효하지 않고 텍스트 데이터도 비어 있어 분석을 시작할 수 없습니다. " +
      "방금 연습삼아 대답하신 영어 문장을 아래에 텍스트로 직접 입력해 주세요:\n\n" +
      "영어 답변 내용을 입력해 주세요:"
    );
    if (manualText === null) {
      return; // 취소 클릭 시 분석 요청 취소
    }
    if (!manualText.trim()) {
      alert("분석할 텍스트가 없어 분석 처리가 중단되었습니다.");
      return;
    }
    userSpeechText = manualText.trim();
  }
  
  // 로딩 화면 표시 및 텍스트 갱신 (사용자가 prompt 대화상자를 입력 완료한 후 실행하여 모바일 락 예방)
  ui.loadingOverlay.querySelector('h3').textContent = "Gemini가 스피치를 정밀 분석하고 있습니다...";
  ui.loadingOverlay.querySelector('p').textContent = "목표 등급에 맞추어 발음 오류 감지, 문법 교정 및 추천 답변을 구성하고 있습니다.";
  ui.loadingOverlay.classList.remove('hidden');
  
  const targetLevel = state.targetGoal;
  
  // Gemini에 최적화된 프롬프트 작성 (오디오 멀티모달 인지 채점 적용)
  const geminiPrompt = `
당신은 대한민국 최고의 토익스피킹 채점관이자 영어 원어민 스피치 교정 및 발음 평가 전문가입니다.
사용자가 제공한 음성인식(STT) 답변 텍스트와 실제 녹음 오디오(Audio) 데이터를 종합 검토하여 정밀 분석 리포트를 제공해 주세요.

★중요: 함께 제공된 사용자의 오디오 녹음 데이터를 '반드시 직접 귀로 청취하고' 발음 점수(pronunciationScore)와 피드백을 매겨 주세요. 모바일 환경 상 음성인식 자막(userSpeechText)이 누락되었거나 부정확할 경우, 첨부된 오디오 속 실제 목소리를 직접 받아쓰기(Transcribe)하여 완벽한 문법 교정 리포트(corrections, highlightedTranscript)를 작성해 주어야 합니다.

## 훈련 세션 정보:
${questionPromptContext}

## 사용자의 답변 (텍스트 자막 - 참고용):
"${userSpeechText}"

## 사용자의 목표 등급:
"${targetLevel}" (토익스피킹 등급: IM/IH/AL/AH 중 하나)

아래의 JSON 구조에 맞게 응답해 주세요. 마크다운 등의 백틱(\`\`\`) 코드 블록 표시 없이 오직 JSON 텍스트 자체만 반환해 주세요. JSON 포맷의 key를 명확히 유지하고 값은 한글로 작성해 주세요. (추천 답변 및 영어 문장은 영어로 작성)
중요: 분석 속도 극대화를 위해 각 피드백 항목(pronunciationFeedback, structureFeedback, reason, modelAnswerTips)의 상세 설명은 구구절절 길게 적지 말고, 핵심만 요약하여 2문장 이내(최대한 콤팩트하고 짧게)로 신속히 답변해 주세요.
중요: JSON 문자열 깨짐 방지를 위해, 각 속성 값 내부에는 절대로 이중 인용부호(쌍따옴표 '"')를 그대로 직접 사용하면 안 되며, 필요시 홑따옴표(')를 쓰거나 백슬래시로 이스케이프(\")해서 처리해 주세요.

## JSON 응답 포맷 요구사항:
{
  "estimatedToeicScore": [0에서 200 사이의 10점 단위 정수 점수 (예: 130, 140, 150, 160). 4대 평가지표 총합(100점 만점)을 기준으로, 85점 이상은 160~200점, 70~84점은 130~150점, 50~69점은 110~120점, 그 이하는 100점 이하로 10점 단위 공식 환산 매핑],
  "estimatedToeicLevel": "[예상 취득 등급. IM1, IM2, IM3, IH, AL, AH 중 하나]",
  "pronunciationScore25": [발음 정확도 점수, 0에서 25 사이의 정수],
  "intonationScore25": [억양 및 강세 자연스러움 점수, 0에서 25 사이의 정수],
  "grammarScore25": [문법적 무결성 및 구조 안정성 점수, 0에서 25 사이의 정수],
  "vocabularyScore25": [사용된 어휘의 적절성 및 다양성 점수, 0에서 25 사이의 정수],
  "pronunciationScore": [종합 발음 점수, 0에서 100 사이의 정수 점수],
  "pronunciationFeedback": "[사용자의 실제 음성 녹음을 직접 듣고 평가한 발음 상태와 보완점을 핵심만 한글로 요약 작성]",
  "structureFeedback": "[답변의 구조적 일관성과 개선 방향을 핵심만 한글로 요약 작성]",
  "highlightedTranscript": "[사용자가 말한 원본 답변 텍스트(userSpeechText)에 대해 문법적, 어휘적 오류가 있거나 어색한 단어/표현 부위를 반드시 HTML <span> 태그인 <span class='highlight-error' data-tooltip='교정 가이드라인'>틀린부위</span> 로 감싸서 문맥 전체 흐름 그대로 완성한 HTML 문자열. 올바른 부분은 태그를 씌우지 않고 그대로 둡니다. data-tooltip 속성에는 간단한 교정 가이드를 한국어로 명기하세요. 예: I <span class='highlight-error' data-tooltip='went (과거시제 사용)'>go</span> to high school yesterday.]",
  "corrections": [
    {
      "original": "[틀리거나 부자연스러운 사용자 문장]",
      "corrected": "[문법적, 어휘적으로 완벽히 교정된 영어 문장]",
      "reason": "[어떤 부분이 잘못되었고 왜 고쳤는지 핵심만 1문장 한글로 설명]"
    }
  ],
  "modelAnswer": "[목표 등급인 ${targetLevel} 수준에 맞는 자연스럽고 훌륭한 모범 추천 영어 답변 전체 텍스트. 문항별 개별 연습 모드일 경우 해당 1개 문항(예: Q5만)의 답변을, 전체 세트 응시 모드일 경우 3개 문항 전체(Q5, Q6, Q7 또는 Q8, Q9, Q10)의 답변을 문항 번호와 함께 모두 작성할 것]",
  "modelAnswerTips": "[추천 답변에 사용된 핵심 구조 템플릿 and 전달 팁을 핵심만 한글로 요약 작성]"
}
`;

  try {
    const requestUrl = state.apiKey
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`
      : `${window.location.origin}/api/analyze`;
      
    const requestBody = state.apiKey
      ? {
          contents: [{
            parts: [
              { text: geminiPrompt },
              ...(audioBase64 ? [{ inlineData: { mimeType: "audio/wav", data: audioBase64 } }] : [])
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 4096
          }
        }
      : {
          contents: [{
            parts: [
              { text: geminiPrompt },
              ...(audioBase64 ? [{ inlineData: { mimeType: "audio/wav", data: audioBase64 } }] : [])
            ]
          }]
        };

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("서버가 HTML 에러 페이지를 반환했습니다. Vercel Dashboard의 'Environment Variables' 설정에서 GEMINI_API_KEY 환경변수 등록을 완료했는지 다시 점검해 주세요!");
      }
      const errData = await response.json();
      throw new Error(errData.error?.message || errData.error || "HTTP 요청 오류가 발생했습니다.");
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("서버 응답이 JSON이 아닙니다. Vercel 배포 상태 또는 API 키 등록을 점검해 주세요.");
    }
    
    const resData = await response.json();
    
    // 구글 API 또는 서버 프록시 내부 에러 상세 노출
    if (resData.error) {
      const errMsg = typeof resData.error === 'string' ? resData.error : (resData.error.message || "구글 API 처리 실패");
      throw new Error(errMsg);
    }
    
    if (!resData.candidates || resData.candidates.length === 0) {
      throw new Error("Gemini가 유효한 답변 후보(candidates)를 반환하지 못했습니다.");
    }
    
    const responseText = resData.candidates[0].content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("AI 분석 텍스트를 불러오지 못했습니다.");
    }
    
    // JSON 파싱
    const feedbackObj = JSON.parse(responseText.trim());
    
    // UI 렌더링
    renderFeedback(feedbackObj);
    
    // 대시보드 성적 로그 축적 저장
    saveScoreLog(state.currentPart, feedbackObj.estimatedToeicScore, feedbackObj.estimatedToeicLevel, feedbackObj);
  } catch (error) {
    handleGeminiError(error, "AI 분석 요청");
  } finally {
    ui.loadingOverlay.classList.add('hidden');
  }
}

// 9. 분석 결과 바인딩
function renderFeedback(data) {
  // 결과 패널 보이기
  ui.feedbackSection.classList.remove('hidden');
  
  // 목표 등급 세팅
  ui.feedbackTargetGoal.textContent = state.targetGoal;
  ui.modelTargetBadge.textContent = state.targetGoal;
  
  // 내 스피치 오류 정밀 하이라이트 채우기
  if (ui.highlightedTranscript) {
    ui.highlightedTranscript.innerHTML = data.highlightedTranscript || "(말씀하신 텍스트 분석에 실패했습니다.)";
  }
  
  // 200점 예상 전광판 채우기
  if (ui.estimatedToeicScore) {
    ui.estimatedToeicScore.textContent = data.estimatedToeicScore || 0;
  }
  if (ui.estimatedToeicLevel) {
    ui.estimatedToeicLevel.textContent = data.estimatedToeicLevel || "N/A";
  }

  // 4대 공인 평가지표 진행 표시줄 갱신 (25점 만점 기준 백분율 변환)
  const scorePron25 = data.pronunciationScore25 || 0;
  const scoreInto25 = data.intonationScore25 || 0;
  const scoreGram25 = data.grammarScore25 || 0;
  const scoreVoc25 = data.vocabularyScore25 || 0;

  if (ui.scorePronVal) ui.scorePronVal.textContent = `${scorePron25}/25`;
  if (ui.scorePronFill) ui.scorePronFill.style.width = `${Math.min(100, (scorePron25 / 25) * 100)}%`;

  if (ui.scoreIntoVal) ui.scoreIntoVal.textContent = `${scoreInto25}/25`;
  if (ui.scoreIntoFill) ui.scoreIntoFill.style.width = `${Math.min(100, (scoreInto25 / 25) * 100)}%`;

  if (ui.scoreGramVal) ui.scoreGramVal.textContent = `${scoreGram25}/25`;
  if (ui.scoreGramFill) ui.scoreGramFill.style.width = `${Math.min(100, (scoreGram25 / 25) * 100)}%`;

  if (ui.scoreVocVal) ui.scoreVocVal.textContent = `${scoreVoc25}/25`;
  if (ui.scoreVocFill) ui.scoreVocFill.style.width = `${Math.min(100, (scoreVoc25 / 25) * 100)}%`;

  // 발음 피드백 채우기
  ui.pronFeedbackText.textContent = data.pronunciationFeedback || "피드백이 제공되지 않았습니다.";
  
  // 구조 피드백 채우기
  ui.structFeedbackText.textContent = data.structureFeedback || "구조 피드백이 제공되지 않았습니다.";
  
  // 문장 교정 리스트 채우기
  ui.correctionTableBody.innerHTML = '';
  if (data.corrections && data.corrections.length > 0) {
    data.corrections.forEach(item => {
      const tr = document.createElement('tr');
      
      const tdOriginal = document.createElement('td');
      tdOriginal.textContent = item.original || "-";
      
      const tdCorrected = document.createElement('td');
      tdCorrected.className = 'corrected-text-cell';
      
      const correctedTextSpan = document.createElement('span');
      correctedTextSpan.textContent = item.corrected || "-";
      tdCorrected.appendChild(correctedTextSpan);
      
      if (item.corrected && item.corrected !== "-") {
        const speakBtn = document.createElement('button');
        speakBtn.className = 'btn-speak-inline';
        speakBtn.innerHTML = '<i data-lucide="volume-2"></i>';
        speakBtn.title = "원어민 발음 듣기";
        speakBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          speakText(item.corrected);
        });
        tdCorrected.appendChild(speakBtn);
      }
      
      const tdReason = document.createElement('td');
      tdReason.textContent = item.reason || "-";
      
      tr.appendChild(tdOriginal);
      tr.appendChild(tdCorrected);
      tr.appendChild(tdReason);
      ui.correctionTableBody.appendChild(tr);
    });
  } else {
    // 교정할 사항이 없거나 완벽한 경우
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'no-corrections';
    td.innerHTML = '<i data-lucide="check" style="color: var(--success-color); vertical-align: middle; margin-right: 5px;"></i> 교정할 문법 오류가 발견되지 않았습니다. 훌륭한 스피치입니다!';
    tr.appendChild(td);
    ui.correctionTableBody.appendChild(tr);
    safeCreateIcons();
  }
  
  // 모범 답변 세팅
  ui.modelAnswerText.textContent = data.modelAnswer || "모범 답변이 생성되지 않았습니다.";
  ui.modelAnswerTipsText.textContent = data.modelAnswerTips || "팁 정보가 없습니다.";
  
  // Lucide 아이콘 다시 그리기
  safeCreateIcons();
  
  // 피드백 패널로 매끄럽게 스크롤
  ui.feedbackSection.scrollIntoView({ behavior: 'smooth' });
}

// 9-B. 대시보드 데이터 저장 및 Canvas 네온 차트 드로잉 엔진
function saveScoreLog(part, score, level, rawData) {
  try {
    const logs = loadScoreLogs();
    
    // 점수가 유효한 범위일 때만 저장 (0~200)
    const validScore = parseInt(score, 10);
    if (isNaN(validScore) || validScore < 0 || validScore > 200) return;
    
    let partName = "Part";
    switch(part) {
      case 'part1': partName = "Part 1 문장 읽기"; break;
      case 'part2': partName = "Part 2 사진 묘사"; break;
      case 'part3': partName = "Part 3 질문 대답"; break;
      case 'part4': partName = "Part 4 정보 활용"; break;
      case 'part5': partName = "Part 5 의견 제시"; break;
    }
    
    const newLog = {
      id: "log-" + Date.now(),
      timestamp: new Date().toLocaleString('ko-KR', { hour12: false }).substring(2, 17), // "26. 7. 1. 15:20" 형태
      part: part,
      partName: partName,
      score: validScore,
      level: level || "N/A",
      rawData: rawData
    };
    
    logs.push(newLog);
    
    // 최대 30개 이력 유지
    if (logs.length > 30) {
      logs.shift();
    }
    
    localStorage.setItem('toeic_speaking_score_logs', JSON.stringify(logs));
    console.log("성적 로그 저장 완료:", newLog);
    
    // 대시보드 실시간 동기화
    renderDashboard();
  } catch (err) {
    console.warn("성적 로그 저장 중 오류 발생:", err);
  }
}

function loadScoreLogs() {
  const saved = localStorage.getItem('toeic_speaking_score_logs');
  return saved ? JSON.parse(saved) : [];
}

function renderDashboard() {
  const logs = loadScoreLogs();
  
  // 1. 통계 수치 계산
  const totalCount = logs.length;
  let avgScore = 0;
  let maxLevel = "N/A";
  
  if (totalCount > 0) {
    const sum = logs.reduce((acc, log) => acc + log.score, 0);
    avgScore = Math.round(sum / totalCount);
    
    // 레벨 우선순위 정렬용 맵
    const levelRank = { "AH": 6, "AL": 5, "IH": 4, "IM3": 3, "IM2": 2, "IM1": 1, "N/A": 0 };
    let bestRank = 0;
    logs.forEach(log => {
      const rank = levelRank[log.level] || 0;
      if (rank > bestRank) {
        bestRank = rank;
        maxLevel = log.level;
      }
    });
  }
  
  // 통계 UI 바인딩
  document.getElementById('stat-avg-score').textContent = `${avgScore}점`;
  document.getElementById('stat-max-level').textContent = maxLevel;
  document.getElementById('stat-total-count').textContent = `${totalCount}회`;
  
  // 2. 이력 테이블 렌더링
  const tbody = document.getElementById('history-table-body');
  tbody.innerHTML = '';
  
  if (totalCount === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="no-history-msg" style="text-align: center; color: var(--text-muted); padding: 2rem 0;">
          아직 기록된 연습 성적이 없습니다. AI 답변 분석 리포트를 획득하시면 기록이 여기에 보관됩니다!
        </td>
      </tr>
    `;
  } else {
    // 최신 순 정렬
    const sortedLogs = [...logs].reverse();
    sortedLogs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${log.timestamp}</td>
        <td><span class="history-part-badge">${log.partName}</span></td>
        <td>${log.level}</td>
        <td style="font-weight: 700; color: #fff;">${log.score} / 200</td>
        <td>
          <button class="btn-restore-history" data-logid="${log.id}">
            <i data-lucide="external-link" style="width:12px; height:12px;"></i> 복원
          </button>
        </td>
      `;
      
      // 복원 이벤트 연결
      tr.querySelector('.btn-restore-history').addEventListener('click', (e) => {
        e.stopPropagation();
        restoreSavedFeedback(log.id);
      });
      
      tbody.appendChild(tr);
    });
  }
  
  // 3. 차트 드로잉
  drawScoreTrendChart(logs);
  safeCreateIcons();
}

function drawScoreTrendChart(logs) {
  const canvas = document.getElementById('score-trend-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // 최근 최대 7회분 추출
  const trendLogs = logs.slice(-7);
  
  // 해상도 보정
  const width = canvas.parentElement.clientWidth;
  const height = canvas.parentElement.clientHeight;
  canvas.width = width;
  canvas.height = height;
  
  ctx.clearRect(0, 0, width, height);
  
  if (trendLogs.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('데이터가 충분하지 않습니다.', width / 2, height / 2);
    return;
  }
  
  // 여백 정의
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 30;
  
  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;
  
  // X, Y 매핑 규칙 (Y는 0점부터 200점)
  const getX = (index) => {
    if (trendLogs.length <= 1) return paddingLeft + graphWidth / 2;
    return paddingLeft + (index / (trendLogs.length - 1)) * graphWidth;
  };
  const getY = (score) => {
    return paddingTop + graphHeight - (score / 200) * graphHeight;
  };
  
  // 1. 가로 격자선 그리기 (50점 단위)
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  
  for (let score = 0; score <= 200; score += 50) {
    const y = getY(score);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    
    // 점수 라벨
    ctx.fillText(score, paddingLeft - 8, y);
  }
  
  // 2. 꺾은선 아래 그라데이션 채우기
  if (trendLogs.length > 0) {
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(0));
    
    for (let i = 0; i < trendLogs.length; i++) {
      ctx.lineTo(getX(i), getY(trendLogs[i].score));
    }
    
    ctx.lineTo(getX(trendLogs.length - 1), getY(0) + (200 / 200) * graphHeight); // Y 바닥
    ctx.lineTo(getX(0), getY(0) + (200 / 200) * graphHeight);
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + graphHeight);
    fillGrad.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
    fillGrad.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }
  
  // 3. 네온 선형 곡선 그리기
  ctx.beginPath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#a855f7';
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
  
  for (let i = 0; i < trendLogs.length; i++) {
    const x = getX(i);
    const y = getY(trendLogs[i].score);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0; // 그림자 초기화
  
  // 4. 데이터 포인트 원형 및 텍스트 점수 라벨
  trendLogs.forEach((log, i) => {
    const x = getX(i);
    const y = getY(log.score);
    
    // 포인트 외곽 광채 원
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#a855f7';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    // 점수 라벨 텍스트
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${log.score}점`, x, y - 9);
    
    // 하단 회차 날짜 라벨
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textBaseline = 'top';
    const cleanDate = log.timestamp.split(' ')[0] || '';
    ctx.fillText(cleanDate, x, paddingTop + graphHeight + 6);
  });
}

function restoreSavedFeedback(logId) {
  try {
    const logs = loadScoreLogs();
    const targetLog = logs.find(log => log.id === logId);
    
    if (!targetLog) {
      alert("해당 성적 로그를 찾을 수 없습니다.");
      return;
    }
    
    // 유형 전환
    state.currentPart = targetLog.part;
    
    // 사이드바 active 원복
    ui.navItems.forEach(nav => {
      if (nav.getAttribute('data-part') === targetLog.part) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });
    
    // 메인 컨텐츠 영역 노출
    document.querySelector('.question-section').classList.remove('hidden');
    document.querySelector('.control-section').style.setProperty('display', 'grid');
    document.getElementById('content-dashboard').classList.remove('active');
    
    // 피드백 렌더링 복원
    renderFeedback(targetLog.rawData);
    
    // 알림 메시지 
    console.log("저장된 성적표 복원 성공:", targetLog.timestamp);
  } catch (err) {
    alert("성적 복원 중 에러가 발생했습니다: " + err.message);
  }
}

// 문서 로드 완료 시 초기화 실행
document.addEventListener('DOMContentLoaded', init);

// 10. 즐겨찾기 상태 실시간 동기화
function updateFavoriteBtnState() {
  if (!ui.btnFavoriteToggle) return;
  const part = state.currentPart;
  const index = state.currentQuestionIndex;
  
  if (part === 'favorites' || !state.questions[part]) {
    ui.btnFavoriteToggle.style.display = 'none';
    return;
  }
  ui.btnFavoriteToggle.style.display = 'flex';
  
  const currentQ = state.questions[part][index];
  if (!currentQ) return;
  
  const favorites = getFavorites();
  const isFav = favorites.some(fav => fav.id === currentQ.id);
  
  if (isFav) {
    ui.btnFavoriteToggle.classList.add('active');
  } else {
    ui.btnFavoriteToggle.classList.remove('active');
  }
}

// 즐겨찾기 맵 가져오기
function getFavorites() {
  const saved = localStorage.getItem('toeic_favorites');
  return saved ? JSON.parse(saved) : [];
}

// 즐겨찾기 보관 토글
function toggleCurrentFavorite() {
  const part = state.currentPart;
  const index = state.currentQuestionIndex;
  const currentQ = state.questions[part][index];
  if (!currentQ) return;
  
  let favorites = getFavorites();
  const isFavIndex = favorites.findIndex(fav => fav.id === currentQ.id);
  
  if (isFavIndex > -1) {
    // 삭제
    favorites.splice(isFavIndex, 1);
    ui.btnFavoriteToggle.classList.remove('active');
    console.log("즐겨찾기 보관 해제:", currentQ.id);
  } else {
    // 추가
    favorites.push({
      id: currentQ.id,
      part: part,
      data: currentQ,
      savedAt: new Date().toLocaleDateString()
    });
    ui.btnFavoriteToggle.classList.add('active');
    console.log("즐겨찾기 보관 완료:", currentQ.id);
  }
  
  localStorage.setItem('toeic_favorites', JSON.stringify(favorites));
}

// 즐겨찾기 보관함 카드 목록 그리기
function renderFavoritesList() {
  if (!ui.favoritesList) return;
  
  const favorites = getFavorites();
  ui.favoritesList.innerHTML = '';
  
  if (favorites.length === 0) {
    ui.favoritesList.innerHTML = `
      <div class="no-favorites-message">
        <i data-lucide="star-off" style="width: 48px; height: 48px; color: var(--text-muted); opacity: 0.5; margin-bottom: 0.75rem;"></i>
        <p style="color: var(--text-muted); font-size: 0.95rem;">보관함이 비어 있습니다. 연습 중에 소장하고 싶은 문항을 별표(⭐)로 담아보세요!</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  
  favorites.forEach(fav => {
    const card = document.createElement('div');
    card.className = 'favorite-card';
    card.setAttribute('data-part', fav.part);
    
    // 카드 제목 요약
    let summaryText = "";
    if (fav.part === 'part1') summaryText = fav.data.text;
    else if (fav.part === 'part2') summaryText = fav.data.imageDescription || "Unsplash 사진 묘사 문항";
    else if (fav.part === 'part3') summaryText = fav.data.context;
    else if (fav.part === 'part4') summaryText = fav.data.infoTitle;
    else if (fav.part === 'part5') summaryText = fav.data.questionText;
    
    let partBadgeText = "";
    switch(fav.part) {
      case 'part1': partBadgeText = "Part 1 문장 읽기"; break;
      case 'part2': partBadgeText = "Part 2 사진 묘사"; break;
      case 'part3': partBadgeText = "Part 3 질문 대답"; break;
      case 'part4': partBadgeText = "Part 4 정보 활용"; break;
      case 'part5': partBadgeText = "Part 5 의견 제시"; break;
    }
    
    card.innerHTML = `
      <span class="favorite-card-badge">${partBadgeText}</span>
      <h4 class="favorite-card-title">${summaryText}</h4>
      <div class="favorite-card-date">
        <i data-lucide="calendar" style="width:12px; height:12px;"></i> 저장일: ${fav.savedAt || "-"}
      </div>
      <button class="favorite-card-remove" title="즐겨찾기 삭제">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    
    // 카드 클릭 시 해당 문항 로드 및 이동
    card.addEventListener('click', (e) => {
      if (e.target.closest('.favorite-card-remove')) return;
      loadFavoriteQuestion(fav.part, fav.id);
    });
    
    // 개별 삭제 버튼 핸들러
    card.querySelector('.favorite-card-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm("이 문항을 보관함에서 삭제하시겠습니까?")) {
        removeFavoriteItem(fav.id);
      }
    });
    
    ui.favoritesList.appendChild(card);
  });
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 보관함 개별 아이템 삭제
function removeFavoriteItem(favId) {
  let favorites = getFavorites();
  favorites = favorites.filter(fav => fav.id !== favId);
  localStorage.setItem('toeic_favorites', JSON.stringify(favorites));
  renderFavoritesList();
}

// 보관함 아이템 클릭 시 원래 유형으로 라우팅
function loadFavoriteQuestion(part, qId) {
  // 원래 파트로 전환
  state.currentPart = part;
  
  // 1. 파트 데이터셋 내에서 해당 문제의 인덱스 검색
  let idx = state.questions[part].findIndex(q => q.id === qId);
  
  // 2. 만약 없다면 (즐겨찾기된 동적 문항인데 메인 리스트에서 제거된 경우)
  if (idx === -1) {
    const favorites = getFavorites();
    const favItem = favorites.find(fav => fav.id === qId);
    
    if (favItem) {
      // 메인 리스트에서 기존의 동적 문제(dynamic-*)는 모두 걷어내고
      state.questions[part] = state.questions[part].filter(q => {
        const idStr = String(q.id || '');
        return idStr.startsWith('base-');
      });
      
      // 이 즐겨찾기 문항을 메인 리스트 맨 끝에 임시로 푸시
      state.questions[part].push(favItem.data);
      idx = state.questions[part].length - 1;
    }
  }
  
  if (idx > -1) {
    state.currentQuestionIndex = idx;
    state.subQuestionIndex = 0;
    
    // 사이드바 active 갱신
    ui.navItems.forEach(nav => {
      if (nav.getAttribute('data-part') === part) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });
    
    // UI 원복
    document.querySelector('.question-section').classList.remove('hidden');
    document.querySelector('.control-section').style.setProperty('display', 'grid');
    document.getElementById('content-favorites').classList.remove('active');
    
    renderQuestion();
    resetSimulator();
  } else {
    alert("해당 문제를 찾을 수 없습니다.");
  }
}

// 11. Gemini API 연동 신규 문제 자동 생성
async function generateAiQuestion() {
  if (!state.apiKey && window.location.protocol === 'file:') {
    alert("로컬 파일 직접 실행 환경에서는 Gemini API Key 등록이 필수적입니다. 우측 하단의 톱니바퀴 설정 버튼을 눌러 등록해 주세요.");
    ui.settingsModal.classList.add('active');
    return;
  }
  
  const part = state.currentPart;
  if (part === 'favorites') return;
  
  // 이전 AI 생성 문제들 전면 청소 (문제 누적을 전면 방지하고 단 1개의 최신 AI 문제만 유지)
  // 1. 메모리(state.questions)에서 모든 동적 문제(dynamic-*) 제거
  state.questions[part] = state.questions[part].filter(q => {
    const idStr = String(q.id || '');
    return idStr.startsWith('base-');
  });
  
  // 2. 로컬스토리지 dynamic 질문 저장소도 이 파트의 데이터는 리셋 (신규 덮어쓰기 준비)
  const savedDynamic = localStorage.getItem('toeic_dynamic_questions');
  let dynamicQuestions = savedDynamic ? JSON.parse(savedDynamic) : { part1: [], part2: [], part3: [], part4: [], part5: [] };
  
  dynamicQuestions[part] = [];
  localStorage.setItem('toeic_dynamic_questions', JSON.stringify(dynamicQuestions));
  
  // Part 2 이미지 무작위 사전 추출 (LLM 편향성 원천 차단)
  let selectedPart2ImgUrl = "";
  let selectedPart2ImgType = "";
  if (part === 'part2') {
    const part2Images = [
      // 1명 등장 (뚜렷한 원샷 비즈니스 구도)
      { url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80", type: "1명 (사무실 화이트보드 앞에서 똑바로 서서 컴퓨터 작업을 하며 미소 짓고 있는 비즈니스 여성)" },
      { url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80", type: "1명 (회의실에서 말끔한 정장을 입고 서서 한 손으로 태블릿 화면을 가리키며 무언가를 열정적으로 프레젠테이션 하고 있는 비즈니스 남성)" },
      // 2명 등장 (1:1 선명한 상호작용)
      { url: "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=800&q=80", type: "2명 (안내데스크/리셉션에서 정장의 여직원이 서류를 손가락으로 짚으며 남성 고객에게 친절하게 웃으며 대화하는 장면)" },
      { url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80", type: "2명 (밝은 카페 카운터에서 바리스타 직원이 커피 잔을 건네고 양복 입은 손님이 결제 카드를 내밀며 주문하는 장면)" },
      { url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80", type: "2명 (사무실 회의 테이블에서 남녀 동료가 펼쳐진 인쇄물을 함께 손으로 짚으며 진지하게 토론하는 비즈니스 장면)" },
      // 3명 등장 (3인 협업 구도)
      { url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80", type: "3명 (대학 도서관 원형 테이블에서 두 명의 남성이 태블릿 모니터를 응시하고 있고 여성이 서서 무언가 기록하며 열람 중인 3인 비즈니스 구도)" },
      { url: "https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?auto=format&fit=crop&w=800&q=80", type: "3명 (개방형 사무실 회의실 창가에서 세 명의 동료들이 나란히 노트북 한 대를 보며 환하게 아이디어를 교환하고 있는 장면)" },
      // 4명 등장 (4인 협업 및 비즈니스 의사소통)
      { url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80", type: "4명 (개선된 화려한 오피스에서 네 명의 남녀 팀원들이 활짝 웃으며 컴퓨터 모니터의 차트를 보며 대화하는 협업 장면)" },
      { url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80", type: "4명 (대학 세미나 스터디룸에서 네 명의 청년들이 노트북과 교재를 펼쳐놓고 마주 보며 토론하는 장면)" },
      // 다수 인물 (5인 이상 전신 웅장 구도)
      { url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80", type: "다수 (야외 시장 과일 매대에서 다수의 상인과 손님들이 야채를 고르며 전신으로 장을 보고 있는 활기찬 장면)" },
      { url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80", type: "다수 (대강의실에서 여성 강사가 제스처를 취하며 프레젠테이션 하고 있고 다수의 수강생들이 필기하며 경청하고 있는 강의 장면)" },
      { url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80", type: "다수 (넓은 물류창고에서 주황색 안전조끼를 입은 세 명의 작업자들이 지게차 앞에 모여 대화하고 있고 배경에 상자가 쌓인 생산지 장면)" }
    ];
    const randIdx = Math.floor(Math.random() * part2Images.length);
    selectedPart2ImgUrl = part2Images[randIdx].url;
    selectedPart2ImgType = part2Images[randIdx].type;
  }
  
  // 생성 진행 로더 켜기 및 텍스트 갱신 (중첩 겹침 버그 방지)
  ui.loadingOverlay.querySelector('h3').textContent = "신규 실전 문제 출제 중...";
  ui.loadingOverlay.querySelector('p').textContent = "AI가 최신 토익스피킹 시험 트렌드를 분석하여 새로운 문제를 생성하고 있습니다.";
  ui.loadingOverlay.classList.remove('hidden');
  
  let partPromptText = "";
  let jsonFormatRequirements = "";
  
  switch(part) {
    case 'part1':
      partPromptText = "유형 1: Read a text aloud (문장 읽기 지문). 토익스피킹 시험 수준에 어울리는 공식 비즈니스 안내 방송, 기업 연설, 공항 방송, 광고문, 혹은 상점 행사 공지 등의 성격을 띤 50~70단어 수준의 영어 문단 1개를 생성하세요. 안내 방송(announcement) 또는 광고(advertisement) 템플릿이 좋습니다.";
      jsonFormatRequirements = `{
        "instruction": "화면의 지문을 주어진 시간 동안 준비하고 소리 내어 읽으십시오.",
        "text": "[생성된 영문 지문 내용 전체]",
        "prepTime": 45,
        "respTime": 45
      }`;
      break;
    case 'part2':
      partPromptText = `유형 2: Describe a picture (사진 묘사). 
지정된 사진 이미지 URL: "${selectedPart2ImgUrl}" (인물 유형: ${selectedPart2ImgType})
중요: 절대 사물이나 신체 일부(손가락 등)만 묘사하는 정적인 주제로 변형하지 마십시오. 지정된 사진 내용과 인물 유형에 정확히 일치하도록, 인물의 얼굴과 상반신/전신 동작이 또렷이 부각되고 서로 비즈니스적 혹은 일상적으로 긴밀하게 상호작용하는 인물 중심의 토익스피킹 공식 묘사 스펙으로 가이드라인 한글 텍스트를 구성해야 합니다.`;
      jsonFormatRequirements = `{
        "instruction": "화면의 사진을 주어진 시간 동안 준비하고 가능한 한 자세히 묘사하십시오.",
        "imageUrl": "${selectedPart2ImgUrl}",
        "imageDescription": "[지정된 사진(${selectedPart2ImgUrl} - ${selectedPart2ImgType})의 실제 상황에 의거하여 등장인물의 인원수(1명/2명/3명/4명/다수), 각자 입은 옷, 구체적 상호작용 행동 및 포즈, 그리고 주변 배경 사물의 레이아웃을 순서대로 정밀 분석한 한국어 묘사 텍스트]",
        "prepTime": 45,
        "respTime": 45
      }`;
      break;
    case 'part3':
      partPromptText = "유형 3: Respond to questions (질문에 답하기). 비즈니스 설문조사 또는 일상 생활 설문(예: 책 읽기, 스포츠, 외식, 휴대전화 구매 등)에 대한 설문조사 인터뷰 가상의 콘텍스트 시나리오 1개와 이어지는 하위 질문 3개(Q5, Q6, Q7)를 영문으로 작성하세요. Q5는 15초 답변, Q6은 15초 답변, Q7은 30초 답변에 알맞은 질문이어야 합니다.";
      jsonFormatRequirements = `{
        "instruction": "가상의 전화 인터뷰라 가정하고 각 질문에 대해 준비 시간 후 즉시 대답하십시오.",
        "context": "[설문 시나리오 설명문 한글 또는 영문. 예: Imagine that a marketing research firm is doing a survey about reading habits in your area.]",
        "questions": [
          { "num": 5, "text": "[Q5 질문 내용. 예: How often do you read books, and where do you usually buy them?]", "prepTime": 3, "respTime": 15 },
          { "num": 6, "text": "[Q6 질문 내용. 예: Do you prefer reading paper books or e-books? Why?]", "prepTime": 3, "respTime": 15 },
          { "num": 7, "text": "[Q7 질문 내용. 예: What is the most important factor when choosing a book to read? Describe in detail.]", "prepTime": 3, "respTime": 30 }
        ]
      }`;
      break;
    case 'part4':
      partPromptText = "유형 4: Respond to questions using info (제공된 정보로 답하기). 콘퍼런스 아젠다, 워크숍 스케줄표, 여행 일정표, 또는 구직 인터뷰 타임테이블 1개를 구성하고 이에 대응하는 면접관의 3개 질문(Q8, Q9, Q10)을 영문으로 출제하세요. Q8은 표의 시작 일정이나 단순 팩트 체크(15초), Q9는 표의 수정/취소 사항 확인 또는 잘못 알고 있는 정보 정정(15초), Q10은 특정 인물이 속한 프로그램 전체 나열(30초) 규격에 정확히 들어맞아야 합니다.";
      jsonFormatRequirements = `{
        "instruction": "제공된 표를 주어진 시간 동안 분석하고, 이를 바탕으로 이어지는 질문에 답하십시오.",
        "infoTitle": "[표의 대제목. 예: Annual Business Leaders Summit]",
        "infoDate": "[날짜 및 장소 정보. 예: October 15, Grand Ballroom A]",
        "infoDetails": [
          { "time": "[시간. 예: 09:00 AM - 10:00 AM]", "event": "[세션 세부명. 예: Keynote Address: Global Economic Outlook]", "speaker": "[연사명. 예: Dr. Helen Carter]" },
          { "time": "[시간. 예: 10:15 AM - 11:30 AM]", "event": "[세션 세부명. 예: Panel Discussion: Sustainable Energy Policies]", "speaker": "[연사명. 예: Moderated by John Vance]" },
          { "time": "[시간. 예: 11:30 AM - 01:00 PM]", "event": "[세션 세부명. 예: Networking Lunch & Exhibition]", "speaker": "" },
          { "time": "[시간. 예: 01:00 PM - 02:30 PM]", "event": "[세션 세부명. 예: Workshop A: AI in Business Strategy]", "speaker": "[연사명. 예: Led by Tech Solutions Inc.]" }
        ],
        "questions": [
          { "num": 8, "text": "[Q8 질문 내용. 예: What is the first event of the summit, and what time does it start?]", "prepTime": 3, "respTime": 15 },
          { "num": 9, "text": "[Q9 질문 내용. 예: I heard that the lunch session is scheduled for 2 hours, is that correct?]", "prepTime": 3, "respTime": 15 },
          { "num": 10, "text": "[Q10 질문 내용. 예: Could you give me all the details about the sessions scheduled in the afternoon?]", "prepTime": 3, "respTime": 30 }
        ]
      }`;
      break;
    case 'part5':
      partPromptText = "유형 5: Express an opinion (의견 제시하기). 특정 토론 주제(예: 온라인 교육의 효과, 사내 재택근무 활성화, 기술 도입의 필요성 등)에 대한 찬반 의견 또는 선호도 조사를 묻는 정교한 60초 답변 분량의 영어 에세이 질문 1개를 작성하세요.";
      jsonFormatRequirements = `{
        "instruction": "특정 주제에 대해 본인의 의견을 논리적으로 말하십시오.",
        "questionText": "[영문 질문 텍스트. 예: Do you agree or disagree with the following statement? \\"Students learn more effectively through online classes than traditional in-person classes.\\" Give specific reasons and examples to support your opinion.]",
        "prepTime": 45,
        "respTime": 60
      }`;
      break;
  }
  
  const prompt = `
당신은 대한민국 최고의 토익스피킹 시험 출제위원이자 원어민 평가 위원입니다.
아래의 출제 규칙에 정확히 부합하는 새로운 토익스피킹 연습 문항을 1개 신규 출제해 주세요.

## 출제 유형 요구사항:
${partPromptText}

아래의 JSON 구조 요구사항에 완벽히 호환되게 오직 JSON 코드 블록이나 마크다운 백틱(\`\`\`) 표시 없이 순수 JSON 텍스트 자체만 반환해 주세요. 포맷 구조의 모든 키명과 영문법을 완벽히 지켜 주어야 합니다.

## JSON 출력 포맷:
${jsonFormatRequirements}
`;

  try {
    const requestUrl = state.apiKey
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`
      : `${window.location.origin}/api/analyze`;
      
    const requestBody = state.apiKey
      ? {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }
      : {
          contents: [{
            parts: [{ text: prompt }]
          }]
        };

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("서버가 HTML 에러 페이지를 반환했습니다. Vercel Dashboard의 'Environment Variables' 설정에서 GEMINI_API_KEY 환경변수 등록을 완료했는지 다시 점검해 주세요!");
      }
      const errData = await response.json();
      throw new Error(errData.error?.message || "Gemini 문제 생성 API 요청 중 HTTP 에러가 발생했습니다.");
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("서버 응답이 JSON이 아닙니다. Vercel 배포 상태 또는 API 키 등록을 점검해 주세요.");
    }
    
    const resData = await response.json();
    const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("Gemini API가 유효한 텍스트 응답을 반환하지 못했습니다.");
    }
    
    // JSON 마크다운 백틱(```json) 자동 제거 방어 코드
    let cleanText = responseText.trim();
    if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    
    const newQData = JSON.parse(cleanText);
    
    // 고유 ID 추가
    const timestamp = Date.now();
    newQData.id = `dynamic-${part}-${timestamp}`;
    
    // 로컬 스토리지 dynamic 리스트에 추가 (이미 필터링된 dynamicQuestions 객체 사용)
    if (!dynamicQuestions[part]) dynamicQuestions[part] = [];
    dynamicQuestions[part].push(newQData);
    localStorage.setItem('toeic_dynamic_questions', JSON.stringify(dynamicQuestions));
    
    // 현재 state에도 반영
    state.questions[part].push(newQData);
    
    // 생성된 문제로 스위칭
    state.currentQuestionIndex = state.questions[part].length - 1;
    state.subQuestionIndex = 0;
    
    renderQuestion();
    resetSimulator();
    
    alert("AI가 최신 출제 트렌드에 적합한 새로운 문제를 성공적으로 출제했습니다!");
  } catch (err) {
    handleGeminiError(err, "AI 문제 출제");
  } finally {
    ui.loadingOverlay.classList.add('hidden');
  }
}

// Gemini API 에러 메시지 가독성 개선 및 쿼터 안내 필터
function handleGeminiError(error, contextText) {
  console.error(`${contextText} 중 에러:`, error);
  const msg = error.message || '';
  if (msg.includes('Quota exceeded') || msg.includes('quota') || msg.includes('429') || msg.includes('rate-limit')) {
    alert(`[Google Gemini API 할당량(Quota) 제한 초과]
현재 사용 중인 무료 API 키의 호출 한도(1분당 최대 15회)를 초과했습니다.

Google API 무료 플랜 정책에 따른 일시적 제한이므로, 약 1분 정도 대기하신 후 다시 시도해 주세요.`);
  } else {
    alert(`${contextText} 중 에러가 발생했습니다: ${msg}\nAPI 키 상태 및 인터넷 연결을 다시 점검해 주세요.`);
  }
}
