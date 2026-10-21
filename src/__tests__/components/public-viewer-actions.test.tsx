import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublicViewerActions } from '../../../components/admin/public-viewer-actions';

describe('PublicViewerActions', () => {
  it('publicado: el widget TV abre el directo y «Visor público» abre el modal de compartir', () => {
    const onShare = vi.fn();
    render(<PublicViewerActions tournamentId="t1" isDraft={false} onShare={onShare} />);

    expect(screen.getByRole('link', { name: 'Widget TV' })).toHaveAttribute('href', '/torneo/t1/live');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir visor público' }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('borrador: los dos desactivados y explicando por qué (el visor da 404 a un borrador)', () => {
    const onShare = vi.fn();
    render(<PublicViewerActions tournamentId="t1" isDraft onShare={onShare} />);

    const share = screen.getByRole('button', { name: /Compartir visor público/ });
    expect(share).toBeDisabled();
    expect(share).toHaveAttribute('title', 'Publica el torneo para compartirlo');
    fireEvent.click(share);
    expect(onShare).not.toHaveBeenCalled();

    const widget = screen.getByRole('link', { name: /Widget TV/ });
    expect(widget).toHaveAttribute('aria-disabled', 'true');
    expect(widget).not.toHaveAttribute('href');
    expect(widget).toHaveAttribute('title', 'Publica el torneo para compartirlo');
  });
});
