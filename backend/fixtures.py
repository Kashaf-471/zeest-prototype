SCENARIOS = {
    "respiratory": {
        "label": "Synthetic respiratory follow-up",
        "diagnosis": "Simulated draft: respiratory symptoms requiring physician assessment. This fixed scenario does not establish a diagnosis.",
        "treatment": "Illustrative plan: verify history and examination, reconcile medications and decide appropriate follow-up. No autonomous prescription.",
        "findings": {
            "imaging": "Fixed simulated finding: no diagnostic imaging inference performed.",
            "laboratory": "Fixed simulated laboratory finding: review the supplied panel with the clinical context.",
            "medication": "Fixed simulated medication finding: confirm the supplied medication list and allergy history.",
        },
    },
    "routine": {
        "label": "Synthetic routine review",
        "diagnosis": "Simulated draft: routine outpatient review in a synthetic case.",
        "treatment": "Illustrative plan: confirm symptoms, review the recorded observations and document physician follow-up.",
        "findings": {
            "imaging": "Fixed simulated finding: no imaging conclusion available.",
            "laboratory": "Fixed simulated laboratory finding: supplied observations require physician interpretation.",
            "medication": "Fixed simulated medication finding: medication reconciliation remains necessary.",
        },
    },
}


def findings(inputs, scenario):
    fixture = SCENARIOS.get(scenario)
    return [
        {
            "input_id": i.id,
            "kind": i.kind,
            "finding": fixture["findings"].get(
                i.kind, "No simulated analysis mapped to this input"
            )
            if fixture and not i.file
            else "No simulated analysis mapped to this input",
            "simulated": True,
        }
        for i in inputs
    ]


def evidence(scenario):
    return [
        {
            "id": "SIM-" + scenario.upper() + "-01",
            "title": "Fictional illustrative evidence",
            "passage": "Review source observations and verify the clinical context before accepting this synthetic draft. This is not a medical guideline or real citation.",
        }
    ]
