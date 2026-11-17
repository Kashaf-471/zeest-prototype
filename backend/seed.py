from sqlalchemy import select
from db import *
from security import hash_password


def seed():
    with SessionLocal.begin() as s:
        admin_email = "admin@example.com"
        if not s.scalar(select(Physician).where(Physician.email == admin_email)):
            s.add(
                Physician(
                    name="Zeest Administrator",
                    email=admin_email,
                    password=hash_password("ZeestAdmin!2026"),
                    role="admin",
                )
            )
        physician_names = {1: "Dr. Sana Malik", 2: "Dr. Hamza Ali"}
        patient_surnames = {1: "Noor", 2: "Khan"}
        for n in (1, 2):
            email = f"doctor{n}@example.com"
            doctor = s.scalar(select(Physician).where(Physician.email == email))
            if doctor:
                if doctor.name == f"Dr. Demo {n}":
                    doctor.name = physician_names[n]
                for patient in s.scalars(
                    select(Patient).where(Patient.physician_id == doctor.id)
                ):
                    old_suffix = f" Demo {n}"
                    if patient.name.endswith(old_suffix):
                        patient.name = (
                            patient.name[: -len(old_suffix)]
                            + " "
                            + patient_surnames[n]
                        )
                continue
            doctor = Physician(
                name=physician_names[n],
                email=email,
                password=hash_password("ZeestDemo!2026"),
                role="physician",
            )
            s.add(doctor)
            s.flush()
            for k, name in enumerate(["Amina", "Bilal", "Sara"]):
                p = Patient(
                    physician_id=doctor.id,
                    name=f"{name} {patient_surnames[n]}",
                    info=f"Synthetic record only. Age {35 + k * 9}. Allergy: none documented. History: routine outpatient follow-up.",
                )
                s.add(p)
                s.flush()
                for j in range(2 if k == 0 else 1):
                    e = Encounter(
                        patient_id=p.id,
                        date=f"2026-10-{20 - j:02d}",
                        title="Follow-up consultation"
                        if j == 0
                        else "Previous outpatient visit",
                    )
                    s.add(e)
                    s.flush()
                    for kind, content in [
                        (
                            "notes",
                            '{"transcript":"Synthetic history: follow-up requested.","subjective":"Intermittent cough in this synthetic scenario.","objective":"No examination entered.","assessment":"Awaiting physician assessment.","plan":"Review supplied history."}',
                        ),
                        (
                            "laboratory",
                            "Synthetic panel: Hb 12.8 g/dL; WBC 7.2 x10^9/L.",
                        ),
                        (
                            "medication",
                            "Synthetic medication list: no current medication documented.",
                        ),
                    ]:
                        s.add(Input(encounter_id=e.id, kind=kind, content=content))


if __name__ == "__main__":
    seed()
    print("Synthetic seed complete (idempotent).")
