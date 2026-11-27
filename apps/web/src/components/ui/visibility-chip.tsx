import { VISIBILITY, type Visibility } from "@/lib/visibility";
import { Icon } from "./icon";

/** Who can see something, as a small chip: "Friends", "Only you". */
export function VisibilityChip({ visibility }: { visibility: Visibility }) {
  const { label, icon } = VISIBILITY[visibility];
  return (
    <span className="chip">
      <Icon name={icon} size="sm" />
      {label}
    </span>
  );
}
