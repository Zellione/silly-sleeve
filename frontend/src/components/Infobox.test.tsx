import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Infobox } from './Infobox';
import { crawler } from '../../wailsjs/go/models';

const entry = (key: string, value: string, section?: string) =>
  crawler.InfoboxEntry.createFrom({ key, value, section });

const sectionHeadings = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.infobox-section')).map(el => el.textContent);

describe('Infobox', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders each entry as a term and definition', () => {
    render(<Infobox entries={[entry('Race', 'Half-elf'), entry('Class', 'Bard')]} />);

    expect(screen.getByText('Race')).toBeInTheDocument();
    expect(screen.getByText('Half-elf')).toBeInTheDocument();
    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByText('Bard')).toBeInTheDocument();
  });

  it('opens a heading at each new section and not within one', () => {
    const { container } = render(
      <Infobox
        entries={[
          entry('Race', 'Half-elf', 'Biography'),
          entry('Age', '31', 'Biography'),
          entry('Weapon', 'Songthorn', 'Combat'),
        ]}
      />
    );

    expect(sectionHeadings(container)).toEqual(['Biography', 'Combat']);
  });

  it('reopens a section heading when the section recurs later', () => {
    const { container } = render(
      <Infobox
        entries={[
          entry('Race', 'Half-elf', 'Biography'),
          entry('Weapon', 'Songthorn', 'Combat'),
          entry('Age', '31', 'Biography'),
        ]}
      />
    );

    expect(sectionHeadings(container)).toEqual(['Biography', 'Combat', 'Biography']);
  });

  it('renders no heading for entries that carry no section', () => {
    const { container } = render(<Infobox entries={[entry('Race', 'Half-elf')]} />);

    expect(sectionHeadings(container)).toEqual([]);
  });

  it('keeps line breaks inside a value as text rather than markup', () => {
    render(<Infobox entries={[entry('Aliases', 'The Lark\nWynd')]} />);

    // Rendered as one text node — style.css sets white-space: pre-wrap, so the
    // break survives without the markup splitting the string on <br>.
    const dd = screen.getByText((_, el) => el?.tagName === 'DD' && el.textContent === 'The Lark\nWynd');
    expect(dd.querySelector('br')).toBeNull();
  });

  it('does not emit duplicate React keys when a label repeats in one section', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <Infobox
        entries={[
          entry('Alias', 'The Lark', 'Names'),
          entry('Alias', 'Wynd', 'Names'),
          entry('Alias', 'Crimson', 'Names'),
        ]}
      />
    );

    expect(warn).not.toHaveBeenCalled();
    expect(screen.getAllByText('Alias')).toHaveLength(3);
  });

  it('distinguishes the same label used under different sections', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <Infobox
        entries={[
          entry('Name', 'Elara', 'Biography'),
          entry('Name', 'Songthorn', 'Combat'),
        ]}
      />
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('applies the style passed by the caller', () => {
    const { container } = render(<Infobox entries={[entry('Race', 'Half-elf')]} style={{ marginTop: 16 }} />);

    expect(container.querySelector('dl')).toHaveStyle({ marginTop: '16px' });
  });

  it('renders an empty list without crashing', () => {
    const { container } = render(<Infobox entries={[]} />);

    expect(container.querySelectorAll('dt')).toHaveLength(0);
  });
});
