import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreviewScreen from './PreviewScreen';
import { compose, lorebook } from '../../wailsjs/go/models';

const mockGetCharacters = vi.fn();
const mockGetActiveCharacter = vi.fn();
const mockSetActiveCharacter = vi.fn();
const mockGetPortrait = vi.fn();
const mockGetCardPreview = vi.fn();
const mockGetLorebook = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  GetActiveCharacter: () => mockGetActiveCharacter(),
  SetActiveCharacter: (id: number) => mockSetActiveCharacter(id),
  GetPortrait: (charID: number) => mockGetPortrait(charID),
  GetCardPreview: () => mockGetCardPreview(),
  GetLorebook: () => mockGetLorebook(),
}));

const elara = compose.Character.createFrom({
  id: 1, name: 'Elara', epithet: 'The Lark', tags: ['half-elf', 'bard'],
  appearance: 'Auburn hair, smoke-grey eyes.',
  personality: 'Cheerful with strangers, watchful with friends.',
  backstory: 'Born in Reithwin.',
  abilities: 'College of Lore.',
  relationships: 'Halsin — mentor.',
  quotes: ['Sit. I will pour.', 'A song is a contract.'],
  stats: [compose.StatKV.createFrom({ key: 'STR', value: '10' }), compose.StatKV.createFrom({ key: 'DEX', value: '16' })],
  altGreetings: [],
});

const bare = compose.Character.createFrom({
  id: 2, name: 'Tatsumi', epithet: '', tags: [],
  appearance: '', personality: '', backstory: '', abilities: '', relationships: '',
  quotes: [''], stats: [compose.StatKV.createFrom({ key: '', value: '' })],
  altGreetings: [],
});

const withGreetings = compose.Character.createFrom({
  id: 3, name: 'Karlach', epithet: '', tags: [],
  appearance: '', personality: '', backstory: '', abilities: '', relationships: '',
  quotes: ['You have the look of a man who pays for his secrets with his name.'],
  stats: [], altGreetings: ["Well met, stranger.", "Careful — I burn hot today."],
});

const renderScreen = () => render(<PreviewScreen />);

describe('PreviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([elara, bare]);
    mockGetActiveCharacter.mockResolvedValue(elara);
    mockSetActiveCharacter.mockResolvedValue(undefined);
    mockGetPortrait.mockResolvedValue([]);
    mockGetCardPreview.mockResolvedValue(compose.CardPreview.createFrom({
      tokens: { description: 0, personality: 0, scenario: 0, examples: 0, total: 0 },
    }));
    mockGetLorebook.mockResolvedValue([]);
  });

  it('renders the PageHead with step 6 and the active character name', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Preview Elara');
    });
    expect(screen.getByText('06')).toBeInTheDocument();
  });

  it('renders the character strip with both characters', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Characters · 2')).toBeInTheDocument();
      expect(screen.getByText('Tatsumi')).toBeInTheDocument();
    });
  });

  it('renders populated field sections', async () => {
    const { container } = renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Auburn hair, smoke-grey eyes.')).toBeInTheDocument();
    });
    const card = within(container.querySelector('.character-card')!);
    expect(card.getByText('Appearance')).toBeInTheDocument();
    expect(card.getByText('Personality')).toBeInTheDocument();
    expect(card.getByText('Backstory')).toBeInTheDocument();
    expect(card.getByText('Born in Reithwin.')).toBeInTheDocument();
    expect(card.getByText('Abilities & skills')).toBeInTheDocument();
    expect(card.getByText('Relationships')).toBeInTheDocument();
  });

  it('renders the first quote as a voice example blockquote', async () => {
    const { container } = renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Voice — example exchange')).toBeInTheDocument();
    });
    const card = within(container.querySelector('.character-card')!);
    expect(card.getByText('Sit. I will pour.')).toBeInTheDocument();
  });

  it('renders the stat block grid', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Stat block')).toBeInTheDocument();
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
    });
  });

  it('renders tags in the portrait overlay', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('half-elf')).toBeInTheDocument();
      expect(screen.getByText('bard')).toBeInTheDocument();
    });
  });

  it('omits empty field sections and the stat block for a bare character', async () => {
    mockGetActiveCharacter.mockResolvedValue(bare);
    const { container } = renderScreen();
    await waitFor(() => {
      expect(screen.getAllByText('Tatsumi').length).toBeGreaterThan(0);
    });
    const card = within(container.querySelector('.character-card')!);
    expect(card.queryByText('Appearance')).not.toBeInTheDocument();
    expect(card.queryByText('Voice — example exchange')).not.toBeInTheDocument();
    expect(card.queryByText('Stat block')).not.toBeInTheDocument();
  });

  it('switches the active character when a strip tab is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderScreen();
    await waitFor(() => expect(screen.getByText('Tatsumi')).toBeInTheDocument());

    await user.click(screen.getByText('Tatsumi'));
    expect(mockSetActiveCharacter).toHaveBeenCalledWith(2);
    await waitFor(() => {
      const card = within(container.querySelector('.character-card')!);
      expect(card.queryByText('Appearance')).not.toBeInTheDocument();
    });
  });

  it('renders the portrait image when GetPortrait returns bytes', async () => {
    mockGetPortrait.mockResolvedValue([0x89, 0x50, 0x4e, 0x47]);
    renderScreen();
    await waitFor(() => {
      const imgs = screen.getAllByRole('img');
      expect(imgs.length).toBeGreaterThan(0);
      for (const img of imgs) {
        expect(img).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));
      }
    });
  });

  it('shows an empty state when the project has no characters', async () => {
    mockGetCharacters.mockResolvedValue([]);
    mockGetActiveCharacter.mockResolvedValue(compose.Character.createFrom({}));
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/no characters yet/i)).toBeInTheDocument();
    });
  });

  it('renders a chat header with the active character name', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('New chat')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Elara').length).toBeGreaterThan(0);
  });

  it('renders quotes[0] as the greeting bubble with no swipe controls when there are no alt greetings', async () => {
    const { container } = renderScreen();
    await waitFor(() => {
      expect(container.querySelector('.chat-bubble')).toHaveTextContent('Sit. I will pour.');
    });
    expect(screen.queryByLabelText('Next greeting')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Previous greeting')).not.toBeInTheDocument();
  });

  it('shows an empty greeting state for a character with no quotes and no alt greetings', async () => {
    mockGetActiveCharacter.mockResolvedValue(bare);
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/no opening message/i)).toBeInTheDocument();
    });
  });

  it('swipes through alternate greetings and wraps around', async () => {
    const user = userEvent.setup();
    mockGetCharacters.mockResolvedValue([elara, withGreetings]);
    mockGetActiveCharacter.mockResolvedValue(withGreetings);
    const { container } = renderScreen();
    const bubble = () => container.querySelector('.chat-bubble');

    await waitFor(() => {
      expect(bubble()).toHaveTextContent('You have the look of a man who pays for his secrets with his name.');
    });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Next greeting'));
    expect(bubble()).toHaveTextContent('Well met, stranger.');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Next greeting'));
    expect(bubble()).toHaveTextContent('Careful — I burn hot today.');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    // wraps back to the first greeting
    await user.click(screen.getByLabelText('Next greeting'));
    expect(bubble()).toHaveTextContent('You have the look of a man who pays for his secrets with his name.');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // previous wraps to the last greeting
    await user.click(screen.getByLabelText('Previous greeting'));
    expect(bubble()).toHaveTextContent('Careful — I burn hot today.');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('resets the greeting swipe index when the active character changes', async () => {
    const user = userEvent.setup();
    mockGetCharacters.mockResolvedValue([withGreetings, elara]);
    mockGetActiveCharacter.mockResolvedValue(withGreetings);
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Next greeting'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await user.click(screen.getByText('Elara'));
    await waitFor(() => {
      expect(container.querySelector('.chat-bubble')).toHaveTextContent('Sit. I will pour.');
    });
    expect(screen.queryByText('2 / 3')).not.toBeInTheDocument();
  });

  it('renders the token budget panel with per-section counts and a formatted total', async () => {
    mockGetCardPreview.mockResolvedValue(compose.CardPreview.createFrom({
      tokens: { description: 412, personality: 186, scenario: 94, examples: 312, total: 1004 },
    }));
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Token budget')).toBeInTheDocument();
    });
    expect(screen.getByText('412')).toBeInTheDocument();
    expect(screen.getByText('186')).toBeInTheDocument();
    expect(screen.getByText('94')).toBeInTheDocument();
    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByText('1,004 / 2,048')).toBeInTheDocument();
  });

  it('renders linked lorebook entries scoped to the active character, including global entries', async () => {
    mockGetLorebook.mockResolvedValue([
      lorebook.Entry.createFrom({ uid: 1, comment: 'The Harpers', order: 100, characters: [] }),
      lorebook.Entry.createFrom({ uid: 2, comment: 'Songthorn (rapier)', order: 40, characters: ['1'] }),
      lorebook.Entry.createFrom({ uid: 3, comment: 'Unrelated', order: 10, characters: ['99'] }),
    ]);
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Linked lorebook')).toBeInTheDocument();
    });
    expect(screen.getByText('The Harpers')).toBeInTheDocument();
    expect(screen.getByText('Songthorn (rapier)')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated')).not.toBeInTheDocument();
    expect(screen.getByText('2 of 3 project entries are scoped to Elara.')).toBeInTheDocument();
  });

  it('shows an empty state in the linked lorebook panel when the project has no entries', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('No lorebook entries yet.')).toBeInTheDocument();
    });
  });

  it('renders the ready check panel showing complete items for a fully populated character', async () => {
    mockGetPortrait.mockResolvedValue([0x89, 0x50, 0x4e, 0x47]);
    renderScreen();
    await waitFor(() => {
      expect(screen.getByLabelText('Portrait: complete')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Name & tags: complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Personality: complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Appearance: complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Backstory: complete')).toBeInTheDocument();
    expect(screen.getByLabelText('First message / greeting: complete')).toBeInTheDocument();
  });

  it('renders the ready check panel showing incomplete items for a bare character', async () => {
    mockGetActiveCharacter.mockResolvedValue(bare);
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Ready check')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Name & tags: incomplete')).toBeInTheDocument();
    expect(screen.getByLabelText('Personality: incomplete')).toBeInTheDocument();
    expect(screen.getByLabelText('Appearance: incomplete')).toBeInTheDocument();
    expect(screen.getByLabelText('Backstory: incomplete')).toBeInTheDocument();
    expect(screen.getByLabelText('Portrait: incomplete')).toBeInTheDocument();
    expect(screen.getByLabelText('First message / greeting: incomplete')).toBeInTheDocument();
  });
});
