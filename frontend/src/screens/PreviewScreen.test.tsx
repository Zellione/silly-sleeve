import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreviewScreen from './PreviewScreen';
import { compose } from '../../wailsjs/go/models';

const mockGetCharacters = vi.fn();
const mockGetActiveCharacter = vi.fn();
const mockSetActiveCharacter = vi.fn();
const mockGetPortrait = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  GetActiveCharacter: () => mockGetActiveCharacter(),
  SetActiveCharacter: (id: number) => mockSetActiveCharacter(id),
  GetPortrait: (charID: number) => mockGetPortrait(charID),
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
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Auburn hair, smoke-grey eyes.')).toBeInTheDocument();
      expect(screen.getByText('Personality')).toBeInTheDocument();
      expect(screen.getByText('Backstory')).toBeInTheDocument();
      expect(screen.getByText('Born in Reithwin.')).toBeInTheDocument();
      expect(screen.getByText('Abilities & skills')).toBeInTheDocument();
      expect(screen.getByText('Relationships')).toBeInTheDocument();
    });
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
    renderScreen();
    await waitFor(() => {
      expect(screen.getAllByText('Tatsumi').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
    expect(screen.queryByText('Voice — example exchange')).not.toBeInTheDocument();
    expect(screen.queryByText('Stat block')).not.toBeInTheDocument();
  });

  it('switches the active character when a strip tab is clicked', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Tatsumi')).toBeInTheDocument());

    await user.click(screen.getByText('Tatsumi'));
    expect(mockSetActiveCharacter).toHaveBeenCalledWith(2);
    await waitFor(() => expect(screen.queryByText('Appearance')).not.toBeInTheDocument());
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
});
