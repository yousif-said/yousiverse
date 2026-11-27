import { dayOf } from "../../lib/days";

/**
 * Puts things that happened, newest first, under the US calendar day each happened on. The day
 * is the US one because that is the day the page calls "Today".
 */
export function byDay<Item extends { at: string | Date }>(
  items: Item[],
): { day: string; items: Item[] }[] {
  const days: { day: string; items: Item[] }[] = [];
  for (const item of items) {
    const day = dayOf(new Date(item.at));
    const latest = days.at(-1);
    if (latest?.day === day) latest.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}
