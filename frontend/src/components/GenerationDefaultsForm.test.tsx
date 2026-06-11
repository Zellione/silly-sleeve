import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationDefaultsForm } from './GenerationDefaultsForm';

describe('GenerationDefaultsForm', () => {
  it('renders the temperature, max-tokens and system-prompt controls', () => {
    render(<GenerationDefaultsForm />);
    expect(screen.getByText('Generation defaults')).toBeInTheDocument();
    expect(screen.getByText(/Temperature/)).toBeInTheDocument();
    expect(screen.getByText(/Max tokens/)).toBeInTheDocument();
    expect(screen.getByText(/System prompt template/)).toBeInTheDocument();
  });

  it('seeds the inputs with their defaults', () => {
    const { container } = render(<GenerationDefaultsForm />);
    expect(container.querySelector('input[type="number"]')).toHaveValue(320);
    expect(container.querySelector('textarea')?.value).toMatch(/SillyTavern character card/);
  });
});
