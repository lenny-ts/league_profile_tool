import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileTab from './ProfileTab';
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

describe('ProfileTab', () => {
    const createProps = () => ({
        lcu: { port: '1234', token: 'secret' },
        loading: false,
        showToast: vi.fn(),
        addLog: vi.fn(),
        lcuRequest: vi.fn().mockImplementation((_m, endpoint) => {
            if (endpoint === '/lol-chat/v1/me') return Promise.resolve({ availability: 'away', statusMessage: 'Original Bio' });
            return Promise.resolve({});
        }),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(invoke).mockResolvedValue({});
        localStorage.clear();
    });

    it('should render profile bio card', async () => {
        const props = createProps();
        render(<ProfileTab {...props} />);
        expect(await screen.findByText('Profile Bio & Status')).toBeDefined();
    });

    it('should handle bio update and persist to localStorage', async () => {
        const props = createProps();
        render(<ProfileTab {...props} />);

        const textarea = await screen.findByRole('textbox', { name: 'Status message' });
        fireEvent.change(textarea, { target: { value: 'New Bio' } });

        const applyBtn = screen.getByText('APPLY BIO');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith("update_bio", expect.anything());
            expect(localStorage.getItem('profile_saved_bio_v1')).toBe('New Bio');
        });
    });

    it('should update availability', async () => {
        const props = createProps();
        render(<ProfileTab {...props} />);

        fireEvent.click(await screen.findByRole('button', { name: 'MOBILE' }));

        await waitFor(() => {
            expect(props.lcuRequest).toHaveBeenCalledWith("PUT", "/lol-chat/v1/me", expect.anything());
        });
    });

    it('should handle bio update failure', async () => {
        const props = createProps();
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Fail"));
        render(<ProfileTab {...props} />);

        const textarea = await screen.findByRole('textbox', { name: 'Status message' });
        fireEvent.change(textarea, { target: { value: 'test' } });

        const applyBtn = screen.getByText('APPLY BIO');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith("Failed to update bio", "error");
        });
    });

    it('should handle availability update failure', async () => {
        const props = createProps();
        props.lcuRequest = vi.fn()
            .mockResolvedValueOnce({ availability: 'chat', statusMessage: 'my bio' }) // initial fetch
            .mockRejectedValueOnce(new Error("Fail")); // apply call

        render(<ProfileTab {...props} />);

        fireEvent.click(await screen.findByRole('button', { name: 'ONLINE' }));

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith("Failed to update status", "error");
        });
    });

    it('should show warning when LCU is missing', () => {
        const props = createProps() as any;
        props.lcu = null;
        render(<ProfileTab {...props} />);
        expect(screen.getByText(/Start League of Legends to enable this feature/i)).toBeDefined();
    });

    it('should keep known availability actions when the current status is unknown', async () => {
        const props = createProps();
        props.lcuRequest = vi.fn().mockResolvedValue({ availability: 'dnd', statusMessage: 'bio' });

        render(<ProfileTab {...props} />);

        expect(await screen.findByRole('button', { name: 'ONLINE' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'AWAY' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'MOBILE' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'OFFLINE' })).toBeDefined();
    });
});
