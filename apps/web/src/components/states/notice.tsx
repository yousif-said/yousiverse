type Props = {
  title: string;
  /** What happened, in a sentence or two. */
  text: string;
  /** The way out: a link home, a button to try again. */
  children: React.ReactNode;
};

/** A page with nothing to show that says why and what to do next: not found, or not loaded. */
export function Notice({ title, text, children }: Props) {
  return (
    <div className="page page--narrow">
      <div className="empty" style={{ marginTop: 80 }}>
        <h1 className="d2">{title}</h1>
        <p style={{ marginTop: 12 }}>{text}</p>
        {children}
      </div>
    </div>
  );
}

/** What to say when a page failed to load. The cause is logged, never shown. */
export const NOT_LOADED = {
  title: "That did not load.",
  text: "Something went wrong on our side while getting this page. Nothing you saved is affected. Try again, and if it keeps happening, come back in a little while.",
};
