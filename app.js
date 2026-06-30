// app.js - 토익스피킹 AI 발음 및 답변 연습 웹 애플리케이션 코어 로직

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
  apiKey: ''
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
  btnPlayAudio: document.getElementById('btn-play-audio'),
  btnAnalyze: document.getElementById('btn-analyze'),
  
  // 피드백 패널
  feedbackSection: document.getElementById('feedback-section'),
  feedbackTargetGoal: document.getElementById('feedback-target-goal'),
  highlightedTranscript: document.getElementById('highlighted-transcript'),
  pronScoreFill: document.getElementById('pron-score-fill'),
  pronScoreVal: document.getElementById('pron-score-val'),
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
  favoritesList: document.getElementById('favorites-list')
};

// 1. 애플리케이션 초기화
function init() {
  // questions.js 로드 검증 자가 진단
  if (!window.toeicSpeakingQuestions) {
    alert("[시스템 알림] questions.js(기본 문제 데이터)가 정상적으로 로드되지 않았습니다!\n깃허브 저장소에 'questions.js' 파일이 소문자로 정확히 업로드되어 있는지 확인해 주세요.");
  }

  // Lucide 아이콘 초기화
  safeCreateIcons();
  
  // 로컬 스토리지에서 설정 및 API Key 로드
  state.apiKey = localStorage.getItem('gemini_api_key') || '';
  state.targetGoal = localStorage.getItem('toeic_target_goal') || 'IH';
  state.testMode = localStorage.getItem('toeic_test_mode') || 'single';
  
  // UI에 상태 반영
  ui.geminiApiKeyInput.value = state.apiKey;
  ui.goalSelect.value = state.targetGoal;
  
  ui.modeRadios.forEach(radio => {
    if (radio.value === state.testMode) {
      radio.checked = true;
    }
  });
  updateApiBadge();
  
  // 문제 데이터 병합 바인딩 (questions.js + 로컬 저장소 동적 문제)
  const baseQuestions = window.toeicSpeakingQuestions || { part1: [], part2: [], part3: [], part4: [], part5: [] };
  
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
        document.querySelector('.control-section').style.setProperty('display', 'none', 'important');
        ui.feedbackSection.classList.add('hidden');
        
        // 파트별 본문 콘텐츠 숨김 및 보관함 콘텐츠 노출
        Object.keys(ui.partContents).forEach(key => {
          ui.partContents[key].classList.remove('active');
        });
        document.getElementById('content-favorites').classList.add('active');
      } else {
        state.currentQuestionIndex = 0;
        state.subQuestionIndex = 0;
        
        // 숨겼던 문제 카드와 컨트롤 패널 복원
        document.querySelector('.question-section').classList.remove('hidden');
        document.querySelector('.control-section').style.setProperty('display', 'grid');
        
        // 보관함 콘텐츠 비활성화
        document.getElementById('content-favorites').classList.remove('active');
        
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
  
  ui.btnCloseModal.addEventListener('click', () => {
    ui.settingsModal.classList.remove('active');
  });
  
  ui.btnSaveSettings.addEventListener('click', () => {
    const key = ui.geminiApiKeyInput.value.trim();
    state.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
    updateApiBadge();
    ui.settingsModal.classList.remove('active');
    alert("API 설정이 저장되었습니다.");
  });
  
  // 연습 시작 / 정지 버튼
  ui.btnStartTest.addEventListener('click', () => {
    if (state.gameState === 'idle') {
      startToeicSimulation();
    } else {
      stopSimulation();
    }
  });
  
  // 녹음 오디오 재생 버튼
  ui.btnPlayAudio.addEventListener('click', () => {
    if (state.audioUrl) {
      const audio = new Audio(state.audioUrl);
      audio.play();
      ui.btnPlayAudio.disabled = true;
      ui.btnPlayAudio.querySelector('span').textContent = '재생 중...';
      audio.onended = () => {
        ui.btnPlayAudio.disabled = false;
        ui.btnPlayAudio.querySelector('span').textContent = '답변 듣기';
      };
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
    
    // 브라우저 내장 TTS 활용
    if ('speechSynthesis' in window) {
      // 이미 재생 중이면 취소
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        ui.btnReadModel.innerHTML = '<i data-lucide="volume-2"></i> 음성 듣기 (TTS)';
        lucide.createIcons();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US'; // 영어 지문이므로 영어로 말함
      utterance.rate = 0.9; // 살짝 천천히
      
      utterance.onstart = () => {
        ui.btnReadModel.innerHTML = '<i data-lucide="square"></i> 정지';
        lucide.createIcons();
      };
      
      utterance.onend = () => {
        ui.btnReadModel.innerHTML = '<i data-lucide="volume-2"></i> 음성 듣기 (TTS)';
        lucide.createIcons();
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      alert("이 브라우저에서는 음성 합성(TTS)을 지원하지 않습니다.");
    }
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
  }
}

// 3. 문제 렌더링 시스템
function renderQuestion() {
  const part = state.currentPart;
  const index = state.currentQuestionIndex;
  const partDataList = state.questions[part];
  
  if (!partDataList || partDataList.length === 0) return;
  
  const data = partDataList[index];
  
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
    ui.passageText.textContent = data.text;
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
      
      // 상시 마이크 스트림이 연결되지 않았을 때만 마이크 채널 종료
      if (!state.micStream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    
    state.mediaRecorder.start();
    ui.micStatusContainer.classList.add('recording');
    ui.micStatusText.textContent = "답변 녹음 및 인식 중...";
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
  safeCreateIcons();
  
  const part = state.currentPart;
  const data = state.questions[part][state.currentQuestionIndex];
  
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
  // 1단계: 준비 시간
  state.gameState = 'preparing';
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = '준비 시간';
  
  runCountdown(prepTime, () => {
    // 비프음 재생 후 답변 단계로 진입
    playBeep(800, 0.8);
    
    // 2단계: 답변 시간 및 녹음 시작
    state.gameState = 'speaking';
    ui.timerStateLabel.className = 'state-resp';
    ui.timerStateLabel.textContent = '답변 시간';
    
    startAudioRecording().then(() => {
      startSTT();
    });
    
    runCountdown(respTime, () => {
      // 종료 단계
      playBeep(600, 0.8);
      stopAudioRecording();
      const sttResult = stopSTT();
      state.fullTranscriptText = sttResult;
      
      state.gameState = 'idle';
      ui.timerStateLabel.className = 'state-idle';
      ui.timerStateLabel.textContent = '연습 완료';
      ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
      ui.btnStartTest.className = 'btn btn-primary';
      ui.btnAnalyze.disabled = false;
      lucide.createIcons();
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
  
  // TTS로 컴퓨터가 질문 읽어주는 가상 시각 대기 2초 부여
  state.gameState = 'preparing';
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
  ui.timerClock.textContent = "--";
  ui.timerProgress.style.width = "0%";
  
  // 실제 토스 시험처럼 오디오 질문을 TTS로 구현
  speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
    // 3초 준비 시간 작동
    ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
    
    runCountdown(qData.prepTime, () => {
      playBeep(800, 0.4);
      
      // 답변 시작 및 녹음 재개
      state.gameState = 'speaking';
      ui.timerStateLabel.className = 'state-resp';
      ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
      
      resumeAudioRecording();
      
      runCountdown(qData.respTime, () => {
        playBeep(600, 0.4);
        
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
          ui.timerStateLabel.className = 'state-idle';
          ui.timerStateLabel.textContent = '연습 완료';
          ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
          ui.btnStartTest.className = 'btn btn-primary';
          ui.btnAnalyze.disabled = false;
          lucide.createIcons();
          
          ui.part3QItems.forEach(item => item.classList.remove('active'));
        }
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
    ui.timerStateLabel.className = 'state-prep';
    ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
    ui.timerClock.textContent = "--";
    ui.timerProgress.style.width = "0%";
    
    speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
      ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
      
      runCountdown(qData.prepTime, () => {
        playBeep(800, 0.4);
        
        state.gameState = 'speaking';
        ui.timerStateLabel.className = 'state-resp';
        ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
        
        resumeAudioRecording();
        
        runCountdown(qData.respTime, () => {
          playBeep(600, 0.4);
          
          stopAudioRecording();
          const sttResult = stopSTT();
          state.fullTranscriptText = `[Question ${qData.num}: ${qData.text}]\nYour Answer: ${sttResult || '(Silence)'}`;
          
          state.gameState = 'idle';
          ui.timerStateLabel.className = 'state-idle';
          ui.timerStateLabel.textContent = '연습 완료';
          ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
          ui.btnStartTest.className = 'btn btn-primary';
          ui.btnAnalyze.disabled = false;
          lucide.createIcons();
        });
      });
    });
  });
}

// (C-1) Part 4 전체 응시 흐름 (표 분석 45초 -> 질문 3개 연속)
function runPart4Flow(data) {
  // 표 분석 시간 45초 카운트다운 시작
  state.gameState = 'preparing';
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = '정보 확인 시간';
  
  // 표 활성화 (비활성화 비주얼 해제)
  document.querySelector('.part4-question-box').classList.remove('disabled-box');
  
  runCountdown(45, () => {
    playBeep(800, 0.8);
    
    // 녹음기 시작 및 바로 일시정지 (마이크 켜기)
    startAudioRecording().then(() => {
      pauseAudioRecording();
      runPart4QuestionStep(data);
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
  ui.timerStateLabel.className = 'state-prep';
  ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
  ui.timerClock.textContent = "--";
  ui.timerProgress.style.width = "0%";
  
  speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
    // 질문 리스트에 텍스트 띄움
    ui.part4QText.textContent = qData.text;
    ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
    
    runCountdown(qData.prepTime, () => {
      playBeep(800, 0.4);
      
      // 답변 시작 및 녹음 재개
      state.gameState = 'speaking';
      ui.timerStateLabel.className = 'state-resp';
      ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
      
      resumeAudioRecording();
      
      runCountdown(qData.respTime, () => {
        playBeep(600, 0.4);
        
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
          ui.timerStateLabel.className = 'state-idle';
          ui.timerStateLabel.textContent = '연습 완료';
          ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
          ui.btnStartTest.className = 'btn btn-primary';
          ui.btnAnalyze.disabled = false;
          lucide.createIcons();
        }
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
    ui.timerStateLabel.className = 'state-prep';
    ui.timerStateLabel.textContent = `Q${qData.num} 질문 리딩 중...`;
    ui.timerClock.textContent = "--";
    ui.timerProgress.style.width = "0%";
    
    speakQuestion(`Question number ${qData.num}. ${qData.text}`, () => {
      ui.part4QText.textContent = qData.text;
      ui.timerStateLabel.textContent = `Q${qData.num} 준비 시간`;
      
      runCountdown(qData.prepTime, () => {
        playBeep(800, 0.4);
        
        state.gameState = 'speaking';
        ui.timerStateLabel.className = 'state-resp';
        ui.timerStateLabel.textContent = `Q${qData.num} 답변 시간`;
        
        resumeAudioRecording();
        
        runCountdown(qData.respTime, () => {
          playBeep(600, 0.4);
          
          stopAudioRecording();
          const sttResult = stopSTT();
          state.fullTranscriptText = `[Question ${qData.num}: ${qData.text}]\nYour Answer: ${sttResult || '(Silence)'}`;
          
          state.gameState = 'idle';
          ui.timerStateLabel.className = 'state-idle';
          ui.timerStateLabel.textContent = '연습 완료';
          ui.btnStartTest.innerHTML = '<i data-lucide="play"></i><span>다시 연습</span>';
          ui.btnStartTest.className = 'btn btn-primary';
          ui.btnAnalyze.disabled = false;
          lucide.createIcons();
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
  
  updateTimerUI();
  
  state.timerInterval = setInterval(() => {
    state.timer--;
    updateTimerUI();
    
    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      callback();
    }
  }, 1000);
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
  if (!state.apiKey && window.location.protocol === 'file:') {
    alert("로컬 파일 직접 실행 환경에서는 Gemini API Key 등록이 필수적입니다. 우측 하단의 톱니바퀴 설정 버튼을 눌러 등록해 주세요.");
    ui.settingsModal.classList.add('active');
    return;
  }
  
  // 로딩 화면 표시 및 텍스트 갱신 (중첩 겹침 버그 방지)
  ui.loadingOverlay.querySelector('h3').textContent = "Gemini가 스피치를 정밀 분석하고 있습니다...";
  ui.loadingOverlay.querySelector('p').textContent = "목표 등급에 맞추어 발음 오류 감지, 문법 교정 및 추천 답변을 구성하고 있습니다.";
  ui.loadingOverlay.classList.remove('hidden');
  
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
  
  const userSpeechText = state.fullTranscriptText || "(사용자의 답변이 녹음되지 않았거나 조용했습니다)";
  const targetLevel = state.targetGoal;
  
  // Gemini에 최적화된 프롬프트 작성
  const prompt = `
당신은 대한민국 최고의 토익스피킹 채점관이자 영어 원어민 스피치 교정 전문가입니다.
사용자가 제공한 음성인식(STT) 답변 텍스트를 보고 정밀 분석 리포트를 제공해 주세요.

## 훈련 세션 정보:
${questionPromptContext}

## 사용자의 답변 (음성 인식 결과):
"${userSpeechText}"

## 사용자의 목표 등급:
"${targetLevel}" (토익스피킹 등급: IM/IH/AL/AH 중 하나)

아래의 JSON 구조에 맞게 응답해 주세요. 마크다운 등의 백틱(\`\`\`) 코드 블록 표시 없이 오직 JSON 텍스트 자체만 반환해 주세요. JSON 포맷의 key를 명확히 유지하고 값은 한글로 작성해 주세요. (추천 답변 및 영어 문장은 영어로 작성)

## JSON 응답 포맷 요구사항:
{
  "pronunciationScore": [0에서 100 사이의 정수 점수],
  "pronunciationFeedback": "[사용자의 발음 상태, 연음 처리 팁, 발음 교정이 필요한 구체적인 단어 목록을 한국어로 작성]",
  "structureFeedback": "[답변의 구조적 일관성(예: 서론-본론-결론 구성 등)과 논리 전개 방식을 분석하고 개선 방향을 한국어로 조언]",
  "highlightedTranscript": "[사용자가 말한 원본 답변 텍스트(userSpeechText)에 대해 문법적, 어휘적 오류가 있거나 어색한 단어/표현 부위를 반드시 HTML <span> 태그인 <span class='highlight-error' data-tooltip='올바른 교정 단어/구절 및 한국어 설명'>틀린부위</span> 로 감싸서 문맥 전체 흐름 그대로 완성한 HTML 문자열. 올바른 부분은 태그를 씌우지 않고 그대로 둡니다. data-tooltip 속성에는 친절하게 교정 가이드라인을 한국어로 명기해 주어야 합니다. 예: I <span class='highlight-error' data-tooltip='went (어제 일이므로 과거시제 사용)'>go</span> to high school yesterday.]",
  "corrections": [
    {
      "original": "[틀리거나 부자연스러운 사용자 문장]",
      "corrected": "[문법적, 어휘적으로 완벽히 교정된 영어 문장]",
      "reason": "[어떤 부분(시제, 수일치, 관사 등)이 잘못되었고 왜 고쳤는지 친절한 한국어 설명]"
    }
  ],
  "modelAnswer": "[목표 등급인 ${targetLevel} 수준에 맞는 자연스럽고 훌륭한 모범 추천 영어 답변 전체 텍스트. 문항별 개별 연습 모드일 경우 해당 1개 문항(예: Q5만)의 답변을, 전체 세트 응시 모드일 경우 3개 문항 전체(Q5, Q6, Q7 또는 Q8, Q9, Q10)의 답변을 문항 번호와 함께 모두 작성할 것]",
  "modelAnswerTips": "[추천 답변을 말할 때 고득점을 위해 유념해야 할 전달 방식, 강조해야 할 어휘, 답변에 사용된 핵심 구조 템플릿 한국어 설명]"
}
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
      const errData = await response.json();
      throw new Error(errData.error?.message || errData.error || "HTTP 요청 오류가 발생했습니다.");
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
  
  // 발음 피드백 채우기
  ui.pronScoreVal.textContent = `${data.pronunciationScore || 0}/100`;
  ui.pronScoreFill.style.width = `${data.pronunciationScore || 0}%`;
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
      tdCorrected.textContent = item.corrected || "-";
      
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
  
  // 피드백 패널로 매끄럽게 스크롤
  ui.feedbackSection.scrollIntoView({ behavior: 'smooth' });
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
      // 1명 등장
      { url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80", type: "1명 (사무실에서 컴퓨터 작업을 하며 미소 짓고 있는 비즈니스 여성)" },
      { url: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80", type: "1명 (사무실 개인 책상에 턱을 괴고 앉아 진지하게 노트북 모니터를 보며 일하는 남성)" },
      // 2명 등장 (1:1 상호작용)
      { url: "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=800&q=80", type: "2명 (안내데스크/리셉션에서 여직원이 서류를 짚으며 남성 고객에게 친절하게 설명하는 장면)" },
      { url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80", type: "2명 (카페 카운터에서 바리스타가 커피 잔을 건네고 손님이 주문하는 대면 장면)" },
      { url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80", type: "2명 (회의 테이블에서 두 명의 남녀 대학생/동료가 인쇄물을 보며 토론하는 장면)" },
      // 3명 등장 (3인 상호작용)
      { url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80", type: "3명 (카페 원형 테이블에서 두 명의 남성이 태블릿 화면을 보며 의논하고 있고 여성이 서서 무언가 기록하는 3인 구도)" },
      { url: "https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?auto=format&fit=crop&w=800&q=80", type: "3명 (사무실 창가 테이블에서 세 명의 동료들이 노트북 한 대를 보며 아이디어를 의논하는 3인 구도)" },
      // 4명 등장 (4인 협업)
      { url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80", type: "4명 (개방형 사무실에서 네 명의 팀원들이 한 컴퓨터 모니터를 모여서 보며 웃고 대화하는 구도)" },
      { url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80", type: "4명 (대학 스터디룸에서 네 명의 학생들이 노트북과 책을 펴고 토론하는 구도)" },
      // 다수 인물 (5인 이상)
      { url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80", type: "다수 (야외 시장 과일 가게에서 다수의 손님들이 야채를 고르고 상인과 흥정하는 장면)" },
      { url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80", type: "다수 (강의실/세미나룸에서 여성 강사의 발표를 집중하며 메모하고 있는 다수의 학생들)" },
      { url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80", type: "다수 (바쁜 물류창고에서 세 명의 작업자들이 지게차 앞에 서 있고 배경에 상자가 쌓여 있는 다수 인물 장면)" }
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
        "text": "[생성된 영문 지문 내용 전체]"
      }`;
      break;
    case 'part2':
      partPromptText = `유형 2: Describe a picture (사진 묘사). 
지정된 사진 이미지: "${selectedPart2ImgUrl}" (인물 유형: ${selectedPart2ImgType})
이 사진은 실제로 인물이 등장하는 토익스피킹 연습 문항입니다.
지정된 이 사진 구도에 완벽하게 일치하는 원어민 수준의 영어 사진 묘사 한국어 가이드라인 텍스트를 작성하세요.
반드시 인물의 수(1명, 2명, 3명, 4명 또는 다수의 사람들 중 해당하는 실제 수), 성별, 옷차림, 각자의 주요 동작 및 손짓, 그리고 사물 및 뒷배경의 물리적 배치를 채점표 기준에 입각해 상세히 기술해야 합니다.`;
      jsonFormatRequirements = `{
        "instruction": "화면의 사진을 주어진 시간 동안 준비하고 가능한 한 자세히 묘사하십시오.",
        "imageUrl": "${selectedPart2ImgUrl}",
        "imageDescription": "[지정된 사진(${selectedPart2ImgUrl} - ${selectedPart2ImgType})의 실제 상황에 의거하여 등장인물의 인원수(1명/2명/3명/4명/다수), 각자 입은 옷, 구체적 상호작용 행동 및 포즈, 그리고 주변 배경 사물의 레이아웃을 순서대로 정밀 분석한 한국어 묘사 텍스트]"
      }`;
      break;
    case 'part3':
      partPromptText = "유형 3: Respond to questions (질문에 답하기). 비즈니스 설문조사 또는 일상 생활 설문(예: 책 읽기, 스포츠, 외식, 휴대전화 구매 등)에 대한 설문조사 인터뷰 가상의 콘텍스트 시나리오 1개와 이어지는 하위 질문 3개(Q5, Q6, Q7)를 영문으로 작성하세요. Q5는 15초 답변, Q6은 15초 답변, Q7은 30초 답변에 알맞은 질문이어야 합니다.";
      jsonFormatRequirements = `{
        "instruction": "가상의 전화 인터뷰라 가정하고 각 질문에 대해 준비 시간 후 즉시 대답하십시오.",
        "context": "[설문 시나리오 설명문 한글 또는 영문. 예: Imagine that a marketing research firm is doing a survey about reading habits in your area.]",
        "questions": [
          { "num": 5, "text": "[Q5 질문 내용. 예: How often do you read books, and where do you usually buy them?]" },
          { "num": 6, "text": "[Q6 질문 내용. 예: Do you prefer reading paper books or e-books? Why?]" },
          { "num": 7, "text": "[Q7 질문 내용. 예: What is the most important factor when choosing a book to read? Describe in detail.]" }
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
          { "num": 8, "text": "[Q8 질문 내용. 예: What is the first event of the summit, and what time does it start?]" },
          { "num": 9, "text": "[Q9 질문 내용. 예: I heard that the lunch session is scheduled for 2 hours, is that correct?]" },
          { "num": 10, "text": "[Q10 질문 내용. 예: Could you give me all the details about the sessions scheduled in the afternoon?]" }
        ]
      }`;
      break;
    case 'part5':
      partPromptText = "유형 5: Express an opinion (의견 제시하기). 특정 토론 주제(예: 온라인 교육의 효과, 사내 재택근무 활성화, 기술 도입의 필요성 등)에 대한 찬반 의견 또는 선호도 조사를 묻는 정교한 60초 답변 분량의 영어 에세이 질문 1개를 작성하세요.";
      jsonFormatRequirements = `{
        "instruction": "특정 주제에 대해 본인의 의견을 논리적으로 말하십시오.",
        "questionText": "[영문 질문 텍스트. 예: Do you agree or disagree with the following statement? \\"Students learn more effectively through online classes than traditional in-person classes.\\" Give specific reasons and examples to support your opinion.]"
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
      const errData = await response.json();
      throw new Error(errData.error?.message || "Gemini 문제 생성 API 요청 중 HTTP 에러가 발생했습니다.");
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
