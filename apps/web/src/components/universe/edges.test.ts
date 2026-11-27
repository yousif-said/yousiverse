import { describe, expect, it } from "vitest";
import { type Box, edgePaths } from "./edges";

/** A title's place on the map: artwork 60 wide and 100 tall, with its name 30 below. */
function boxAt(left: number, top: number): Box {
  return { left, right: left + 60, top, x: left + 30, y: top + 50, bottom: top + 130 };
}

// Two lanes: books along the top, films under them.
const BOXES: Record<string, Box> = {
  novel: boxAt(100, 60),
  sequel: boxAt(300, 60),
  film: boxAt(500, 262),
  "part-two": boxAt(700, 262),
};
const boxOf = (mediaId: string) => BOXES[mediaId] ?? null;

describe("edgePaths", () => {
  it("joins titles in one lane side to side, whichever way the link reads", () => {
    const forward = edgePaths(
      [{ fromMediaId: "sequel", toMediaId: "novel", kind: "sequel_of" }],
      boxOf,
    );
    const backward = edgePaths(
      [{ fromMediaId: "novel", toMediaId: "sequel", kind: "sequel_of" }],
      boxOf,
    );

    expect(forward).toEqual([
      { key: "sequel-novel", className: undefined, d: "M166 110 L294 110" },
    ]);
    expect(backward[0]?.d).toBe("M166 110 L294 110");
  });

  it("drops a link between lanes from under the upper title to above the lower one", () => {
    const [edge] = edgePaths(
      [{ fromMediaId: "film", toMediaId: "novel", kind: "adaptation_of" }],
      boxOf,
    );

    // From the novel's name (190) plus the gap, to the film's artwork (262) less the gap.
    expect(edge).toEqual({
      key: "film-novel",
      className: "adapt",
      d: "M130 196 C130 226, 530 226, 530 256",
    });
  });

  it("turns each drop at its own height", () => {
    const edges = edgePaths(
      [
        { fromMediaId: "film", toMediaId: "novel", kind: "adaptation_of" },
        { fromMediaId: "part-two", toMediaId: "film", kind: "sequel_of" },
        { fromMediaId: "part-two", toMediaId: "sequel", kind: "adaptation_of" },
      ],
      boxOf,
    );

    expect(edges.map((edge) => edge.d)).toEqual([
      "M130 196 C130 216, 530 216, 530 256",
      "M566 312 L694 312",
      "M330 196 C330 236, 730 236, 730 256",
    ]);
  });

  it("draws a short line between two titles that share a cell, one above the other", () => {
    const stacked: Record<string, Box> = { ...BOXES, later: boxAt(100, 212) };

    const [edge] = edgePaths(
      [{ fromMediaId: "later", toMediaId: "novel", kind: "sequel_of" }],
      (mediaId) => stacked[mediaId] ?? null,
    );

    expect(edge?.d).toBe("M130 196 C130 201, 130 201, 130 206");
  });

  it("marks a link that only says two titles share a franchise", () => {
    const [edge] = edgePaths(
      [{ fromMediaId: "film", toMediaId: "part-two", kind: "same_franchise" }],
      boxOf,
    );

    expect(edge?.className).toBe("same");
  });

  it("draws nothing for a link to a title that is not on the map", () => {
    expect(
      edgePaths([{ fromMediaId: "game", toMediaId: "novel", kind: "same_franchise" }], boxOf),
    ).toEqual([]);
  });
});
