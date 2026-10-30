import { get, run, transaction } from "./db.ts";

// Subjects and topics follow PRC's enhanced Tables of Specifications (Annex A, Board of Nursing
// Resolution No. 10, s. 2025): 100 items per subject, with each topic's item count taken from the TOS.
// The TOS embeds laws and ethics across all topics, so they get their own topic with no target.
export const INTEGRATED = "Integrated: Professional Practice, Ethics & Law";

type Topic = [name: string, items: number];

export const SUBJECTS: { code: string; name: string; description: string; topics: Topic[] }[] = [
  {
    code: "NP I",
    name: "Community Health Nursing",
    description: "Care of Individuals, Families, Population Groups and Community (Community Health Nursing)",
    topics: [
      ["Care of Individuals: Communicable & Non-Communicable Diseases", 20],
      ["Care of Families (Normal & At Risk)", 20],
      ["Care of Population Groups", 20],
      ["Care of the Community: Health System, PHC, Epidemiology & Disaster", 20],
      ["Health Education", 10],
      ["Utilization of Research", 10],
      [INTEGRATED, 0],
    ],
  },
  {
    code: "NP II",
    name: "Mother, Adolescent & Human Growth and Development",
    description:
      "Part 1 - Care of Mother, Adolescent (Well Clients), At Risk or With Problems (Acute & Chronic); Part 2 - Human Growth and Development",
    topics: [
      ["Care of Mother Before Birth", 8],
      ["Care of Mother During Labor and Birth", 8],
      ["Care of Mother Following Birth", 8],
      ["Care of Mother with Complications of Childbearing", 8],
      ["Reproductive Health (Male & Female)", 8],
      ["Maternal Care: Ethico-Moral, Legal & Management", 10],
      ["Theories of Growth and Development", 10],
      ["Care of the Well Child (Neonate to Adolescent)", 15],
      ["Care of the At-Risk and Sick Child", 15],
      ["Child Care: Legal, Collaboration & Teamwork", 10],
      [INTEGRATED, 0],
    ],
  },
  {
    code: "NP III",
    name: "Surgery, Oxygenation, F&E, Immunologic Response, Cellular Aberrations",
    description:
      "Care of Clients with Problems in Surgery, Oxygenation, Fluid and Electrolytes, Infectious, Inflammatory and Immunologic Response, Cellular Aberrations (Acute and Chronic)",
    topics: [
      ["Care of Patients Undergoing Surgery", 10],
      ["Oxygenation (Airway, Gas Exchange, Perfusion)", 20],
      ["Fluids, Electrolytes & Acid-Base Balance", 20],
      ["Infectious, Inflammatory & Immunologic Disorders", 16],
      ["Cellular Aberrations", 14],
      ["Health Education", 10],
      ["Quality Improvement & Research", 10],
      [INTEGRATED, 0],
    ],
  },
  {
    code: "NP IV",
    name: "Nutrition, GI, Metabolism & Endocrine, Perception & Coordination",
    description:
      "Care of Client with Problems in Nutrition, and Gastro-Intestinal, Metabolism and Endocrine, Perception and Coordination (Acute and Chronic)",
    topics: [
      ["Nutrition & Gastrointestinal Disorders", 25],
      ["Metabolic & Endocrine Disorders", 25],
      ["Perception & Coordination Disorders", 30],
      ["Health Education", 5],
      ["Collaboration & Teamwork", 5],
      ["Reporting & Recording", 5],
      ["Personal & Professional Development", 5],
      [INTEGRATED, 0],
    ],
  },
  {
    code: "NP V",
    name: "Maladaptive Behavior; Life-Threatening & Emergency Care",
    description:
      "Care of Clients with Maladaptive Patterns of Behavior (Acute and Chronic); Care of Clients with Life-Threatening Condition, Acutely Ill/Multi-Organ Problems, High Acuity and Emergency Situation",
    topics: [
      ["Concepts of Mental Health & Therapeutic Models", 20],
      ["Psychiatric Nursing Process, Disorders & Treatment", 30],
      ["Acute Biologic Crisis & Emergency Care", 30],
      ["Therapeutic Communication", 5],
      ["Documentation in Psychiatric Nursing", 5],
      ["Collaboration & Teamwork", 5],
      ["Equipment for High-Acuity & Emergency Care", 5],
      [INTEGRATED, 0],
    ],
  },
];

interface Sample {
  subject: string;
  topic: string;
  difficulty: string;
  bloom: string;
  situation?: string;
  stem: string;
  options: [string, string, string, string];
  answer: number;
  rationale: string;
  explanations: [string, string, string, string];
}

// Placeholder items so the bank and practice exam work before any source is uploaded.
// They are flagged as samples and can be deleted from the Question Bank.
const SAMPLES: Sample[] = [
  {
    subject: "NP I", topic: "Care of Population Groups", difficulty: "Easy", bloom: "Remembering",
    stem: "Under the DOH Expanded Program on Immunization, which vaccines are given to a newborn at birth?",
    options: ["BCG and Hepatitis B", "Pentavalent and OPV", "MMR and PCV", "IPV and Rotavirus"],
    answer: 0,
    rationale: "BCG and the Hepatitis B birth dose are given at birth; the Hepatitis B birth dose is ideally given within 24 hours of delivery.",
    explanations: ["Correct: both are birth-dose vaccines.", "Pentavalent and OPV start at 6 weeks of age.", "Measles-containing vaccines start at 9 months; PCV starts at 6 weeks.", "IPV is given at 14 weeks; rotavirus is not a birth-dose vaccine."],
  },
  {
    subject: "NP I", topic: "Care of Families (Normal & At Risk)", difficulty: "Moderate", bloom: "Applying",
    stem: "During a home visit, which action by the community health nurse reflects correct bag technique?",
    options: ["Placing the bag on a clean, flat surface lined with paper", "Placing the bag on the client's bed so supplies are within reach", "Performing hand hygiene only after the procedure is completed", "Returning used articles to the bag before cleaning them"],
    answer: 0,
    rationale: "Bag technique minimizes the spread of infection; the bag is placed on a clean, protected surface away from children and pets.",
    explanations: ["Correct: a lined, clean surface protects the bag.", "The bed is considered a contaminated surface.", "Hand hygiene is done before AND after client care.", "Used articles are cleaned before being returned to the bag."],
  },
  {
    subject: "NP I", topic: "Care of Individuals: Communicable & Non-Communicable Diseases", difficulty: "Moderate", bloom: "Remembering",
    situation: "Nurse Ana is assigned to a barangay health station where dengue cases have risen during the rainy season. A 10-year-old with 3 days of fever is brought in for assessment.",
    stem: "When performing the tourniquet test, the nurse inflates the BP cuff midway between the systolic and diastolic pressures and maintains it for:",
    options: ["1 minute", "2 minutes", "5 minutes", "10 minutes"],
    answer: 2,
    rationale: "The cuff is maintained for 5 minutes. The test is positive when 20 or more petechiae appear per 1-inch (2.5 cm) square.",
    explanations: ["Too short to produce a reliable result.", "Too short to produce a reliable result.", "Correct: the standard duration is 5 minutes.", "Unnecessarily prolonged and uncomfortable for the client."],
  },
  {
    subject: "NP I", topic: INTEGRATED, difficulty: "Easy", bloom: "Remembering",
    stem: "Which law currently governs the practice of nursing in the Philippines?",
    options: ["RA 9173", "RA 7164", "RA 11223", "RA 10354"],
    answer: 0,
    rationale: "RA 9173, the Philippine Nursing Act of 2002, governs nursing practice and repealed RA 7164.",
    explanations: ["Correct: the Philippine Nursing Act of 2002.", "RA 7164 (Philippine Nursing Act of 1991) has been repealed.", "RA 11223 is the Universal Health Care Act.", "RA 10354 is the Responsible Parenthood and Reproductive Health Act."],
  },
  {
    subject: "NP II", topic: "Care of Mother Following Birth", difficulty: "Moderate", bloom: "Applying",
    situation: "Aling Rosa, G2P2, delivered spontaneously one hour ago. The nurse finds her fundus boggy, at the midline, two fingerbreadths above the umbilicus, with heavy lochia rubra.",
    stem: "What is the nurse's FIRST action?",
    options: ["Massage the fundus until firm", "Notify the physician immediately", "Increase the IV infusion rate", "Assist the client to void"],
    answer: 0,
    rationale: "A boggy fundus indicates uterine atony, the leading cause of postpartum hemorrhage. Fundal massage stimulates contraction and is the first nursing action.",
    explanations: ["Correct: massage addresses uterine atony directly.", "Notify after initiating the immediate nursing intervention.", "Fluid rate changes need an order and do not treat atony.", "Voiding is indicated when the fundus is displaced to one side, not midline."],
  },
  {
    subject: "NP II", topic: "Care of Mother During Labor and Birth", difficulty: "Difficult", bloom: "Analyzing",
    stem: "At 1 minute, a newborn has a heart rate of 110 bpm, a weak cry, some flexion of the extremities, grimaces with suctioning, and a pink body with blue extremities. What is the APGAR score?",
    options: ["4", "6", "7", "8"],
    answer: 1,
    rationale: "HR >100 = 2, weak cry = 1, some flexion = 1, grimace = 1, acrocyanosis = 1. Total = 6.",
    explanations: ["Undercounts the heart rate score.", "Correct: 2 + 1 + 1 + 1 + 1 = 6.", "Would require one more category scored as 2.", "Would require two more categories scored as 2."],
  },
  {
    subject: "NP III", topic: "Oxygenation (Airway, Gas Exchange, Perfusion)", difficulty: "Moderate", bloom: "Understanding",
    stem: "Which assessment finding does the nurse expect in a client with LEFT-sided heart failure?",
    options: ["Jugular vein distention", "Crackles at the lung bases and dyspnea", "Dependent pitting edema", "Hepatomegaly"],
    answer: 1,
    rationale: "Left ventricular failure backs blood up into the pulmonary circulation, producing pulmonary congestion, crackles, and dyspnea.",
    explanations: ["A sign of right-sided failure (systemic congestion).", "Correct: pulmonary congestion from left ventricular failure.", "A sign of right-sided failure.", "A sign of right-sided failure."],
  },
  {
    subject: "NP III", topic: "Fluids, Electrolytes & Acid-Base Balance", difficulty: "Easy", bloom: "Remembering",
    stem: "A client's serum potassium is 6.8 mEq/L. Which ECG change does the nurse anticipate?",
    options: ["Prominent U waves", "Tall, peaked T waves", "Flattened T waves", "ST-segment elevation"],
    answer: 1,
    rationale: "Hyperkalemia classically produces tall, peaked T waves; severe elevations can progress to a widened QRS and dysrhythmias.",
    explanations: ["Seen in hypokalemia.", "Correct: the classic hyperkalemia change.", "Seen in hypokalemia.", "Associated with myocardial injury or infarction."],
  },
  {
    subject: "NP III", topic: "Care of Patients Undergoing Surgery", difficulty: "Difficult", bloom: "Analyzing",
    stem: "After receiving endorsement, which client should the nurse see FIRST?",
    options: ["A client 6 hours post-thyroidectomy with new-onset stridor", "A client with COPD whose SpO2 is 90%", "A client with diabetes due for scheduled insulin", "A client 2 days post-appendectomy reporting pain of 4/10"],
    answer: 0,
    rationale: "Stridor after thyroidectomy signals airway obstruction (edema, hematoma, or laryngeal nerve injury); an airway emergency takes priority.",
    explanations: ["Correct: airway compromise is the priority.", "An SpO2 of 88-92% is often an acceptable baseline in COPD.", "A scheduled, routine task for a stable client.", "A stable client with moderate pain; address after the emergency."],
  },
  {
    subject: "NP III", topic: "Oxygenation (Airway, Gas Exchange, Perfusion)", difficulty: "Easy", bloom: "Applying",
    stem: "Before giving digoxin to an adult client, the nurse counts the apical pulse for one full minute. The nurse should withhold the dose if the rate is below:",
    options: ["50 bpm", "60 bpm", "70 bpm", "80 bpm"],
    answer: 1,
    rationale: "Digoxin slows the heart rate. For adults, the dose is withheld and the physician notified if the apical pulse is below 60 bpm.",
    explanations: ["Too low a cut-off; bradycardia would already be present.", "Correct: the adult threshold is 60 bpm.", "Within normal range; the dose can be given.", "Within normal range; the dose can be given."],
  },
  {
    subject: "NP IV", topic: "Nutrition & Gastrointestinal Disorders", difficulty: "Moderate", bloom: "Understanding",
    stem: "A 4-week-old infant is brought to the clinic for vomiting after every feeding. Which finding supports hypertrophic pyloric stenosis?",
    options: ["Projectile, non-bilious vomiting with an olive-shaped mass", "\"Currant jelly\" stools with a sausage-shaped mass", "Ribbon-like, foul-smelling stools", "Bulky, greasy, foul-smelling stools"],
    answer: 0,
    rationale: "Hypertrophy of the pyloric sphincter causes projectile, non-bilious vomiting and a palpable olive-shaped mass in the epigastrium.",
    explanations: ["Correct: the classic presentation.", "Classic for intussusception.", "Classic for Hirschsprung's disease.", "Steatorrhea suggests cystic fibrosis or celiac disease."],
  },
  {
    subject: "NP IV", topic: "Metabolic & Endocrine Disorders", difficulty: "Moderate", bloom: "Applying",
    stem: "A client with type 1 diabetes is diaphoretic, tremulous, and confused. Capillary blood glucose is 50 mg/dL. The client is awake and can swallow. What is the FIRST action?",
    options: ["Give 15 g of fast-acting carbohydrate", "Administer the scheduled insulin dose", "Prepare IV dextrose 50%", "Recheck the blood glucose in 1 hour"],
    answer: 0,
    rationale: "For a conscious client who can swallow, give 15 g of fast-acting carbohydrate and recheck in 15 minutes (the rule of 15).",
    explanations: ["Correct: oral glucose for a conscious client.", "Insulin will lower glucose further.", "Reserved for clients who are unconscious or cannot swallow.", "Delaying treatment risks seizures and loss of consciousness."],
  },
  {
    subject: "NP IV", topic: "Perception & Coordination Disorders", difficulty: "Moderate", bloom: "Understanding",
    stem: "Which finding is a LATE sign of increased intracranial pressure?",
    options: ["Restlessness and irritability", "Headache that worsens with coughing", "Bradycardia with a widening pulse pressure", "A subtle change in level of consciousness"],
    answer: 2,
    rationale: "Bradycardia, widening pulse pressure, and irregular respirations (Cushing's triad) are late signs of increased ICP.",
    explanations: ["An early sign.", "An early sign.", "Correct: part of Cushing's triad.", "A change in LOC is the EARLIEST sign."],
  },
  {
    subject: "NP V", topic: "Psychiatric Nursing Process, Disorders & Treatment", difficulty: "Easy", bloom: "Understanding",
    stem: "The nurse reviews the serum lithium level of a client on maintenance therapy. Which level is within the therapeutic range?",
    options: ["0.2 mEq/L", "0.8 mEq/L", "1.8 mEq/L", "2.6 mEq/L"],
    answer: 1,
    rationale: "The usual maintenance therapeutic range for lithium is 0.6-1.2 mEq/L.",
    explanations: ["Subtherapeutic.", "Correct: within 0.6-1.2 mEq/L.", "Toxic level.", "Severe toxicity."],
  },
  {
    subject: "NP V", topic: "Psychiatric Nursing Process, Disorders & Treatment", difficulty: "Moderate", bloom: "Applying",
    situation: "Mang Ramon, 58, was admitted for major depressive disorder after losing his job. During the evening shift, he gives his wristwatch to his roommate and tells the nurse, \"I won't be needing my things anymore.\"",
    stem: "What is the BEST response by the nurse?",
    options: ["\"Are you thinking of hurting or killing yourself?\"", "\"You have a family that loves you. Don't think like that.\"", "\"Why would you give away something so valuable?\"", "\"Let's talk about something more cheerful.\""],
    answer: 0,
    rationale: "Giving away possessions is a warning sign of suicide. Asking directly about suicidal intent is therapeutic and does not increase risk.",
    explanations: ["Correct: direct assessment of suicidal intent.", "False reassurance that dismisses feelings.", "\"Why\" questions put the client on the defensive.", "Changing the subject blocks communication."],
  },
  {
    subject: "NP V", topic: "Psychiatric Nursing Process, Disorders & Treatment", difficulty: "Moderate", bloom: "Applying",
    stem: "A client with schizophrenia appears to be listening intently to something and says the voices are talking again. What is the BEST response?",
    options: ["\"There are no voices. It is just your illness.\"", "\"I don't hear the voices, but I know they seem real to you. What are they saying?\"", "\"Just ignore the voices and they will go away.\"", "\"Let me get your PRN medication right away.\""],
    answer: 1,
    rationale: "The nurse presents reality without arguing, acknowledges the experience, and assesses for command hallucinations that may pose a safety risk.",
    explanations: ["Argues with the client and dismisses the experience.", "Correct: presents reality and assesses content.", "Unrealistic and dismissive.", "Acts before assessing the content of the hallucinations."],
  },
];

export function seed(): void {
  const existing = get<{ n: number }>("SELECT COUNT(*) AS n FROM subjects");
  if (existing && existing.n > 0) return;

  transaction(() => {
    const subjectIds = new Map<string, number>();
    const topicIds = new Map<string, number>();
    SUBJECTS.forEach((s, si) => {
      const { id } = run(
        "INSERT INTO subjects (code, name, description, target_items, sort) VALUES (?, ?, ?, 100, ?)",
        s.code, s.name, s.description, si,
      );
      subjectIds.set(s.code, id);
      s.topics.forEach(([name, items], ti) => {
        const topic = run("INSERT INTO topics (subject_id, name, weight, target_items, sort) VALUES (?, ?, ?, ?, ?)", id, name, items, items, ti);
        topicIds.set(`${s.code}|${name}`, topic.id);
      });
    });

    for (const q of SAMPLES) {
      run(
        `INSERT INTO questions (subject_id, topic_id, situation, stem, options, correct_index, rationale, explanations,
           difficulty, bloom, format, status, source_label, is_sample)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'Sample question (not from your materials)', 1)`,
        subjectIds.get(q.subject), topicIds.get(`${q.subject}|${q.topic}`), q.situation ?? "", q.stem,
        JSON.stringify(q.options), q.answer, q.rationale, JSON.stringify(q.explanations), q.difficulty, q.bloom,
        q.situation ? "situational" : "single",
      );
    }
  });
}
