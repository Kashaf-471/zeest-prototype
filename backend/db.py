import os
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine,
    String,
    Integer,
    Text,
    ForeignKey,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

ROOT = Path(__file__).resolve().parent
DATA = Path(os.getenv("ZEEST_DATA_DIR", str(ROOT / "data"))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
URL = os.getenv("DATABASE_URL", "sqlite:///" + str(DATA / "zeest.db"))
engine = create_engine(
    URL,
    connect_args={"check_same_thread": False, "timeout": 30}
    if URL.startswith("sqlite")
    else {},
)
if URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def pragmas(c, r):
        c.execute("PRAGMA foreign_keys=ON")
        c.execute("PRAGMA journal_mode=WAL")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


def now():
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    pass


class Physician(Base):
    __tablename__ = "physicians"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password: Mapped[str] = mapped_column(Text)


class LoginSession(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    physician_id: Mapped[int] = mapped_column(ForeignKey("physicians.id"))
    csrf: Mapped[str] = mapped_column(String(64))
    expires: Mapped[str] = mapped_column(String(40))


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(primary_key=True)
    physician_id: Mapped[int] = mapped_column(ForeignKey("physicians.id"))
    name: Mapped[str] = mapped_column(String(100))
    info: Mapped[str] = mapped_column(Text)


class Encounter(Base):
    __tablename__ = "encounters"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    date: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(default=0)


class Input(Base):
    __tablename__ = "inputs"
    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    kind: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text)
    file: Mapped[str | None] = mapped_column(String(100), nullable=True)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created: Mapped[str] = mapped_column(default=now)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    input_id: Mapped[int] = mapped_column(ForeignKey("inputs.id"))
    stream: Mapped[str] = mapped_column(String(64))
    sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    transcript: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    elapsed: Mapped[int] = mapped_column(default=0)
    __table_args__ = (UniqueConstraint("encounter_id", "stream", "sequence"),)


class Draft(Base):
    __tablename__ = "drafts"
    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("drafts.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    diagnosis: Mapped[str] = mapped_column(Text)
    treatment: Mapped[str] = mapped_column(Text)
    snapshot: Mapped[str] = mapped_column(Text)
    scenario: Mapped[str] = mapped_column(String(40))
    evidence: Mapped[str] = mapped_column(Text)
    critic: Mapped[str] = mapped_column(Text)
    created: Mapped[str] = mapped_column(default=now)


class Decision(Base):
    __tablename__ = "decisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), unique=True)
    content: Mapped[str] = mapped_column(Text)
    created: Mapped[str] = mapped_column(default=now)


class Audit(Base):
    __tablename__ = "audit"
    id: Mapped[int] = mapped_column(primary_key=True)
    physician_id: Mapped[int] = mapped_column(ForeignKey("physicians.id"))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    action: Mapped[str] = mapped_column(String(50))
    revision_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[str] = mapped_column(Text, default="")
    created: Mapped[str] = mapped_column(default=now)


class Finding(Base):
    __tablename__ = "findings"
    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    input_id: Mapped[int] = mapped_column(ForeignKey("inputs.id"))
    scenario: Mapped[str] = mapped_column(String(40))
    content: Mapped[str] = mapped_column(Text)
    source_version: Mapped[int] = mapped_column(Integer)
    created: Mapped[str] = mapped_column(default=now)
