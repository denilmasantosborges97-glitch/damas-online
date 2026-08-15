import { FormEvent, useState } from "react";
import { validateNickname } from "../playerIdentity/identity";

type NicknameFormProps = {
  initialNickname?: string;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: (nickname: string) => boolean;
  onCancel?: () => void;
};

export function NicknameForm({
  initialNickname = "",
  title,
  description,
  submitLabel,
  onSubmit,
  onCancel
}: NicknameFormProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateNickname(nickname);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    if (!onSubmit(validation.nickname)) {
      setError("Não foi possível salvar o apelido agora.");
    }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      <h1>{title}</h1>
      {description && <p className="subtle">{description}</p>}

      <label htmlFor="player-nickname">Seu apelido</label>
      <input
        id="player-nickname"
        autoComplete="nickname"
        maxLength={24}
        placeholder="Seu apelido"
        value={nickname}
        onChange={(event) => {
          setNickname(event.target.value);
          setError(null);
        }}
      />
      {error && <p className="error-message inline-error">{error}</p>}

      <div className="profile-actions">
        <button className="primary-button" type="submit">
          {submitLabel}
        </button>
        {onCancel && (
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
