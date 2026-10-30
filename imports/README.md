# Question imports

Question files written outside the app go here. Each file is imported into the Review Queue as drafts:

```bash
npm run import -- imports/<file>.json
```

## File format

```json
{
  "source": "Default source label for every item (optional)",
  "questions": [
    {
      "subject": "NP III",
      "topic": "Oxygenation (Airway, Gas Exchange, Perfusion)",
      "situation": "",
      "stem": "Which assessment finding does the nurse expect in a client with LEFT-sided heart failure?",
      "options": ["Jugular vein distention", "Crackles at the lung bases and dyspnea", "Dependent pitting edema", "Hepatomegaly"],
      "answer": "B",
      "rationale": "Left ventricular failure backs blood up into the pulmonary circulation.",
      "explanations": ["Right-sided failure.", "Correct.", "Right-sided failure.", "Right-sided failure."],
      "difficulty": "Moderate",
      "bloom": "Understanding",
      "source": "Med-Surg Review Book, ch. 12, p. 341",
      "quote": "Left-sided heart failure causes pulmonary congestion"
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| `subject` | `NP I` to `NP V` (`NP3` also works) |
| `topic` | A topic name from the Blueprint (PRC Annex A topics). A new name creates a new topic under that subject. |
| `situation` | Shared scenario for a situational set, or `""`. Items in one set use identical text. |
| `options` | Exactly 4, without letters |
| `answer` | `A`, `B`, `C`, or `D` |
| `explanations` | Exactly 4, one per option in A–D order |
| `difficulty` | `Easy`, `Moderate`, or `Difficult` |
| `bloom` | `Remembering`, `Understanding`, `Applying`, `Analyzing`, `Evaluating`, or `Creating` |
| `source`, `quote` | Where the answer comes from, and a short supporting quote (optional, but they help review) |
