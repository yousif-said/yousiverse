import { useId } from "react";
import { VISIBILITIES, VISIBILITY_LABELS, type Visibility } from "@/lib/visibility";

type Props = {
  /** Says what the choice applies to: "Who can see this list". */
  label: string;
  /** The form field name, for a select read through `FormData`. */
  name?: string;
  defaultValue?: Visibility;
  value?: Visibility;
  onChange?: (visibility: Visibility) => void;
};

/** Chooses who can see something: everyone, friends only, or only its owner. */
export function VisibilitySelect({ label, name, defaultValue, value, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange && ((event) => onChange(event.target.value as Visibility))}
        className="h-9 rounded-md border border-input bg-card px-2.5 font-medium outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {VISIBILITIES.map((visibility) => (
          <option key={visibility} value={visibility}>
            {VISIBILITY_LABELS[visibility]}
          </option>
        ))}
      </select>
    </div>
  );
}
