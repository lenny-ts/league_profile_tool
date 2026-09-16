import { expect, it } from 'vitest';
import { BUILTIN_THEMES } from './clientThemes';

it('ships two champion themes with wallpaper ownership and reduced motion', () => {
    expect(BUILTIN_THEMES).toHaveLength(2);
    for (const theme of BUILTIN_THEMES) {
        expect(new TextEncoder().encode(theme.css).length).toBeLessThan(200_000);
        expect(theme.css).toContain(theme.image);
        expect(theme.css).toContain('prefers-reduced-motion: reduce');
        expect(new URL(theme.image).hostname).toBe('raw.communitydragon.org');
        expect(theme.css).toContain('--lpt-wallpaper:');
        expect(theme.css).toContain('.rcp-fe-lol-parties');
        expect(theme.css).toContain('#background-ambient');
        expect(theme.css).toContain('.challenges-collection-component > .background');
        expect(theme.css).toContain('.__rcp-fe-lol-store');
        expect(theme.css).not.toContain('.rcp-fe-lol-profiles-main');
        expect(theme.css).not.toContain('.style-profile-background-image');
    }
});
