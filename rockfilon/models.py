"""Schéma Postgres. Les réponses acceptées ne sortent jamais de la base vers le client."""

import datetime as dt
import os
import uuid

from sqlalchemy import ARRAY, DateTime, ForeignKey, Index, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://rockfilon:rockfilon@127.0.0.1:5432/rockfilon")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    type_annotation_map = {dt.datetime: DateTime(timezone=True)}


class Question(Base):
    __tablename__ = "question"
    id: Mapped[str] = mapped_column(primary_key=True)
    prompt: Mapped[str]
    categorie: Mapped[str]
    built_at: Mapped[dt.datetime]  # change à chaque `rockfilon load` : invalide le cache de l'API


class Answer(Base):
    __tablename__ = "answer"
    __table_args__ = (UniqueConstraint("question_id", "display"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("question.id", ondelete="CASCADE"), index=True)
    display: Mapped[str]
    tier: Mapped[int]  # palier a priori, 6 = pépite
    forms: Mapped[list[str]] = mapped_column(ARRAY(Text))
    exact: Mapped[list[str]] = mapped_column(ARRAY(Text))  # formes sans tolérance aux fautes


class Daily(Base):
    __tablename__ = "daily"
    date: Mapped[dt.date] = mapped_column(primary_key=True)
    question_ids: Mapped[list[str]] = mapped_column(ARRAY(Text))
    recycled: Mapped[bool] = mapped_column(default=False)


class Attempt(Base):
    """Une ligne par (joueur, jour, question) : la clé primaire interdit une seconde réponse."""

    __tablename__ = "attempt"
    __table_args__ = (Index("ix_attempt_day", "date", "idx", "answer_id"),)  # parts des joueurs du jour
    player_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(ForeignKey("daily.date"), primary_key=True)
    idx: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[dt.datetime]
    answered_at: Mapped[dt.datetime | None]
    raw: Mapped[str | None]
    answer_id: Mapped[int | None] = mapped_column(ForeignKey("answer.id", ondelete="SET NULL"), index=True)
    tier: Mapped[int | None]  # figé au moment de la réponse
    points: Mapped[int] = mapped_column(default=0)
