// Test questions returned in mock AI mode (MOCK_AI=true). Each quotes the sample review notes in
// mock-data/ word for word, so the source-quote check behaves as it does with real generations.

export interface MockItem {
  subject: string;
  topic: string;
  difficulty: "Easy" | "Moderate" | "Difficult";
  bloom: "Remembering" | "Understanding" | "Applying" | "Analyzing" | "Evaluating" | "Creating";
  situation?: string;
  stem: string;
  options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D";
  rationale: string;
  explanations: [string, string, string, string];
  quote: string;
}

export const MOCK_POOL: MockItem[] = [
  // NP I
  {
    subject: "NP I", topic: "Community Health Nursing Process & Primary Health Care", difficulty: "Easy", bloom: "Understanding",
    stem: "Nurse Liza holds an immunization session for infants at the barangay health station. This activity is an example of which level of prevention?",
    options: ["Tertiary prevention", "Secondary prevention", "Primary prevention", "Health restoration"],
    answer: "C",
    rationale: "Immunization is specific protection, which falls under primary prevention.",
    explanations: ["Tertiary prevention covers rehabilitation and limiting disability.", "Secondary prevention covers early diagnosis and prompt treatment.", "Correct: specific protection such as immunization is primary prevention.", "Restoration of health follows illness; immunization prevents it."],
    quote: "Primary prevention covers health promotion and specific protection such as immunization",
  },
  {
    subject: "NP I", topic: "Family Health Nursing & Home Visits", difficulty: "Moderate", bloom: "Applying",
    stem: "During a family assessment, the nurse learns that the father smokes two packs of cigarettes a day. In the first-level assessment, this is classified as a:",
    options: ["Health deficit", "Foreseeable crisis", "Wellness state", "Health threat"],
    answer: "D",
    rationale: "Smoking is a condition conducive to disease, so it is a health threat.",
    explanations: ["A health deficit is an existing failure in health maintenance, such as illness.", "Foreseeable crises are anticipated stress points, such as a pregnancy or job loss.", "A wellness state is a strength or opportunity, not a risk factor.", "Correct: smoking is a risk factor that threatens health."],
    quote: "Health threats are conditions conducive to disease, accident, or failure to realize health potential, such as smoking",
  },
  {
    subject: "NP I", topic: "Epidemiology & Vital Statistics", difficulty: "Easy", bloom: "Remembering",
    stem: "To compute the infant mortality rate, the nurse divides the number of deaths among infants under 1 year of age by the:",
    options: ["Total population of the barangay", "Number of live births in the same year", "Midyear population", "Number of registered pregnancies"],
    answer: "B",
    rationale: "The infant mortality rate uses live births in the same year as its denominator, multiplied by 1,000.",
    explanations: ["The total population is not the population at risk for infant deaths.", "Correct: live births are the denominator.", "The midyear population is the denominator of the crude birth rate.", "Pregnancies include those that do not end in live births."],
    quote: "divided by the number of live births in the same year, multiplied by 1,000",
  },
  {
    subject: "NP I", topic: "Communicable Disease Control", difficulty: "Moderate", bloom: "Applying",
    situation: "Barangay San Isidro reports a rise in dengue cases during the rainy season. The community health nurse plans a health education campaign.",
    stem: "Which activity BEST reflects the first 'S' of the DOH 4S strategy?",
    options: ["Searching for and destroying mosquito breeding places", "Requesting community-wide fogging every week", "Distributing antibiotics to children with fever", "Isolating all residents who have a fever"],
    answer: "A",
    rationale: "The first S is search and destroy mosquito breeding places, which removes the vector's habitat.",
    explanations: ["Correct: search and destroy breeding places.", "Fogging is supported only in hotspot areas, not weekly everywhere.", "Dengue is viral; antibiotics do not treat or prevent it.", "Dengue is not spread person to person, so isolation is not a 4S step."],
    quote: "Search and destroy mosquito breeding places",
  },
  {
    subject: "NP I", topic: "Environmental Health & Disaster Nursing", difficulty: "Easy", bloom: "Applying",
    stem: "After an earthquake, the nurse triages a client who is walking and has a forearm laceration with minimal bleeding. Using START triage, which tag does the nurse assign?",
    options: ["Red", "Yellow", "Green", "Black"],
    answer: "C",
    rationale: "Clients who can walk and have minor injuries are tagged green.",
    explanations: ["Red is for life-threatening but treatable injuries.", "Yellow is for injuries that can wait for delayed care.", "Correct: walking wounded with minor injuries.", "Black is for the dead or expectant."],
    quote: "A green tag is for the walking wounded with minor injuries",
  },

  // NP II
  {
    subject: "NP II", topic: "Antepartum Care", difficulty: "Moderate", bloom: "Applying",
    stem: "A client's last menstrual period began on June 10, 2025. Using Naegele's rule, what is her expected date of delivery?",
    options: ["September 17, 2025", "March 3, 2026", "March 17, 2026", "April 17, 2026"],
    answer: "C",
    rationale: "June 10 + 7 days = June 17; minus 3 months = March 17; plus 1 year = March 17, 2026.",
    explanations: ["Adds 3 months instead of subtracting them.", "Subtracts 7 days instead of adding them.", "Correct: June 17, minus 3 months, plus 1 year.", "Subtracts only 2 months."],
    quote: "add 7 days to the first day of the last menstrual period, subtract 3 months, and add 1 year",
  },
  {
    subject: "NP II", topic: "Intrapartum Care", difficulty: "Moderate", bloom: "Applying",
    situation: "Aling Marites, G1P0, is in active labor with an oxytocin infusion running. The fetal monitor shows late decelerations.",
    stem: "What is the nurse's FIRST action?",
    options: ["Turn the client to her left side", "Increase the oxytocin infusion rate", "Prepare for immediate cesarean delivery", "Document the finding and continue monitoring"],
    answer: "A",
    rationale: "Late decelerations suggest uteroplacental insufficiency; left lateral positioning improves placental blood flow.",
    explanations: ["Correct: improves uteroplacental perfusion.", "Oxytocin should be stopped, not increased.", "Cesarean delivery is considered only if the pattern persists after intervention.", "Late decelerations need immediate action, not just documentation."],
    quote: "The nurse should first turn the client to her left side",
  },
  {
    subject: "NP II", topic: "Newborn Care (EINC)", difficulty: "Easy", bloom: "Remembering",
    stem: "Immediately after a vaginal birth, which Essential Intrapartum and Newborn Care step does the nurse perform FIRST?",
    options: ["Clamp and cut the cord immediately", "Dry the newborn thoroughly", "Weigh the newborn", "Give vitamin K"],
    answer: "B",
    rationale: "Immediate and thorough drying is the first time-bound EINC step.",
    explanations: ["Cord clamping is properly timed after cord pulsations stop.", "Correct: drying comes first.", "Weighing is deferred until after early breastfeeding.", "Vitamin K is given after the time-bound steps."],
    quote: "immediate and thorough drying of the newborn",
  },
  {
    subject: "NP II", topic: "High-Risk Pregnancy & Complications", difficulty: "Difficult", bloom: "Analyzing",
    stem: "A client with severe preeclampsia is receiving magnesium sulfate. Which finding requires the nurse to withhold the drug and notify the physician?",
    options: ["Deep tendon reflexes of 2+", "Urine output of 40 mL per hour", "Blood pressure of 150/100 mmHg", "Respiratory rate of 10 breaths per minute"],
    answer: "D",
    rationale: "A respiratory rate below 12 breaths per minute is a sign of magnesium toxicity.",
    explanations: ["2+ reflexes are normal.", "Output above 30 mL per hour is adequate.", "Elevated blood pressure is why the drug is given, not a sign of toxicity.", "Correct: respiratory depression signals toxicity."],
    quote: "the respiratory rate is below 12 breaths per minute",
  },
  {
    subject: "NP II", topic: "Human Growth & Development", difficulty: "Easy", bloom: "Understanding",
    stem: "A 2-year-old insists on feeding himself and often says \"No!\" According to Erikson, which developmental task is he working on?",
    options: ["Trust versus mistrust", "Autonomy versus shame and doubt", "Initiative versus guilt", "Industry versus inferiority"],
    answer: "B",
    rationale: "Toddlers work on autonomy versus shame and doubt, shown by asserting independence.",
    explanations: ["The infant's task.", "Correct: the toddler's task.", "The preschooler's task.", "The school-age child's task."],
    quote: "toddlers develop autonomy versus shame and doubt",
  },

  // NP III
  {
    subject: "NP III", topic: "Perioperative Nursing", difficulty: "Moderate", bloom: "Applying",
    situation: "Mr. Reyes, 45, had a total thyroidectomy this morning.",
    stem: "He reports tingling around his mouth, and the nurse elicits a positive Chvostek's sign. Which medication should the nurse have available?",
    options: ["Potassium chloride", "Levothyroxine", "Calcium gluconate", "Propylthiouracil"],
    answer: "C",
    rationale: "Perioral tingling and a positive Chvostek's sign indicate hypocalcemia from parathyroid injury.",
    explanations: ["Treats hypokalemia, not hypocalcemia.", "Thyroid replacement does not correct acute hypocalcemia.", "Correct: treats acute hypocalcemia.", "Treats hyperthyroidism."],
    quote: "keep calcium gluconate available",
  },
  {
    subject: "NP III", topic: "Oxygenation: Respiratory", difficulty: "Moderate", bloom: "Applying",
    stem: "A client with COPD is short of breath. Which oxygen order does the nurse expect?",
    options: ["1 to 2 L per minute by nasal cannula", "6 L per minute by simple face mask", "10 L per minute by non-rebreather mask", "15 L per minute by Venturi mask"],
    answer: "A",
    rationale: "Clients with COPD receive low-flow oxygen because high oxygen levels may depress the hypoxic drive.",
    explanations: ["Correct: low-flow oxygen.", "Too high a flow for a client with COPD.", "Too high a flow for a client with COPD.", "Not a typical Venturi setting, and too high a concentration."],
    quote: "low-flow oxygen at 1 to 2 L per minute by nasal cannula",
  },
  {
    subject: "NP III", topic: "Infectious, Inflammatory & Immunologic Response", difficulty: "Easy", bloom: "Remembering",
    stem: "A client is admitted with suspected pulmonary tuberculosis. Which precaution does the nurse implement?",
    options: ["Contact precautions with gown and gloves", "Droplet precautions with a surgical mask", "Standard precautions only", "A negative-pressure room and an N95 respirator"],
    answer: "D",
    rationale: "Tuberculosis spreads by airborne droplet nuclei and requires airborne precautions.",
    explanations: ["Contact precautions do not stop airborne spread.", "A surgical mask does not filter droplet nuclei.", "Not enough for an airborne disease.", "Correct: airborne precautions."],
    quote: "a negative-pressure room and an N95 respirator",
  },
  {
    subject: "NP III", topic: "Cellular Aberrations (Oncology)", difficulty: "Moderate", bloom: "Applying",
    stem: "A client receiving chemotherapy has an absolute neutrophil count of 800/mm³. Which item brought by visitors should the nurse remove from the room?",
    options: ["A deck of playing cards", "A bouquet of fresh flowers", "A sealed box of crackers", "A printed prayer book"],
    answer: "B",
    rationale: "Fresh flowers can carry bacteria and fungi and are not allowed under neutropenic precautions.",
    explanations: ["Poses minimal infection risk.", "Correct: fresh flowers are not allowed.", "Sealed, packaged food is allowed.", "Poses minimal infection risk."],
    quote: "no fresh flowers, potted plants, or fresh raw fruits in the room",
  },
  {
    subject: "NP III", topic: "Fluid & Electrolytes", difficulty: "Moderate", bloom: "Understanding",
    stem: "A client's serum potassium is 2.9 mEq/L. Which finding does the nurse expect?",
    options: ["Tall, peaked T waves", "Hyperactive reflexes and diarrhea", "Muscle weakness and prominent U waves", "A positive Trousseau's sign"],
    answer: "C",
    rationale: "A potassium level below 3.5 mEq/L is hypokalemia, which causes muscle weakness and prominent U waves.",
    explanations: ["Seen in hyperkalemia.", "More typical of hypocalcemia or hyperkalemia.", "Correct: classic hypokalemia findings.", "A sign of hypocalcemia."],
    quote: "Hypokalemia: muscle weakness, leg cramps, and prominent U waves",
  },

  // NP IV
  {
    subject: "NP IV", topic: "Nutrition & Diet Therapy", difficulty: "Moderate", bloom: "Evaluating",
    stem: "Which statement by a client after a partial gastrectomy shows understanding of how to prevent dumping syndrome?",
    options: ["\"I will drink plenty of water with every meal.\"", "\"I will eat three large meals a day.\"", "\"I will choose foods high in carbohydrates.\"", "\"I will lie down for 20 to 30 minutes after meals.\""],
    answer: "D",
    rationale: "Lying down after meals slows gastric emptying and helps prevent dumping syndrome.",
    explanations: ["Fluids should be taken between meals, not with them.", "Small, frequent meals are recommended.", "The diet should be low in carbohydrates.", "Correct: slows gastric emptying."],
    quote: "should lie down for 20 to 30 minutes after meals",
  },
  {
    subject: "NP IV", topic: "Gastrointestinal", difficulty: "Easy", bloom: "Applying",
    situation: "Jun, 19, is admitted with pain at McBurney's point and rebound tenderness. An appendectomy is scheduled.",
    stem: "Which action should the nurse AVOID while Jun waits for surgery?",
    options: ["Applying a warm compress to the abdomen", "Keeping the client NPO", "Monitoring vital signs regularly", "Positioning the client for comfort"],
    answer: "A",
    rationale: "Heat increases circulation to the appendix and may cause it to rupture.",
    explanations: ["Correct: never apply heat to the abdomen.", "Appropriate before surgery.", "Appropriate and expected.", "Appropriate comfort care."],
    quote: "Never apply heat to the abdomen",
  },
  {
    subject: "NP IV", topic: "Metabolism & Endocrine", difficulty: "Easy", bloom: "Remembering",
    stem: "Which respiratory pattern does the nurse expect in a client with diabetic ketoacidosis?",
    options: ["Cheyne-Stokes respirations", "Kussmaul respirations", "Biot's respirations", "Bradypnea"],
    answer: "B",
    rationale: "Deep, rapid Kussmaul respirations compensate for metabolic acidosis in DKA.",
    explanations: ["Seen with brain injury or heart failure.", "Correct: compensates for metabolic acidosis.", "Seen with brain stem injury.", "DKA increases, not decreases, the respiratory rate."],
    quote: "Kussmaul respirations, and a fruity breath odor",
  },
  {
    subject: "NP IV", topic: "Metabolism & Endocrine", difficulty: "Moderate", bloom: "Applying",
    stem: "The physician orders an intravenous insulin infusion for a client in diabetic ketoacidosis. Which insulin does the nurse prepare?",
    options: ["NPH insulin", "Insulin glargine", "Regular insulin", "Premixed 70/30 insulin"],
    answer: "C",
    rationale: "Regular insulin is the only insulin that can be given intravenously.",
    explanations: ["Intermediate-acting; not for IV use.", "Long-acting; not for IV use.", "Correct: the only IV insulin.", "Contains NPH; not for IV use."],
    quote: "Regular insulin is the only insulin that can be given intravenously",
  },
  {
    subject: "NP IV", topic: "Perception & Coordination: Sensory & Musculoskeletal", difficulty: "Difficult", bloom: "Analyzing",
    situation: "A client has a new long-leg cast after a tibial fracture.",
    stem: "Which finding is the EARLIEST sign of compartment syndrome?",
    options: ["Pain unrelieved by analgesics and increased by passive stretching", "Absent pedal pulses", "Paralysis of the toes", "Pale, cool toes"],
    answer: "A",
    rationale: "Pain out of proportion to the injury, worse with passive stretching, is the earliest sign.",
    explanations: ["Correct: the earliest sign.", "A late sign.", "A late sign.", "Can occur but is not the earliest sign."],
    quote: "pain unrelieved by analgesics and increased by passive stretching",
  },

  // NP V
  {
    subject: "NP V", topic: "Anxiety, Mood & Personality Disorders", difficulty: "Easy", bloom: "Applying",
    stem: "A client taking phenelzine, an MAO inhibitor, asks about diet. Which food should the client avoid?",
    options: ["Fresh chicken", "Aged cheese", "Steamed rice", "Fresh apples"],
    answer: "B",
    rationale: "Aged cheese is high in tyramine, which can cause a hypertensive crisis with MAO inhibitors.",
    explanations: ["Fresh meat is low in tyramine.", "Correct: high in tyramine.", "Low in tyramine.", "Low in tyramine."],
    quote: "aged cheese, red wine, and cured meats",
  },
  {
    subject: "NP V", topic: "Schizophrenia & Psychotic Disorders", difficulty: "Difficult", bloom: "Analyzing",
    stem: "A client taking haloperidol has a temperature of 40 °C, muscle rigidity, and confusion. What is the nurse's PRIORITY action?",
    options: ["Give the next dose of haloperidol", "Apply a cooling blanket and recheck in 4 hours", "Stop the antipsychotic and notify the physician", "Encourage oral fluids and rest"],
    answer: "C",
    rationale: "These are signs of neuroleptic malignant syndrome, a medical emergency.",
    explanations: ["Continuing the drug worsens the condition.", "Cooling helps, but stopping the drug and getting help come first.", "Correct: stop the drug and escalate.", "Not enough for a medical emergency."],
    quote: "Stop the antipsychotic and notify the physician immediately",
  },
  {
    subject: "NP V", topic: "Emergency & High-Acuity Care", difficulty: "Moderate", bloom: "Applying",
    stem: "An adult has burns over the entire surface of both legs. Using the rule of nines, what percentage of total body surface area is burned?",
    options: ["18%", "27%", "36%", "45%"],
    answer: "C",
    rationale: "Each leg is 18%, so both legs are 36%.",
    explanations: ["Only one leg.", "One leg plus one arm.", "Correct: 18% x 2.", "Overestimates the burned area."],
    quote: "each leg 18%",
  },
  {
    subject: "NP V", topic: "Emergency & High-Acuity Care", difficulty: "Difficult", bloom: "Analyzing",
    stem: "A 70-kg client has burns over 20% of total body surface area. Using the Parkland formula, how much fluid should be given in the first 8 hours?",
    options: ["1,400 mL", "2,800 mL", "5,600 mL", "11,200 mL"],
    answer: "B",
    rationale: "4 mL x 70 kg x 20% = 5,600 mL over 24 hours; half, 2,800 mL, is given in the first 8 hours.",
    explanations: ["A quarter of the total.", "Correct: half of 5,600 mL.", "The full 24-hour total.", "Double the 24-hour total."],
    quote: "half of the total is given in the first 8 hours",
  },
  {
    subject: "NP V", topic: "Crisis, Suicide & Violence", difficulty: "Moderate", bloom: "Applying",
    situation: "Ana, 32, started sertraline for major depression 12 days ago. Today she seems more energetic and is giving away her belongings.",
    stem: "What is the nurse's BEST action?",
    options: ["Praise her improved mood and energy", "Ask her directly whether she is thinking of suicide", "Encourage her to increase her activity level", "Tell her the medication is working well"],
    answer: "B",
    rationale: "Suicide risk can rise as energy returns early in antidepressant therapy; giving away belongings is a warning sign.",
    explanations: ["Misses the warning signs.", "Correct: assess suicide risk directly.", "Does not address the safety risk.", "False reassurance that misses the risk."],
    quote: "Ask clients directly about suicidal thoughts",
  },
  {
    subject: "NP V", topic: "Emergency & High-Acuity Care", difficulty: "Easy", bloom: "Remembering",
    stem: "During adult CPR, at what rate should the nurse deliver chest compressions?",
    options: ["60 to 80 per minute", "80 to 100 per minute", "100 to 120 per minute", "120 to 140 per minute"],
    answer: "C",
    rationale: "Adult compressions are delivered at 100 to 120 per minute.",
    explanations: ["Too slow.", "Too slow.", "Correct.", "Too fast to allow full chest recoil."],
    quote: "a rate of 100 to 120 per minute",
  },
];
