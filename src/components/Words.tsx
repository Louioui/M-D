import { Fragment } from 'react';

/** Keeps hyphenated compounds ("Rip-Offs", "Master-Level") on one line in display type. */
export default function Words({ text }: { text: string }) {
  const words = text.split(' ');
  return <>{words.map((word, i) => <Fragment key={i}>{word.includes('-') ? <span className="nowrap">{word}</span> : word}{i < words.length - 1 ? ' ' : ''}</Fragment>)}</>;
}
