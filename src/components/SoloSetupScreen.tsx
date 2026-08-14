import { useState } from "react";
import type { AiDifficulty, ColorChoice } from "../ai/checkersAi";

type SoloSetupScreenProps = {
  onStart: (difficulty: AiDifficulty, colorChoice: ColorChoice) => void;
  onBack: () => void;
};

const difficulties: Array<{ value: AiDifficulty; label: string; description: string }> = [
  { value: "easy", label: "Fácil", description: "Mais aleatória, sempre legal." },
  { value: "medium", label: "Médio", description: "Busca capturas, promoção e segurança." },
  { value: "hard", label: "Difícil", description: "Usa busca com avaliação estratégica." }
];

const colors: Array<{ value: ColorChoice; label: string }> = [
  { value: "red", label: "Jogar com vermelhas" },
  { value: "black", label: "Jogar com pretas" },
  { value: "random", label: "Aleatório" }
];

export function SoloSetupScreen({ onStart, onBack }: SoloSetupScreenProps) {
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [colorChoice, setColorChoice] = useState<ColorChoice>("red");

  return (
    <main className="lobby setup-screen">
      <section className="brand-panel" aria-labelledby="solo-title">
        <p className="eyebrow">Contra a máquina</p>
        <h1 id="solo-title">Escolha a partida</h1>
        <p className="subtle">A máquina usa o mesmo motor de regras das partidas online.</p>
      </section>

      <section className="setup-panel" aria-label="Dificuldade">
        <h2>Dificuldade</h2>
        <div className="segmented-list">
          {difficulties.map((option) => (
            <button
              key={option.value}
              className={difficulty === option.value ? "selected-option" : ""}
              type="button"
              onClick={() => setDifficulty(option.value)}
            >
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="setup-panel" aria-label="Escolha da cor">
        <h2>Suas peças</h2>
        <div className="segmented-list compact-list">
          {colors.map((option) => (
            <button
              key={option.value}
              className={colorChoice === option.value ? "selected-option" : ""}
              type="button"
              onClick={() => setColorChoice(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="action-stack">
        <button className="primary-button" type="button" onClick={() => onStart(difficulty, colorChoice)}>
          Iniciar partida
        </button>
        <button className="ghost-button" type="button" onClick={onBack}>
          Voltar aos modos
        </button>
      </section>
    </main>
  );
}
