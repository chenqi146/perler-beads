import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeadCraftSettings } from './BeadCraftSettings';

describe('BeadCraftSettings', () => {
  afterEach(() => cleanup());
  it('calls onGridIntervalChange when interval button clicked', async () => {
    const user = userEvent.setup();
    const onGridIntervalChange = vi.fn();

    render(
      <BeadCraftSettings
        gridInterval={10}
        onGridIntervalChange={onGridIntervalChange}
        highlightFadePercent={84}
        onHighlightFadeChange={vi.fn()}
        showCellKeys
        onShowCellKeysChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '15' }));
    expect(onGridIntervalChange).toHaveBeenCalledWith(15);
  });

  it('toggles showCellKeys checkbox', async () => {
    const user = userEvent.setup();
    const onShowCellKeysChange = vi.fn();

    render(
      <BeadCraftSettings
        gridInterval={10}
        onGridIntervalChange={vi.fn()}
        highlightFadePercent={84}
        onHighlightFadeChange={vi.fn()}
        showCellKeys={false}
        onShowCellKeysChange={onShowCellKeysChange}
      />,
    );

    await user.click(screen.getByLabelText('显示色号编码'));
    expect(onShowCellKeysChange).toHaveBeenCalledWith(true);
  });
});
