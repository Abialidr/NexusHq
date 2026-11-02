import { Fragment } from "react";

// Renders each word in its own span so CSS (.motion .hw) can bring a headline in word by word.
// Lines are separate strings joined with <br>.
export default function WordReveal({ lines }: { lines: string[] }) {
  let w = 0;
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(" ").map((word, wi) => (
            <Fragment key={wi}>
              {wi > 0 && " "}
              <span className="hw" style={{ "--w": w++ } as React.CSSProperties}>{word}</span>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  );
}
