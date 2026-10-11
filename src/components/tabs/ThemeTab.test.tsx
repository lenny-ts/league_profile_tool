import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import ThemeTab from './ThemeTab';
import { BUILTIN_THEMES } from '../../utils/clientThemes';

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
    await screen.findByText('ACTIVE: theme');
    fireEvent.click(screen.getByRole('button', { name: 'Disable Theme' }));
    await screen.findByText('NO THEME ACTIVE');
    expect(screen.queryByRole('button', { name: 'Disable Theme' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Theme' }));
    await screen.findByText('ACTIVE: theme');
    expect(invoke).toHaveBeenLastCalledWith('save_client_theme', { name: 'theme', css: 'body { color: red }', enabled: true });
});

it('loads presets, saves personal copies and deletes only after confirmation', async () => {
    vi.mocked(invoke).mockImplementation(async command => command === 'list_library_themes' ? [{ id: 'personal-1', name: 'My old theme', css: 'body { color: green }' }] : null);
    render(<ThemeTab addLog={vi.fn()} />);
    await screen.findByRole('button', { name: 'My old theme' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Customize' })[1]!);
    expect((screen.getByLabelText('Theme CSS') as HTMLTextAreaElement).value).toContain('--lpt-wallpaper');
    expect(invoke).not.toHaveBeenCalledWith('save_client_theme', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Save to My Themes' }));
    await screen.findByRole('button', { name: 'Update Saved Theme' });
    expect(invoke).toHaveBeenCalledWith('save_library_theme', { theme: expect.objectContaining({ name: 'Rosewater Atelier', id: expect.any(String) }) });
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
    expect(preview.getAttribute('srcdoc')).toContain('https://ddragon.leagueoflegends.com');
    expect(preview.getAttribute('srcdoc')).toContain('body class="rcp-fe-lol-home"');
    expect(preview.getAttribute('srcdoc')).not.toContain('<script>');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSS' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('save_logs_to_path', { path: 'C:\\export.css', content: '</style><script>alert(1)</script>' }));
});

it('reapplies an outdated preset and preserves applied state after a failed save', async () => {
    const preset = BUILTIN_THEMES[0]!;
    vi.mocked(invoke).mockImplementation(async command => command === 'get_client_theme'
        ? { name: preset.name, css: 'body { color: red }', enabled: true } : null);
    render(<ThemeTab addLog={vi.fn()} />);
    await screen.findByText(`ACTIVE: ${preset.name}`);
    expect(screen.queryByRole('button', { name: 'Applied' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Use Theme' })[0]!);
    await screen.findByRole('button', { name: 'Applied' });
    expect(invoke).toHaveBeenCalledWith('save_client_theme', { name: preset.name, css: preset.css, enabled: true });
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Disk unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Use Theme' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Theme' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Applied' })).toBeInTheDocument();
});

it('shows the two Atelier previews and identifies the active preset', async () => {
    const preset = BUILTIN_THEMES[1]!;
    vi.mocked(invoke).mockImplementation(async command => command === 'get_client_theme'
        ? { name: preset.name, css: preset.css, enabled: true } : null);
    render(<ThemeTab addLog={vi.fn()} />);
    await screen.findByText(`ACTIVE: ${preset.name}`);
    expect(document.querySelectorAll('.theme-preset-scene')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Applied' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use Theme' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Disable Theme' })).toBeEnabled();
});
