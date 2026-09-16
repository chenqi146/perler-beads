import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BeadColorStrip } from './BeadColorStrip';

const colors = ['#FF0000', '#00FF00'];

describe('BeadColorStrip', () => {
  it('renders color keys and highlights on click', async () => {
    const user = userEvent.setup();
    const onToggleHighlight = vi.fn();

    render(
      <BeadColorStrip
        sortedColors={colors}
        colorCounts={{
          '#FF0000': { count: 10, color: '#FF0000' },
          '#00FF00': { count: 5, color: '#00FF00' },
        }}
        colorSystem="MARD"
        highlightHex={null}
        completedSet={new Set()}
        cellProgress={{
          '#FF0000': { done: 2, total: 10 },
          '#00FF00': { done: 0, total: 5 },
        }}
        justCompleted={null}
        onToggleHighlight={onToggleHighlight}
        onToggleComplete={vi.fn()}
      />,
    );

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);

    await user.click(options[0]!);
    expect(onToggleHighlight).toHaveBeenCalledWith('#FF0000');
  });
});
