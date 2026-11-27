import { Icon, type IconName } from "@/components/ui/icon";

type Props<Value extends string> = {
  /** The id of the text that says what is being chosen: "Who can see it". */
  labelledBy: string;
  options: { value: Value; label: string; icon?: IconName }[];
  value: Value;
  onChange: (value: Value) => void;
};

/** A choice of one from a few, all on show: who can see a list, who can join a club. */
export function Segmented<Value extends string>({
  labelledBy,
  options,
  value,
  onChange,
}: Props<Value>) {
  return (
    // A fieldset refuses to be narrower than its contents unless told it may be.
    <fieldset className="seg min-w-0" aria-labelledby={labelledBy}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <Icon name={option.icon} size="sm" />}
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
