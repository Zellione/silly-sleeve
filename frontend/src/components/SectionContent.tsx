import React from 'react';
import { crawler } from '../../wailsjs/go/models';

const SECTION_TAGS: Record<number, string> = { 1: 'lede', 2: 'section', 3: 'subsection' };

export const SectionContent: React.FC<{ sections: crawler.Section[] }> = ({ sections }) => (
  <>
    {sections.map((s, i) => (
      <React.Fragment key={`${s.heading || 'section'}-${i}`}>
        {s.heading && <h4>{s.heading}</h4>}
        {s.body?.split('\n\n')?.map((para, j) => (
          <p key={`${para.slice(0, 30)}-${j}`}>
            {j === 0 && SECTION_TAGS[s.level] && <span className="section-tag">{SECTION_TAGS[s.level]}</span>}
            {para}
          </p>
        ))}
      </React.Fragment>
    ))}
  </>
);
