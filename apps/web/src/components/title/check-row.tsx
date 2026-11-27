import { Icon } from "@/components/ui/icon";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  name: string;
  /** The line under the name: how many titles, who can see it. */
  sub: React.ReactNode;
};

/** One choice in a dialog that is ticked or not: a list that holds the title, a club that picked it. */
export function CheckRow({ checked, onChange, name, sub }: Props) {
  return (
    <li>
      {/* biome-ignore lint/a11y/useSemanticElements: the whole row is the control, drawn with the design's own tick. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        className="row"
        style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}
        onClick={() => onChange(!checked)}
      >
        <span className="tick">
          <Icon name="check" />
        </span>
        <span>
          <span className="row__title block">{name}</span>
          <span className="row__sub">{sub}</span>
        </span>
      </button>
    </li>
  );
}
