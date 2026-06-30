const toeicSpeakingQuestions = {
  part1: [
    {
      id: 1,
      title: "Question 1: Read a text aloud",
      instruction: "In this part of the test, you will read aloud the text on the screen. You will have 45 seconds to prepare. Then you will have 45 seconds to read the text aloud.",
      text: "Thank you for calling the Grand Theater. We are pleased to announce our summer season of plays, concerts, and musical events. Tickets for all performances are now on sale. You can purchase them on our website, over the phone, or in person at our box office. Please note that discounts are available for students, seniors, and groups of ten or more. We look forward to seeing you at the theater soon.",
      prepTime: 45,
      respTime: 45
    },
    {
      id: 2,
      title: "Question 2: Read a text aloud",
      instruction: "In this part of the test, you will read aloud the text on the screen. You will have 45 seconds to prepare. Then you will have 45 seconds to read the text aloud.",
      text: "Attention all passengers waiting for flight 402 to Chicago. Due to severe weather conditions, our departure has been delayed by approximately two hours. We apologize for any inconvenience this may cause to your travel plans. Airline representatives at the gate are currently distributing food vouchers that can be used at any airport restaurant. Thank you for your cooperation and patience.",
      prepTime: 45,
      respTime: 45
    }
  ],
  part2: [
    {
      id: 1,
      title: "Question 3: Describe a picture",
      instruction: "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare. Then you will have 30 seconds to talk about the picture.",
      imageUrl: "https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?q=80&w=800&auto=format&fit=crop",
      imageDescription: "An open workspace where several people are collaborating around a desk with laptops.",
      prepTime: 45,
      respTime: 30
    },
    {
      id: 2,
      title: "Question 4: Describe a picture",
      instruction: "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare. Then you will have 30 seconds to talk about the picture.",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop",
      imageDescription: "A busy outdoor market scene where people are purchasing fresh fruits and vegetables from a vendor.",
      prepTime: 45,
      respTime: 30
    }
  ],
  part3: [
    {
      id: 1,
      title: "Questions 5-7: Respond to questions",
      instruction: "In this part of the test, you will answer three questions. You will have 3 seconds to prepare after each question. Then you will have 15 seconds to respond to Question 5 and 6, and 30 seconds to respond to Question 7.",
      context: "Imagine that an English marketing firm is doing research in your area. You have agreed to participate in a telephone interview about shopping habits.",
      questions: [
        {
          num: 5,
          text: "How often do you go shopping for clothes, and where do you usually buy them?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 6,
          text: "What was the last item of clothing you purchased, and were you satisfied with it?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 7,
          text: "When buying clothes, do you think recommendations from friends are more important than online reviews? Why?",
          prepTime: 3,
          respTime: 30
        }
      ]
    },
    {
      id: 2,
      title: "Questions 5-7: Respond to questions",
      instruction: "In this part of the test, you will answer three questions. You will have 3 seconds to prepare after each question. Then you will have 15 seconds to respond to Question 5 and 6, and 30 seconds to respond to Question 7.",
      context: "Imagine that an English magazine is conducting a survey about movie-watching habits. You have agreed to do an interview.",
      questions: [
        {
          num: 5,
          text: "How often do you watch movies, and do you prefer watching them at home or in a theater?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 6,
          text: "What is your favorite genre of movie, and why do you like it?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 7,
          text: "Do you think the price of movie tickets is reasonable nowadays? Why or why not?",
          prepTime: 3,
          respTime: 30
        }
      ]
    }
  ],
  part4: [
    {
      id: 1,
      title: "Questions 8-10: Respond to questions using information provided",
      instruction: "In this part of the test, you will answer three questions based on the program provided. You will have 45 seconds to read the program before the questions begin. You will have 3 seconds to prepare after each question. Then you will have 15 seconds to respond to Question 8 and 9, and 30 seconds to respond to Question 10.",
      infoType: "schedule",
      infoTitle: "Global Business Leaders Conference 2026",
      infoDate: "Date: October 15, 2026 | Location: Grand Convention Hall",
      infoDetails: [
        { time: "09:00 AM - 09:30 AM", event: "Welcome Address & Opening Remarks", speaker: "Dr. Elena Rostova (Conference Chairperson)" },
        { time: "09:30 AM - 10:30 AM", event: "Keynote Session: The Future of AI in Business", speaker: "Marcus Sterling (CEO of NextGen Tech)" },
        { time: "10:30 AM - 11:00 AM", event: "Coffee Break & Networking Session", speaker: "All Attendees" },
        { time: "11:00 AM - 12:30 PM", event: "Panel Discussion: Sustainable Corporate Strategies", speaker: "Panelists: Sarah Jenkins, Kenji Sato, Maria Lopez" },
        { time: "12:30 PM - 02:00 PM", event: "Networking Lunch (Buffet provided at the Dining Room)", speaker: "Free Time" },
        { time: "02:00 PM - 03:30 PM", event: "Workshop: Building Effective Marketing Campaigns", speaker: "David Vance (VP of Marketing)" }
      ],
      questions: [
        {
          num: 8,
          text: "What time does the keynote session start, and who is the speaker for this session?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 9,
          text: "I heard that the networking lunch is not provided and we have to pay extra. Is that correct?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 10,
          text: "Could you give me all the details about the sessions scheduled in the morning, before lunchtime?",
          prepTime: 3,
          respTime: 30
        }
      ]
    },
    {
      id: 2,
      title: "Questions 8-10: Respond to questions using information provided",
      instruction: "In this part of the test, you will answer three questions based on the program provided. You will have 45 seconds to read the program before the questions begin. You will have 3 seconds to prepare after each question. Then you will have 15 seconds to respond to Question 8 and 9, and 30 seconds to respond to Question 10.",
      infoType: "course",
      infoTitle: "Oakwood Community College - Fall Semester Evening Courses",
      infoDate: "Registration Period: August 1 - August 25, 2026",
      infoDetails: [
        { time: "Mondays, 6:00 PM - 8:00 PM", event: "Introduction to Digital Photography", speaker: "Instructor: Liam O'Connor | Tuition: $150" },
        { time: "Tuesdays, 6:30 PM - 8:30 PM", event: "Creative Writing Workshop", speaker: "Instructor: Rebecca Miller | Tuition: $120" },
        { time: "Wednesdays, 7:00 PM - 9:00 PM", event: "Conversational Spanish (Beginner)", speaker: "Instructor: Sofia Rodriguez | Tuition: $135" },
        { time: "Thursdays, 6:00 PM - 8:00 PM", event: "Basic Web Development with HTML/CSS", speaker: "Instructor: Liam O'Connor | Tuition: $180" },
        { time: "Fridays, 6:30 PM - 8:30 PM", event: "Introduction to Public Speaking", speaker: "Instructor: Dr. Harold Finch | Tuition: $130" }
      ],
      questions: [
        {
          num: 8,
          text: "When is the registration period for the fall semester evening courses?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 9,
          text: "I want to take a course taught by Liam O'Connor, but I can only attend on Wednesdays. Is there a course available for me?",
          prepTime: 3,
          respTime: 15
        },
        {
          num: 10,
          text: "I am interested in courses that start at 6:00 PM. Could you please give me all the details about those courses?",
          prepTime: 3,
          respTime: 30
        }
      ]
    }
  ],
  part5: [
    {
      id: 1,
      title: "Question 11: Express an opinion",
      instruction: "In this part of the test, you will give your opinion about a specific topic. Be sure to say as much as you can in the time allowed. You will have 45 seconds to prepare. Then you will have 60 seconds to speak.",
      questionText: "Do you agree or disagree with the following statement? 'It is more important for students to study science and mathematics than it is for them to study art and literature.' Support your opinion with specific reasons and examples.",
      prepTime: 45,
      respTime: 60
    },
    {
      id: 2,
      title: "Question 11: Express an opinion",
      instruction: "In this part of the test, you will give your opinion about a specific topic. Be sure to say as much as you can in the time allowed. You will have 45 seconds to prepare. Then you will have 60 seconds to speak.",
      questionText: "Which of the following factors is most important when choosing a company to work for? \n- Opportunities for promotion\n- Friendly co-workers\n- High starting salary\nSupport your choice with specific reasons and details.",
      prepTime: 45,
      respTime: 60
    }
  ]
};

// ES Module 지원 및 브라우저 호환성을 위해 window 객체에도 바인딩
if (typeof window !== 'undefined') {
  window.toeicSpeakingQuestions = toeicSpeakingQuestions;
}
