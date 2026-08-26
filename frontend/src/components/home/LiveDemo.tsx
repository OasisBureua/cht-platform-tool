import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * The hero search. Exa's move: put the product in the hero and let it
 * run — except this one is not a mock. It is the real `/search` field,
 * lifted to the top of the page.
 *
 * The animation lives in the placeholder, not in a fabricated result
 * list: a rotating set of questions the library can actually answer,
 * typed a character at a time. Focus or a keystroke stops it for good,
 * so it never fights someone who is trying to type.
 *
 * The chips underneath run the same real search. Nothing here is a
 * picture of a feature.
 */

const PROMPTS = [
  'When does neratinib still earn its place?',
  'T-DXd in the neoadjuvant setting',
  'Sequencing after CDK4/6 progression',
  'ILD monitoring in practice',
];

const CHIPS = ['HER2-low', 'PARP maintenance', 'Step-up dosing', 'Perioperative'];

export function LiveDemo() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [ghost, setGhost] = useState('');
  const stopped = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGhost(PROMPTS[0]);
      return;
    }

    let run = 0;
    let ch = 0;
    let timer = 0;

    const step = () => {
      if (stopped.current) return;
      const q = PROMPTS[run];
      if (ch < q.length) {
        ch += 1;
        setGhost(q.slice(0, ch));
        timer = window.setTimeout(step, 38 + Math.random() * 44);
        return;
      }
      // Hold the finished question, then move to the next one.
      timer = window.setTimeout(() => {
        if (stopped.current) return;
        ch = 0;
        run = (run + 1) % PROMPTS.length;
        setGhost('');
        timer = window.setTimeout(step, 360);
      }, 2400);
    };
    timer = window.setTimeout(step, 500);

    return () => window.clearTimeout(timer);
  }, []);

  const stop = () => {
    stopped.current = true;
  };

  const search = (q: string) => {
    const term = q.trim();
    if (!term) return;
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="w-full max-w-[38rem]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(value);
        }}
        className="flex items-center gap-2 rounded-[8px] bg-ground p-2 shadow-card focus-within:shadow-card-hover"
      >
        <label htmlFor="hero-search" className="sr-only">
          Search the library
        </label>
        <input
          id="hero-search"
          type="search"
          value={value}
          onFocus={stop}
          onChange={(e) => {
            stop();
            setValue(e.target.value);
          }}
          // The ghost carries a caret so the typing reads as typing. Once
          // someone takes over, the placeholder falls back to a label.
          placeholder={stopped.current || value ? 'Search the library' : `${ghost}▍`}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-body-m text-text outline-none placeholder:text-muted2 [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="submit"
          className="press grid size-9 shrink-0 place-items-center rounded-[6px] bg-cta text-ground hover:bg-cta-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="sr-only">Search</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="size-4"
          >
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => search(c)}
            className="press inline-flex h-8 items-center rounded-[6px] bg-surface px-3 text-[0.8125rem] text-dim transition-[background-color,color] duration-150 hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
