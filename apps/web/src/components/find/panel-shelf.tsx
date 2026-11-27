/** A shelf inside a panel: it runs to the panel's edges and does not fade out at its ends. */
export function PanelShelf({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shelf"
      style={{
        margin: "0 -26px",
        padding: "6px 26px",
        WebkitMaskImage: "none",
        maskImage: "none",
      }}
    >
      {children}
    </div>
  );
}
