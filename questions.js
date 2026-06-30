// 토익스피킹 실제 기출 복원 문항 데이터베이스
const baseQuestions = {
  part1: [
    {
      id: "base-1-1",
      title: "Question 1: Read a text aloud",
      instruction: "In this part of the test, you will read aloud the text on your screen. You will have 45 seconds to prepare. Then you will have 45 seconds to read the text aloud.",
      text: "Welcome to Grand Department Store! We are excited to announce our annual Summer Sale, starting this Friday. Enjoy incredible discounts of up to fifty percent off on all fashion apparel, electronics, and home goods. Our special members-only preview event begins Thursday evening at six PM. Don't miss this fantastic opportunity to save big on your favorite brands!",
      prepTime: 45,
      respTime: 45
    },
    {
      id: "base-1-2",
      title: "Question 2: Read a text aloud",
      instruction: "In this part of the test, you will read aloud the text on your screen. You will have 45 seconds to prepare. Then you will have 45 seconds to read the text aloud.",
      text: "Attention all passengers for Flight two-four-seven to Chicago. Due to severe weather conditions near the destination airport, this flight has been delayed. The new departure time is now scheduled for three PM. Passengers are requested to proceed to Gate fifteen for further updates. We apologize for the inconvenience and thank you for your patience.",
      prepTime: 45,
      respTime: 45
    },
    {
      id: "base-1-3",
      title: "Question 3: Read a text aloud",
      instruction: "In this part of the test, you will read aloud the text on your screen. You will have 45 seconds to prepare. Then you will have 45 seconds to read the text aloud.",
      text: "Looking for a perfect place for family dining? Visit Bella Italia, located on Main Street. We offer authentic Italian dishes made with fresh, local ingredients. Try our famous wood-fired pizzas and homemade pastas. We are open daily from eleven AM to ten PM. Call us today to make a reservation or order online for fast home delivery.",
      prepTime: 45,
      respTime: 45
    },
    {
      id: "base-1-4",
      title: "Question 4: Read a text aloud",
      instruction: "In this part of the test, you will read aloud the text on your screen. You will have 45 seconds to prepare. Then you will have 45 seconds to read the text aloud.",
      text: "Thank you for volunteering for the Green Life Campaign. Today, we will clean up the central park and plant new trees. Please ensure you wear protective gloves and comfortable shoes. Tools and trash bags are provided at the registration tent. After finishing, please join us for a group photo and refreshments at the pavilion.",
      prepTime: 45,
      respTime: 45
    }
  ],
  part2: [
    {
      id: "base-2-1",
      title: "Question 3: Describe a picture",
      instruction: "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare. Then you will have 30 seconds to talk about the picture.",
      imageUrl: "https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?q=80&w=800&auto=format&fit=crop",
      imageDescription: "개방형 사무실 창가 테이블에서 세 명의 남녀 동료들이 마주보고 앉아 한 대의 노트북 모니터를 가리키며 밝게 미소지은 채 비즈니스 아이디어를 의논하고 있는 3인 구도 협업 장면입니다.",
      prepTime: 45,
      respTime: 30
    },
    {
      id: "base-2-2",
      title: "Question 4: Describe a picture",
      instruction: "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare. Then you will have 30 seconds to talk about the picture.",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop",
      imageDescription: "활기찬 야외 과일/채소 시장 매대에서 여러 손님들이 신선한 식자재를 구경하고 있으며, 상인이 손님에게 친절하게 응대하며 야채를 봉지에 담아 거래하고 있는 전신 묘사 장면입니다.",
      prepTime: 45,
      respTime: 30
    },
    {
      id: "base-2-3",
      title: "Question 5: Describe a picture",
      instruction: "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare. Then you will have 30 seconds to talk about the picture.",
      imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop",
      imageDescription: "밝고 세련된 카페 카운터에서 앞치마를 두른 바리스타가 주문 완료된 머그잔 음료를 건네주고 있으며, 양복 차림의 남성 손님이 카드를 내밀어 결제와 대면 주문을 동시에 진행하는 상호작용 장면입니다.",
      prepTime: 45,
      respTime: 30
    },
    {
      id: "base-2-4",
      title: "Question 6: Describe a picture",
      instruction: "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare. Then you will have 30 seconds to talk about the picture.",
      imageUrl: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=800&auto=format&fit=crop",
      imageDescription: "넓은 강의실/세미나실 강단에서 안경을 쓴 여성이 적극적인 손짓을 취하며 발표 자료를 프레젠테이션 하고 있고, 테이블에 나란히 앉은 다수의 수강생들이 필기 도구를 쥐고 경청하는 웅장한 대강의 장면입니다.",
      prepTime: 45,
      respTime: 30
    }
  ],
  part3: [
    {
      id: "base-3-1",
      title: "Questions 5-7: Respond to questions",
      instruction: "In this part of the test, you will answer three questions. You will have 3 seconds to prepare after each question. Then you will have 15 seconds to respond to Question 5 and 6, and 30 seconds to respond to Question 7.",
      context: "Imagine that a market research firm is conducting a telephone survey about sports and exercise habits in your area. You have agreed to participate in the interview.",
      questions: [
        {
          num: 5,
          text: "How often do you play sports or exercise, and where do you usually do it?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 6,
          text: "Do you prefer exercising alone or with a group of people? Why?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 7,
          text: "Which of the following is the most important factor when choosing a local gym? (Price / Location / Quality of equipment) Explain why.",
          prepTime: 3,
          respTime: 30
        }
      ]
    },
    {
      id: "base-3-2",
      title: "Questions 5-7: Respond to questions",
      instruction: "In this part of the test, you will answer three questions. You will have 3 seconds to prepare after each question. Then you will have 15 seconds to respond to Question 5 and 6, and 30 seconds to respond to Question 7.",
      context: "Imagine that a magazine editor is doing a survey about how people use social media. You have agreed to participate in the telephone interview.",
      questions: [
        {
          num: 5,
          text: "How many times a day do you check social media, and what device do you usually use for it?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 6,
          text: "Do you share your personal photos or daily life stories on social media? Why or why not?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 7,
          text: "Do you think social media has a positive or negative impact on relationships with friends and family? Describe your opinion in detail.",
          prepTime: 3,
          respTime: 30
        }
      ]
    },
    {
      id: "base-3-3",
      title: "Questions 5-7: Respond to questions",
      instruction: "In this part of the test, you will answer three questions. You will have 3 seconds to prepare after each question. Then you will have 15 seconds to respond to Question 5 and 6, and 30 seconds to respond to Question 7.",
      context: "Imagine that a city planner is gathering feedback about public transportation in your city. You have agreed to participate in this survey.",
      questions: [
        {
          num: 5,
          text: "What type of public transportation do you use most often, and how long does your typical trip take?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 6,
          text: "Has the public transportation service in your city improved in the last two years? Why do you think so?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 7,
          text: "Which of the following improvements is the most urgent for public transportation? (Comfortable seating / Faster travel speed / Lower ticket fares) Explain why.",
          prepTime: 3,
          respTime: 30
        }
      ]
    }
  ],
  part4: [
    {
      id: "base-4-1",
      title: "Questions 8-10: Respond to questions using information provided",
      instruction: "In this part of the test, you will answer three questions based on the schedule on your screen. You will have 45 seconds to read the schedule. Then, you will have 3 seconds to prepare after each question. You will have 15 seconds to respond to Q8 and Q9, and 30 seconds to respond to Q10.",
      infoTitle: "Global Business Leaders Summit - Agenda",
      infoDate: "October 15, Grand ballroom, Plaza Hotel",
      infoDetails: [
        { time: "09:00 AM - 09:30 AM", event: "Registration and Welcome Coffee", speaker: "" },
        { time: "09:30 AM - 10:30 AM", event: "Keynote: Leadership in the Digital Era", speaker: "Dr. Helen Carter (Tech Innovators)" },
        { time: "10:45 AM - 12:00 PM", event: "Panel Discussion: Sustainable Policies", speaker: "Moderated by John Vance" },
        { time: "12:00 PM - 01:30 PM", event: "Networking Lunch at hotel restaurant", speaker: "Included for all participants" },
        { time: "01:30 PM - 03:00 PM", event: "Workshop: Building High-Performance Teams", speaker: "Dr. Helen Carter (Tech Innovators)" }
      ],
      questions: [
        {
          num: 8,
          text: "What time does the summit officially begin, and where does the registration take place?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 9,
          text: "I heard that the participants need to buy their own lunch during the break. Is that correct?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 10,
          text: "I am really interested in Dr. Helen Carter's sessions. Could you tell me all the details about the sessions she will lead?",
          prepTime: 3,
          respTime: 30
        }
      ]
    },
    {
      id: "base-4-2",
      title: "Questions 8-10: Respond to questions using information provided",
      instruction: "In this part of the test, you will answer three questions based on the schedule on your screen. You will have 45 seconds to read the schedule. Then, you will have 3 seconds to prepare after each question. You will have 15 seconds to respond to Q8 and Q9, and 30 seconds to respond to Q10.",
      infoTitle: "Sales Manager Position - Candidate Interviews",
      infoDate: "May 20, Meeting Room B, Head Office",
      infoDetails: [
        { time: "10:00 AM - 10:45 AM", event: "First Interview: Candidate Michael Johnson", speaker: "Applying for North Region Sales Manager" },
        { time: "11:00 AM - 11:45 AM", event: "Second Interview: Candidate Sarah Connor", speaker: "Applying for International Sales Representative" },
        { time: "12:00 PM - 01:00 PM", event: "Lunch Break for Interview Committee", speaker: "" },
        { time: "01:00 PM - 01:45 PM", event: "Third Interview: Candidate David Kim", speaker: "Applying for North Region Sales Manager" },
        { time: "02:00 PM - 02:45 PM", event: "Final Review & Evaluation session", speaker: "Led by HR Director" }
      ],
      questions: [
        {
          num: 8,
          text: "Who is the first applicant to be interviewed, and what time does the interview start?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 9,
          text: "I remember we have an interview scheduled during the lunch hour at twelve PM. Can you confirm this?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 10,
          text: "I want to focus on candidates applying for the North Region Sales Manager position. Could you give me all the details about those interviews?",
          prepTime: 3,
          respTime: 30
        }
      ]
    },
    {
      id: "base-4-3",
      title: "Questions 8-10: Respond to questions using information provided",
      instruction: "In this part of the test, you will answer three questions based on the schedule on your screen. You will have 45 seconds to read the schedule. Then, you will have 3 seconds to prepare after each question. You will have 15 seconds to respond to Q8 and Q9, and 30 seconds to respond to Q10.",
      infoTitle: "Employee Training Program - Workshop Schedule",
      infoDate: "July 8, Training Center Room 101",
      infoDetails: [
        { time: "09:00 AM - 10:30 AM", event: "Session 1: Customer Service Essentials", speaker: "Led by Jane Adams (HR Manager)" },
        { time: "10:45 AM - 12:15 PM", event: "Session 2: Introduction to CRM Software Tools", speaker: "Led by Kevin Stone (IT Support)" },
        { time: "12:15 PM - 01:30 PM", event: "Catered Lunch at the Cafeteria", speaker: "" },
        { time: "01:30 PM - 03:00 PM", event: "Session 3: Advanced CRM Dashboard Training", speaker: "Led by Kevin Stone (IT Support)" }
      ],
      questions: [
        {
          num: 8,
          text: "Where is the training workshop going to be held, and what is the topic of the first session?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 9,
          text: "I believe we are finishing the entire workshop session at three PM, correct?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 10,
          text: "I am interested in learning about CRM tools. Can you give me all the details about the sessions related to CRM software?",
          prepTime: 3,
          respTime: 30
        }
      ]
    }
  ],
  part5: [
    {
      id: "base-5-1",
      title: "Question 11: Express an opinion",
      instruction: "In this part of the test, you will give your opinion about a specific topic. You will have 45 seconds to prepare. Then you will have 60 seconds to speak.",
      questionText: "Do you agree or disagree with the following statement?\n\"All high school students should be required to take art or music classes.\"\nGive specific reasons and details to support your opinion.",
      prepTime: 45,
      respTime: 60
    },
    {
      id: "base-5-2",
      title: "Question 11: Express an opinion",
      instruction: "In this part of the test, you will give your opinion about a specific topic. You will have 45 seconds to prepare. Then you will have 60 seconds to speak.",
      questionText: "Some companies allow their employees to work from home, while other companies require them to work in the office. Which work style do you prefer, and why?\nGive specific reasons and details to support your opinion.",
      prepTime: 45,
      respTime: 60
    },
    {
      id: "base-5-3",
      title: "Question 11: Express an opinion",
      instruction: "In this part of the test, you will give your opinion about a specific topic. You will have 45 seconds to prepare. Then you will have 60 seconds to speak.",
      questionText: "When hiring a new employee for a team, which of the following qualifications do you think is the most important?\n- Relevant previous work experience\n- High academic credentials from a top university\n- Recommendations from former employers\nGive specific reasons and details to support your opinion.",
      prepTime: 45,
      respTime: 60
    }
  ]
};

// 브라우저에서 읽을 수 있도록 전역 객체 바인딩
if (typeof window !== 'undefined') {
  window.TOEIC_SPEAKING_QUESTIONS = baseQuestions;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = baseQuestions;
}
