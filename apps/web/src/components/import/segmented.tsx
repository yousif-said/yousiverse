import { Icon, type IconName } from "@/components/ui/icon";

type Choice<Value extends string> = { value: Value; label: string; icon?: IconName };

type Props<Value extends string> = {
  /** Names the group for screen readers: "Who can see what is imported". */
  label: string;
  choices: readonly Choice<Value>[];
  value: Value;
  onChange: (value: Value) => void;
};

/** One choice among a few, all in view: a row of buttons with the chosen one pressed. */
export function Segmented<Value extends string>({ label, choices, value, onChange }: Props<Value>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend, and the step's heading already is one.
    <div className="seg" role="group" aria-label={label}>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={value === choice.value}
          onClick={() => onChange(choice.value)}
        >
          {choice.icon && <Icon name={choice.icon} size="sm" />}
          {choice.label}
        </button>
      ))}
    </div>
  );
}
