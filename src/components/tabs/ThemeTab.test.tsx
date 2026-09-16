import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import ThemeTab from './ThemeTab';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(null);
});

it('imports without applying, applies, disables and re-enables the same CSS', async () => {
    vi.mocked(open).mockResolvedValue('C:\\theme.css');
    vi.mocked(invoke).mockImplementation(async command => command === 'read_client_theme_css' ? 'body { color: red }' : null);
    render(<ThemeTab addLog={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import CSS' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Import CSS' }));
    await waitFor(() => expect(screen.getByLabelText('Theme CSS')).toHaveValue('body { color: red }'));
    expect(invoke).not.toHaveBeenCalledWith('save_client_theme', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Apply Theme' }));
    await screen.findByText('ENABLED IN CONFIG');
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await screen.findByText('NOT ENABLED');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Theme' }));
    await screen.findByText('ENABLED IN CONFIG');
    expect(invoke).toHaveBeenLastCalledWith('save_client_theme', { name: 'theme', css: 'body { color: red }', enabled: true });
});

it('loads presets, saves personal copies and deletes only after confirmation', async () => {
    vi.mocked(invoke).mockImplementation(async command => command === 'list_library_themes' ? [{ id: 'personal-1', name: 'My old theme', css: 'body { color: green }' }] : null);
    render(<ThemeTab addLog={vi.fn()} />);
    await screen.findByRole('button', { name: 'My old theme' });
    fireEvent.click(screen.getByRole('button', { name: /Star Guardian — Ahri/ }));
    expect((screen.getByLabelText('Theme CSS') as HTMLTextAreaElement).value).toContain('--lpt-wallpaper');
    expect(invoke).not.toHaveBeenCalledWith('save_client_theme', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Save to My Themes' }));
    await screen.findByRole('button', { name: 'Update Saved Theme' });
    expect(invoke).toHaveBeenCalledWith('save_library_theme', { theme: expect.objectContaining({ name: 'Star Guardian — Ahri', id: expect.any(String) }) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete My old theme' }));
    expect(invoke).not.toHaveBeenCalledWith('delete_library_theme', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'My old theme' })).toBeNull());
    expect(invoke).toHaveBeenCalledWith('delete_library_theme', { id: 'personal-1' });
});

it('exports a CSS draft and keeps preview sandboxed', async () => {
    vi.mocked(save).mockResolvedValue('C:\\export.css');
    render(<ThemeTab addLog={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Theme CSS'), { target: { value: '</style><script>alert(1)</script>' } });
    const preview = screen.getByTitle('Theme CSS sample preview');
    expect(preview).toHaveAttribute('sandbox', '');
    expect(preview.getAttribute('srcdoc')).not.toContain('<script>');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSS' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('save_logs_to_path', { path: 'C:\\export.css', content: '</style><script>alert(1)</script>' }));
});
