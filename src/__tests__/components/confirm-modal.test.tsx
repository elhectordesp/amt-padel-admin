import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../../../components/admin/confirm-modal';

function baseProps(overrides = {}) {
  return {
    open:        true,
    title:       'Título de prueba',
    description: 'Descripción de prueba',
    onClose:     vi.fn(),
    onConfirm:   vi.fn(),
    ...overrides,
  };
}

describe('ConfirmModal', () => {
  it('no renderiza nada cuando open=false', () => {
    const { container } = render(<ConfirmModal {...baseProps({ open: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('muestra el título y la descripción cuando open=true', () => {
    render(<ConfirmModal {...baseProps()} />);
    expect(screen.getByText('Título de prueba')).toBeInTheDocument();
    expect(screen.getByText('Descripción de prueba')).toBeInTheDocument();
  });

  it('muestra la etiqueta de confirmación por defecto "Confirmar"', () => {
    render(<ConfirmModal {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('muestra la etiqueta personalizada cuando se pasa confirmLabel', () => {
    render(<ConfirmModal {...baseProps({ confirmLabel: 'Eliminar' })} />);
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('llama a onConfirm al hacer clic en el botón de confirmación', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...baseProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('llama a onClose al hacer clic en el botón Cancelar', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama a onClose al hacer clic en el botón X', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...baseProps({ onClose })} />);
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find((b) => !b.textContent?.includes('Confirmar') && !b.textContent?.includes('Cancelar'));
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama a onClose al hacer clic en el backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<ConfirmModal {...baseProps({ onClose })} />);
    const backdrop = container.querySelector('.absolute.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('muestra "..." y deshabilita el botón cuando loading=true', () => {
    render(<ConfirmModal {...baseProps({ loading: true })} />);
    const confirmBtn = screen.getByRole('button', { name: '...' });
    expect(confirmBtn).toBeDisabled();
  });

  it('en modo danger aplica clases destructive al botón de confirmación', () => {
    render(<ConfirmModal {...baseProps({ danger: true, confirmLabel: 'Borrar' })} />);
    const confirmBtn = screen.getByRole('button', { name: 'Borrar' });
    expect(confirmBtn.className).toContain('destructive');
  });

  it('en modo normal (danger=false) aplica clases doradas al botón de confirmación', () => {
    render(<ConfirmModal {...baseProps({ danger: false, confirmLabel: 'OK' })} />);
    const confirmBtn = screen.getByRole('button', { name: 'OK' });
    expect(confirmBtn.className).toContain('#D4AF37');
  });
});
