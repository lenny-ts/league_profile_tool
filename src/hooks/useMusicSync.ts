import { useEffect, useRef, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, DEFAULT_IDLE_BIO } from '../store';
import type { LcuInfo, MusicBioSettings } from '../store';
import { MUSIC_BIO_SETTINGS_KEY } from '../storageKeys';

export type { MusicBioSettings };
export { defaultMusicBioSettings, DEFAULT_IDLE_BIO } from '../store';

export interface NowPlayingTrack {
    sourceLabel: string;
    artist: string;
    title: string;
    album: string;
}

export const clampPollInterval = (value: number) => {
    if (!Number.isFinite(value)) return 15;
    return Math.max(5, Math.min(120, Math.round(value)));
};

export const truncateBio = (value: string, max?: number) => {
    const trimmed = value.trim();
    if (max === undefined) return trimmed;
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 3)}...`;
};

export const buildBioFromTemplate = (template: string, track: NowPlayingTrack) => {
    const replaceToken = (input: string, token: string, value: string) => input.split(token).join(value);
    return truncateBio(
        replaceToken(
            replaceToken(
                replaceToken(
                    replaceToken(template, "{title}", track.title),
                    "{artist}",
                    track.artist
                ),
                "{album}",
                track.album
            ),
            "{source}",
            track.sourceLabel
        )
    );
};

// Pure module-level function — not recreated on every render
async function fetchLastFmNowPlaying(settings: MusicBioSettings): Promise<NowPlayingTrack | null> {
    const username = settings.lastfmUsername.trim();
    const apiKey = settings.lastfmApiKey.trim();
    if (!username || !apiKey) return null;
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(username)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Last.fm HTTP ${response.status}`);
        const payload = await response.json();
        const recentTracks = payload?.recenttracks?.track;
        const track = Array.isArray(recentTracks) ? recentTracks[0] : recentTracks;
        if (!track) return null;
        const nowPlaying = String(track?.["@attr"]?.nowplaying || "").toLowerCase() === "true";
        if (!nowPlaying) return null;

        return {
            sourceLabel: "Last.fm",
            artist: String(track?.artist?.["#text"] || "").trim(),
            title: String(track?.name || "").trim(),
            album: String(track?.album?.["#text"] || "").trim()
        };
    } finally {
        clearTimeout(timeout);
    }
}

export function useMusicSync(lcu: LcuInfo | null, addLog: (msg: string) => void) {
    const musicBio = useAppStore(s => s.musicBio);
    const setMusicBio = useAppStore(s => s.setMusicBio);
    const musicSettingsHydratedRef = useRef(false);

    const musicSyncRunningRef = useRef(false);
    const lastAutoBioRef = useRef<string>("");
    const musicSyncLastErrorRef = useRef<string>("");

    // Hydrate from localStorage once on mount
    useEffect(() => {
        if (musicSettingsHydratedRef.current) return;
        musicSettingsHydratedRef.current = true;
        try {
            const raw = localStorage.getItem(MUSIC_BIO_SETTINGS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<MusicBioSettings>;
                setMusicBio({
                    ...parsed,
                    idleText: String(parsed?.idleText ?? "").trim() || DEFAULT_IDLE_BIO,
                    pollIntervalSec: clampPollInterval(Number(parsed?.pollIntervalSec ?? 15))
                });
            }
        } catch {
            // Ignore broken local storage values
        }
    }, [setMusicBio]);

    // Persist to localStorage whenever musicBio changes
    useEffect(() => {
        if (!musicSettingsHydratedRef.current) return;
        localStorage.setItem(MUSIC_BIO_SETTINGS_KEY, JSON.stringify({
            ...musicBio,
            pollIntervalSec: clampPollInterval(musicBio.pollIntervalSec)
        }));
    }, [musicBio]);

    const applyIdleBio = useCallback(async () => {
        if (!lcu || musicSyncRunningRef.current) return;
        const idle = truncateBio(musicBio.idleText.trim() || DEFAULT_IDLE_BIO);
        if (!idle) return;
        try {
            await invoke("update_bio", { port: lcu.port, token: lcu.token, newBio: idle });
            lastAutoBioRef.current = idle;
            addLog(`Music idle bio restored: "${idle}"`);
        } catch (err) {
            addLog(`Failed to restore idle bio: ${err}`);
        }
    }, [lcu, musicBio.idleText, addLog]);

    useEffect(() => {
        if (!musicBio.enabled || !lcu) return;

        let cancelled = false;
        let intervalId: ReturnType<typeof globalThis.setInterval> | undefined;

        const syncNowPlaying = async () => {
            if (cancelled || musicSyncRunningRef.current) return;
            musicSyncRunningRef.current = true;
            try {
                const settings = { ...musicBio, pollIntervalSec: clampPollInterval(musicBio.pollIntervalSec) };
                const track = await fetchLastFmNowPlaying(settings);
                if (cancelled) return;

                let nextBio = "";
                if (track) {
                    nextBio = buildBioFromTemplate(settings.template, track);
                } else if (settings.idleText.trim()) {
                    nextBio = truncateBio(settings.idleText);
                }

                if (!nextBio || nextBio === lastAutoBioRef.current) return;
                await invoke("update_bio", { port: lcu.port, token: lcu.token, newBio: nextBio });
                if (cancelled) return;
                lastAutoBioRef.current = nextBio;
                musicSyncLastErrorRef.current = "";
                addLog(`Music bio updated (lastfm): "${nextBio}"`);
            } catch (err) {
                if (cancelled) return;
                const errorText = String(err);
                if (errorText !== musicSyncLastErrorRef.current) {
                    musicSyncLastErrorRef.current = errorText;
                    addLog(`Music bio sync error: ${errorText}`);
                }
            } finally {
                musicSyncRunningRef.current = false;
            }
        };

        syncNowPlaying();
        intervalId = globalThis.setInterval(syncNowPlaying, clampPollInterval(musicBio.pollIntervalSec) * 1000);

        return () => {
            cancelled = true;
            if (intervalId) globalThis.clearInterval(intervalId);
        };
    }, [musicBio, lcu, addLog]);

    useEffect(() => {
        if (musicBio.enabled && lcu) return;
        musicSyncRunningRef.current = false;
        musicSyncLastErrorRef.current = "";
        lastAutoBioRef.current = "";
    }, [musicBio.enabled, lcu]);

    return { musicBio, setMusicBio, applyIdleBio };
}
