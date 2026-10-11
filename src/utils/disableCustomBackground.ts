import { invoke } from '@tauri-apps/api/core';
import { SAVED_CUSTOM_BACKGROUND_KEY } from '../storageKeys';

export async function disableCustomBackground(): Promise<void> {
    if (localStorage.getItem(SAVED_CUSTOM_BACKGROUND_KEY)) {
        await invoke('clear_custom_background');
        localStorage.removeItem(SAVED_CUSTOM_BACKGROUND_KEY);
    }
}
