import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorColorStrip } from './EditorColorStrip';

describe('EditorColorStrip', () => {
  afterEach(() => cleanup());

  it('selects color on click', async () => {
    const user = userEvent.setup();
    const onSelectColor = vi.fn();

    render(
      <EditorColorStrip
        sortedColors={['#FF0000', '#00FF00']}
        colorCounts={{
          '#FF0000': { count: 12, color: '#FF0000' },
          '#00FF00': { count: 3, color: '#00FF00' },
        }}
        colorSystem="MARD"
        highlightHex={null}
        onSelectColor={onSelectColor}
      />,
    );

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    await user.click(options[0]!);
    expect(onSelectColor).toHaveBeenCalledWith('#FF0000');
  });

  it('keeps compact chip layout for touch targets', () => {
    render(
      <EditorColorStrip
        sortedColors={['#FF0000']}
        colorCounts={{ '#FF0000': { count: 12, color: '#FF0000' } }}
        colorSystem="MARD"
        highlightHex="#FF0000"
        onSelectColor={vi.fn()}
      />,
    );
    const option = screen.getByRole('option');
    expect(option.className).toContain('h-9');
    expect(option.className).toContain('rounded-lg');
  });
});
