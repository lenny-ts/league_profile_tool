import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { SAVED_WINDOW_SIZE_KEY } from '../storageKeys';

export const WINDOW_SIZE_PRESETS = [
    { value: 'compact', label: 'Compact', width: 1000, height: 700 },
    { value: 'recommended', label: 'Recommended', width: 1200, height: 800 },
    { value: 'large', label: 'Large', width: 1400, height: 900 },
] as const;

export type WindowSizePreset = typeof WINDOW_SIZE_PRESETS[number]['value'];

export function getSavedWindowSizePreset(): WindowSizePreset {
    const saved = localStorage.getItem(SAVED_WINDOW_SIZE_KEY);
    return WINDOW_SIZE_PRESETS.some(preset => preset.value === saved)
        ? saved as WindowSizePreset
        : 'recommended';
}

export async function applyWindowSizePreset(value: WindowSizePreset): Promise<void> {
    const preset = WINDOW_SIZE_PRESETS.find(item => item.value === value) || WINDOW_SIZE_PRESETS[1];
    const monitor = await currentMonitor();
    const scaleFactor = monitor?.scaleFactor || 1;
    const width = monitor
        ? Math.max(960, Math.min(preset.width, Math.floor(monitor.size.width / scaleFactor - 32)))
        : preset.width;
    const height = monitor
        ? Math.max(650, Math.min(preset.height, Math.floor(monitor.size.height / scaleFactor - 32)))
        : preset.height;
    const appWindow = getCurrentWindow();

    await appWindow.setSize(new LogicalSize(width, height));
    await appWindow.center();
}
