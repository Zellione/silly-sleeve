import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsScreen from './SettingsScreen';
import { ToastProvider } from '../components/ToastProvider';
import { settings, prompts, llm } from '../../wailsjs/go/models';

const mockGetSettings = vi.fn();
const mockSaveSettings = vi.fn();
const mockTestLLMEndpoint = vi.fn();
const mockGetPromptTemplates = vi.fn();
const mockSavePromptTemplates = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetSettings: () => mockGetSettings(),
  SaveSettings: (...args: any[]) => mockSaveSettings(...args),
  TestLLMEndpoint: (...args: any[]) => mockTestLLMEndpoint(...args),
  GetPromptTemplates: () => mockGetPromptTemplates(),
  SavePromptTemplates: (...args: any[]) => mockSavePromptTemplates(...args),
}));

const createEndpoint = (overrides: Partial<settings.LLMEndpoint> = {}) =>
  new settings.LLMEndpoint({
    id: 1, name: 'TestEP', url: 'https://test.com/v1', model: 'gpt-4',
    key: undefined, isDefault: true, contextSize: 8192, temperature: 0.8,
    systemPrompt: 'You are helpful.', ok: true,
    ...overrides,
  });

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading shimmer when settings not loaded', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithProviders(<SettingsScreen />);
    expect(container.querySelector('.shimmer')).toBeTruthy();
  });

  it('renders endpoint cards after settings load', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ name: 'MyEP', model: 'gpt-4' })],
    }));

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('MyEP')).toBeInTheDocument();
    });
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('renders section nav items', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('LLM endpoints').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('ComfyUI')).toBeInTheDocument();
    expect(screen.getByText('Prompts')).toBeInTheDocument();
  });

  it('renders "Add endpoint" button', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Add endpoint')).toBeInTheDocument();
    });
  });

  it('opens flyout in new endpoint mode on "Add endpoint" click', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Add endpoint')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add endpoint'));

    expect(screen.getByText('New endpoint')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('opens flyout in edit mode on "Edit" click', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ name: 'EditMe' })],
    }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('EditMe')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit endpoint')).toBeInTheDocument();
    });
  });

  it('closes flyout on backdrop click', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint()],
    }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit endpoint')).toBeInTheDocument();
    });

    const backdrop = document.querySelector('.ep-flyout-bg') as HTMLElement;
    await user.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByText('Edit endpoint')).not.toBeInTheDocument();
    });
  });

  it('closes flyout on close button click', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint()],
    }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit endpoint')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByTitle('Close');
    await user.click(closeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Edit endpoint')).not.toBeInTheDocument();
    });
  });

  it('creates a new endpoint on save', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    mockSaveSettings.mockResolvedValue(undefined);

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Add endpoint')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add endpoint'));

    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    });
  });

  it('updates an existing endpoint on save', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ id: 1, name: 'OldName' })],
    }));
    mockSaveSettings.mockResolvedValue(undefined);

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    });
  });

  it('toggles auth in flyout', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ key: undefined })],
    }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit endpoint')).toBeInTheDocument();
    });

    const authSwitch = screen.getByRole('switch');
    expect(authSwitch.getAttribute('data-on')).toBe('0');

    await user.click(authSwitch);
    expect(authSwitch.getAttribute('data-on')).toBe('1');
  });

  it('tests endpoint from flyout', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ name: 'FlyoutTest' })],
    }));
    mockTestLLMEndpoint.mockResolvedValue(new llm.TestResult({ ok: true, latency_ms: 42 }));

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit endpoint')).toBeInTheDocument();
    });

    // In the flyout, there's a "Test" button at the URL field
    const flyoutTestButton = document.querySelector('.ep-test-btn') as HTMLElement;
    await user.click(flyoutTestButton);

    await waitFor(() => {
      expect(mockTestLLMEndpoint).toHaveBeenCalled();
    });
  });

  it('tests endpoint from card', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ name: 'CardTest', isDefault: false })],
    }));
    mockTestLLMEndpoint.mockResolvedValue(new llm.TestResult({ ok: true, latency_ms: 10 }));

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('CardTest')).toBeInTheDocument();
    });

    // Find the card's "Test" button (not the flyout one, but flyout isn't open)
    const testButtons = screen.getAllByText('Test');
    // Should only be one since no flyout is open
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(mockTestLLMEndpoint).toHaveBeenCalled();
    });
  });

  it('deletes an endpoint and promotes first to default', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [
        createEndpoint({ id: 1, name: 'WillDelete', isDefault: true }),
        createEndpoint({ id: 2, name: 'Stays', isDefault: false }),
      ],
    }));
    mockSaveSettings.mockResolvedValue(undefined);

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('WillDelete')).toBeInTheDocument();
    });

    const epCard = screen.getByText('WillDelete').closest('.endpoint-card')!;
    const moreButton = epCard.querySelector('.ep-more-wrap button') as HTMLElement;
    await user.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Delete endpoint')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete endpoint'));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalled();
    });
  });

  it('duplicates an endpoint', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ id: 1, name: 'Original' })],
    }));
    mockSaveSettings.mockResolvedValue(undefined);

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Original')).toBeInTheDocument();
    });

    const epCard = screen.getByText('Original').closest('.endpoint-card')!;
    const moreButton = epCard.querySelector('.ep-more-wrap button') as HTMLElement;
    await user.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Duplicate'));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalled();
    });
  });

  it('sets an endpoint as default', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [
        createEndpoint({ id: 1, name: 'NotDefault', isDefault: false }),
      ],
    }));
    mockSaveSettings.mockResolvedValue(undefined);

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('NotDefault')).toBeInTheDocument();
    });

    const epCard = screen.getByText('NotDefault').closest('.endpoint-card')!;
    const moreButton = epCard.querySelector('.ep-more-wrap button') as HTMLElement;
    await user.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Set as default')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Set as default'));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalled();
    });
  });

  it('closes more menu on Escape', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint({ id: 1, name: 'EscTest' })],
    }));

    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('EscTest')).toBeInTheDocument();
    });

    const epCard = screen.getByText('EscTest').closest('.endpoint-card')!;
    const moreButton = epCard.querySelector('.ep-more-wrap button') as HTMLElement;
    await user.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Delete endpoint')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByText('Delete endpoint')).not.toBeInTheDocument();
    });
  });

  it('renders context size presets in flyout', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [createEndpoint()],
    }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit endpoint')).toBeInTheDocument();
    });

    expect(screen.getByText('4.1k')).toBeInTheDocument();
    expect(screen.getByText('8.2k')).toBeInTheDocument();
    expect(screen.getByText('16k')).toBeInTheDocument();
    expect(screen.getByText('33k')).toBeInTheDocument();
    expect(screen.getByText('128k')).toBeInTheDocument();
    expect(screen.getByText('200k')).toBeInTheDocument();
  });

  it('switches between settings sections', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    mockGetPromptTemplates.mockResolvedValue(prompts.TemplateSet.createFrom({
      systemPrompt: 'test prompt',
      fieldPrompts: { name: 'name prompt', epithet: 'ep prompt', tags: 'tag prompt', appearance: 'app prompt', personality: 'pers prompt', backstory: 'back prompt', abilities: 'abi prompt', relationships: 'rel prompt', quotes: 'quo prompt', stats: 'stat prompt' },
    }));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      const labels = screen.getAllByText('LLM endpoints');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    // The prompts section should now render the prompt editor, not "Coming in a later phase"
    await user.click(screen.getByText('Prompts'));

    await waitFor(() => {
      expect(screen.getByText('Prompt templates')).toBeInTheDocument();
    });
  });

  describe('prompt template editor', () => {
    const defaultPT = prompts.TemplateSet.createFrom({
      systemPrompt: 'system prompt default',
      fieldPrompts: {
        name: 'name template content',
        epithet: 'epithet template content',
        tags: 'tags template content',
        appearance: 'appearance template content',
        personality: 'personality template content',
        backstory: 'backstory template content',
        abilities: 'abilities template content',
        relationships: 'relationships template content',
        quotes: 'quotes template content',
        stats: 'stats template content',
      },
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('loads and displays prompt templates', async () => {
      mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
      mockGetPromptTemplates.mockResolvedValue(defaultPT);
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Add endpoint')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Prompts'));

      await waitFor(() => {
        expect(screen.getByText('system prompt default')).toBeInTheDocument();
      });
    });

    it('switches between bulk and per-field templates', async () => {
      mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
      mockGetPromptTemplates.mockResolvedValue(defaultPT);
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Add endpoint')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Prompts'));

      await waitFor(() => {
        expect(screen.getByText('system prompt default')).toBeInTheDocument();
      });

      // Switch to Name field
      await user.click(screen.getByText('Name'));
      await waitFor(() => {
        expect(screen.getByText('name template content')).toBeInTheDocument();
      });
    });

    it('inserts variable chip into textarea', async () => {
      mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
      mockGetPromptTemplates.mockResolvedValue(defaultPT);
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Add endpoint')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Prompts'));

      await waitFor(() => {
        expect(screen.getByText('system prompt default')).toBeInTheDocument();
      });

      const chip = screen.getByText('{{crawl.title}}');
      await user.click(chip);

      const textarea = screen.getByRole('textbox');
      expect((textarea as HTMLTextAreaElement).value).toContain('{{crawl.title}}');
    });

    it('saves prompt template changes', async () => {
      mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
      mockGetPromptTemplates.mockResolvedValue(defaultPT);
      mockSavePromptTemplates.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Add endpoint')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Prompts'));

      await waitFor(() => {
        expect(screen.getByText('system prompt default')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'updated prompt');

      await user.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockSavePromptTemplates).toHaveBeenCalled();
      });
    });

    it('handles prompt template load error', async () => {
      mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
      mockGetPromptTemplates.mockRejectedValue(new Error('load fail'));
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Add endpoint')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Prompts'));

      // Should still render the section title (from default state or shimmer)
      await waitFor(() => {
        expect(screen.getByText('Prompt templates')).toBeInTheDocument();
      });
    });
  });

  it('falls back to empty settings on error', async () => {
    mockGetSettings.mockRejectedValue(new Error('fail'));
    renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Add endpoint')).toBeInTheDocument();
    });
  });
});
