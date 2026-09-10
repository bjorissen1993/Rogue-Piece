import { useState } from "react";
import type { RunState } from "../models/types";
import { relativeDayLabel } from "../utils/presentation";
import { HudArt, HudIcon, newsArtSrc, newsGlyphName } from "./HudIcons";
import { OverlayFrame } from "./OverlayFrame";

type WorldNewsStripProps = {
  run: RunState;
};

function NewsMark({ size, text }: { size: number; text: string }) {
  const art = newsArtSrc(text);
  return art ? <HudArt size={size} src={art} /> : <HudIcon name={newsGlyphName(text)} size={size} />;
}

export function WorldNewsStrip({ run }: WorldNewsStripProps) {
  const [open, setOpen] = useState(false);
  const history = [...run.world.history].reverse();
  const events = history.slice(0, 3);

  return (
    <>
      <footer className="news-strip">
        <p className="hud-kicker">World News</p>
        <ul className="news-list">
          {events.length === 0 ? (
            <li className="text-parchment-dim">The sea has not written anything yet.</li>
          ) : (
            events.map((event, index) => (
              <li className={index === 0 ? "news-newest" : ""} key={event.id}>
                <span className="news-icon">
                  <NewsMark size={16} text={event.text} />
                </span>
                <span className="news-text">{event.text}</span>
                <time className="news-when">{relativeDayLabel(event.day, run.day)}</time>
              </li>
            ))
          )}
        </ul>
        <button className="news-all" onClick={() => setOpen(true)} type="button">
          View All News
          <span aria-hidden="true">›</span>
        </button>
      </footer>
      {open ? (
        <OverlayFrame eyebrow="TIDINGS" onClose={() => setOpen(false)} title="World News">
          <div className="overlay-scroll news-archive">
            {history.length === 0 ? (
              <p className="text-parchment-dim">The sea has not written anything yet.</p>
            ) : (
              <ul>
                {history.map((event) => (
                  <li key={event.id}>
                    <NewsMark size={18} text={event.text} />
                    <div>
                      <p>{event.text}</p>
                      <time>{relativeDayLabel(event.day, run.day)}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </OverlayFrame>
      ) : null}
    </>
  );
}
