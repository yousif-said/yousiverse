import { PROFILE_FIELDS, type ProfileSource } from "@/lib/imports";
import { Segmented } from "./segmented";

const PLAYED_CHOICES = [
  { value: "in_progress", label: "Playing" },
  { value: "finished", label: "Finished" },
  { value: "dropped", label: "Dropped" },
] as const;
export type PlayedStatus = (typeof PLAYED_CHOICES)[number]["value"];

type Props = {
  source: ProfileSource;
  playedStatus: PlayedStatus;
  onPlayedStatus: (status: PlayedStatus) => void;
};

/**
 * Step two for a service read from a public profile: whose profile it is. Steam cannot tell a
 * finished game from an abandoned one, so it also asks what a played game should count as.
 */
export function ProfileStep({ source, playedStatus, onPlayedStatus }: Props) {
  const { label, placeholder, hint } = PROFILE_FIELDS[source];

  return (
    <div>
      <h3>Enter your {label}</h3>
      <label className="sr-only" htmlFor="import-profile">
        {label}
      </label>
      <input
        // A Steam address is not a Trakt username: each service starts empty.
        key={source}
        id="import-profile"
        name="profile"
        className="input"
        required
        minLength={source === "steam" ? 2 : undefined}
        maxLength={200}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={placeholder}
        aria-describedby={hint ? "import-profile-hint" : undefined}
      />
      {hint && (
        <p className="hint mt-2" id="import-profile-hint">
          {hint}
        </p>
      )}
      {source === "steam" && (
        <div className="mt-5">
          <p className="flabel mb-2">Games you have played go in as</p>
          <Segmented
            label="Games you have played go in as"
            choices={PLAYED_CHOICES}
            value={playedStatus}
            onChange={onPlayedStatus}
          />
          <p className="hint mt-2">
            Steam knows how long you played a game but not whether you finished it, so every played
            game gets the same status. You can correct the exceptions afterwards.
          </p>
        </div>
      )}
    </div>
  );
}
