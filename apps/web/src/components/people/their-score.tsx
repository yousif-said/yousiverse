import { Meter, Score } from "@/components/media/score";
import { formatRating } from "@/lib/format";

type Props = {
  /** Quarter points, 0 to 40. Nothing is drawn for a title they have not rated. */
  value: number | null;
  /** Whose rating it is. */
  username: string;
  /** True on the signed-in person's own profile, where the rating is theirs. */
  mine: boolean;
};

/**
 * The rating a profile's owner gave a title. It is drawn at full strength like the viewer's
 * own score, because on a profile it is the rating that matters, but it is never called yours
 * unless it is.
 */
export function TheirScore({ value, username, mine }: Props) {
  if (mine) return <Score value={value} />;
  if (value === null) return null;
  return (
    <span className="score score--mine" title={`@${username}'s rating`}>
      <Meter value={(value / 40) * 100} />
      <span className="sr-only">Rated </span>
      {formatRating(value)}
    </span>
  );
}
