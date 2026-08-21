import type { BoardThemeId } from "./boardThemes";
import { BOARD_THEMES } from "./boardThemes";

type BoardThemeTesterProps = {
  selected: BoardThemeId;
  onChange: (themeId: BoardThemeId) => void;
};

export function BoardThemeTester({ selected, onChange }: BoardThemeTesterProps) {
  if (!import.meta.env.DEV) return null;

  return (
    <label className="board-theme-tester">
      <span>Tabuleiro teste</span>
      <select value={selected} onChange={(event) => onChange(event.target.value as BoardThemeId)}>
        {BOARD_THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.label}
          </option>
        ))}
      </select>
    </label>
  );
}
