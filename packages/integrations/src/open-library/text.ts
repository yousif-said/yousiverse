const MAX_SUBJECTS = 6;

/**
 * Open Library descriptions are lightly formatted Markdown, often followed by source notes
 * and lists of other editions. Keeps the prose and drops the rest.
 */
export function plainDescription(description: string | undefined): string | null {
  if (!description) return null;
  const text = description
    .replace(/\r\n/g, "\n")
    // Everything after a rule or an "Also contained in" list is editorial, not description.
    .split(/\n-{4,}|\n\s*\**Also contained in/i)[0]
    ?.replace(/\(\[[^\]]*\]\[\d+\]\)/g, "")
    .replace(/\[([^\]]+)\](\[\d+\]|\([^)]*\))/g, "$1")
    .replace(/^\s*\[\d+\]:.*$/gm, "")
    .replace(/(\*\*|__|\*|_)(?=\S)(.+?)(?<=\S)\1/g, "$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/**
 * Subjects mix real topics with machine tags ("nyt:fiction=2020-10-04"), compound headings
 * ("Fiction, science fiction, general"), and repeats in different capitalization. Keeps the
 * first few plain topics.
 */
export function readableSubjects(subjects: string[]): string[] {
  const seen = new Set<string>();
  return subjects
    .filter((subject) => {
      const key = subject.toLowerCase();
      if (/[:=,]/.test(subject) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SUBJECTS);
}
