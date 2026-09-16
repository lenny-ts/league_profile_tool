import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Code2, Download, FileCode2, Palette, RotateCcw, Upload } from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { CLIENT_THEME_KEY } from '../../storageKeys';
import guide from '../../../res/docs/CLIENT_THEMES.md?raw';
import './ThemeTab.css';
import { BUILTIN_THEMES, LibraryTheme } from '../../utils/clientThemes';

const DEFAULT_CSS = `/* Change these selectors to style the League Client. */
:root {
  --lpt-theme-accent: #3b82f6;
}

/* Client panels may cover this background; inspect their selectors next. */
body { background-color: #09090b !important; }
`;

interface ThemeState {
    name: string;
    css: string;
}

interface ThemeTabProps {
    addLog: (message: string) => void;
    showToast?: (text: string, type: string) => void;
}

const readSavedTheme = (): ThemeState => {
    try {
        const saved = JSON.parse(localStorage.getItem(CLIENT_THEME_KEY) || '{}') as Partial<ThemeState>;
        return {
            name: typeof saved.name === 'string' ? saved.name : 'My Client Theme',
            css: typeof saved.css === 'string' ? saved.css : DEFAULT_CSS,
        };
    } catch {
        return { name: 'My Client Theme', css: DEFAULT_CSS };
    }
};

const ThemeTab: React.FC<ThemeTabProps> = ({ addLog, showToast }) => {
    const [theme, setTheme] = useState<ThemeState>(readSavedTheme);
    const [saving, setSaving] = useState(false);
    const [library, setLibrary] = useState<LibraryTheme[]>([]);
    const [libraryReady, setLibraryReady] = useState(false);
    const [libraryError, setLibraryError] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        invoke<LibraryTheme[]>('list_library_themes').then(items => {
            if (active) { setLibrary(items || []); setLibraryReady(true); }
        }).catch(error => { if (active) setLibraryError(String(error)); });
        return () => { active = false; };
    }, []);

    const selectTheme = (item: ThemeState, id: string | null = null) => {
        setTheme({ name: item.name, css: item.css });
        setSelectedId(id);
    };

    const storeTheme = async (item: ThemeState, id: string = crypto.randomUUID()) => {
        const entry = { ...item, id };
        await invoke('save_library_theme', { theme: entry });
        setLibrary(items => [...items.filter(value => value.id !== id), entry].sort((a, b) => a.name.localeCompare(b.name)));
        return entry;
    };

    const saveToLibrary = async (copy = false) => {
        setSaving(true);
        try {
            const entry = await storeTheme(theme, copy ? undefined : selectedId || undefined);
            setSelectedId(entry.id);
            showToast?.('Theme saved to your library.', 'success');
        } catch (error) { showToast?.(`Library save failed: ${error}`, 'error'); }
        finally { setSaving(false); }
    };

    const removeTheme = async () => {
        if (!deleteId) return;
        setSaving(true);
        try {
            await invoke('delete_library_theme', { id: deleteId });
            setLibrary(items => items.filter(item => item.id !== deleteId));
            if (selectedId === deleteId) setSelectedId(null);
            setDeleteId(null);
        } catch (error) { showToast?.(`Delete failed: ${error}`, 'error'); }
        finally { setSaving(false); }
    };
    const [applied, setApplied] = useState<Pick<ThemeState, 'name' | 'css'> | null>(null);

    useEffect(() => {
        let active = true;
        invoke<{ name: string; css: string; enabled: boolean } | null>('get_client_theme')
            .then(value => { if (active && value?.enabled) setApplied(value); })
            .catch(error => addLog(`Theme status unavailable: ${error}`));
        return () => { active = false; };
    }, [addLog]);

    useEffect(() => {
        try {
            localStorage.setItem(CLIENT_THEME_KEY, JSON.stringify(theme));
        } catch (error) {
            addLog(`Theme draft could not be saved: ${error}`);
        }
    }, [theme]);

    const saveTheme = async () => {
        setSaving(true);
        try {
            const result = await invoke<string>('save_client_theme', {
                name: theme.name,
                css: theme.css,
                enabled: true,
            });
            setApplied({ name: theme.name, css: theme.css });
            addLog(result);
            showToast?.('Theme saved. Restart League after plugin installation or update.', 'success');
        } catch (error) {
            addLog(`Theme save failed: ${error}`);
            showToast?.(`Theme save failed: ${error}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const importTheme = async () => {
        setSaving(true);
        try {
            const path = await open({ filters: [{ name: 'Theme CSS', extensions: ['css'] }], multiple: false });
            if (!path || Array.isArray(path)) return;
            const css = await invoke<string>('read_client_theme_css', { path });
            const entry = await storeTheme({ css, name: (path.split(/[\\/]/).pop()?.replace(/\.css$/i, '') || 'Imported theme').slice(0, 80) });
            selectTheme(entry, entry.id);
            addLog(`Imported theme CSS from ${path}`);
            showToast?.('Theme imported. Click Apply Theme to install it.', 'success');
        } catch (error) {
            addLog(`Theme import failed: ${error}`);
            showToast?.(`Theme import failed: ${error}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const resetTheme = async () => {
        setSaving(true);
        try {
            await invoke('clear_client_theme');
            setApplied(null);
            addLog('Client theme disabled.');
            showToast?.('Client theme disabled.', 'success');
        } catch (error) {
            addLog(`Theme reset failed: ${error}`);
            showToast?.(`Theme reset failed: ${error}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const exportFile = async (documentation = false) => {
        try {
            const path = await save({ defaultPath: documentation ? 'CLIENT_THEMES.md' : 'theme.css', filters: [{ name: documentation ? 'Markdown' : 'CSS', extensions: [documentation ? 'md' : 'css'] }] });
            if (!path) return;
            await invoke('save_logs_to_path', { path, content: documentation ? guide : theme.css });
            showToast?.('File exported.', 'success');
        } catch (error) {
            addLog(`Theme export failed: ${error}`);
            showToast?.(`Export failed: ${error}`, 'error');
        }
    };

    return (
        <div className="tab-content fadeIn ui-page theme-page">
            <div className="ui-page-header">
                <div className="ui-page-header__copy">
                    <h2 className="ui-page-header__title">Client Themes</h2>
                    <p className="ui-page-header__description">Create a CSS theme for your League Client and apply it through Pengu Loader.</p>
                </div>
                <span className={`theme-status-badge ${applied ? 'active' : ''}`}>
                    {applied ? 'ENABLED IN CONFIG' : 'NOT ENABLED'}
                </span>
            </div>

            <section className="card ui-panel" aria-labelledby="theme-presets-title">
                <h3 id="theme-presets-title">Default Themes</h3>
                <p className="theme-guide-note">Champion splash artwork, coordinated panels and motion. Theme backgrounds take priority over Profile Background while enabled. Artwork loads from CommunityDragon (© Riot Games).</p>
                <div className="theme-library-grid">
                    {BUILTIN_THEMES.map(item => <button key={item.id} type="button" className="theme-library-card" disabled={saving} onClick={() => selectTheme(item)} aria-pressed={theme.css === item.css}>
                        <img className="theme-artwork" src={item.image} alt="" />
                        <span className="theme-swatches" aria-hidden="true">{item.colors.map(color => <span key={color} style={{ backgroundColor: color }} />)}</span>
                        <strong>{item.name}</strong>
                        <p className="theme-guide-note">{item.description}</p>
                    </button>)}
                </div>
            </section>
            <section className="card ui-panel" aria-labelledby="my-themes-title">
                <h3 id="my-themes-title">My Themes ({library.length})</h3>
                <p className="theme-guide-note">Your themes are stored as separate files in the app data folder, independently of Pengu. Selecting a theme loads the editor; only Apply changes the client.</p>
                {libraryError && <p role="alert">Cannot load theme library: {libraryError}. Existing files have not been replaced.</p>}
                <div className="theme-editor-actions">
                    <button type="button" className="ghost-btn" disabled={saving || !libraryReady} onClick={() => selectTheme({ name: 'My Client Theme', css: DEFAULT_CSS })}>New Theme</button>
                    <button type="button" className="ghost-btn" disabled={saving || !libraryReady} onClick={importTheme}>Add CSS to Library</button>
                </div>
                <label className="theme-field-label" htmlFor="theme-library-search">Search my themes</label>
                <input id="theme-library-search" type="search" className="theme-name-input" value={query} onChange={event => setQuery(event.target.value)} />
                {!libraryReady && !libraryError && <p role="status">Loading themes…</p>}
                {libraryReady && !library.length && <p>No personal themes yet. Import CSS or save a preset copy.</p>}
                {library.length > 0 && !library.some(item => item.name.toLowerCase().includes(query.toLowerCase())) && <p>No matching themes.</p>}
                <div className="theme-library-grid theme-personal-list">
                    {library.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => <article className="theme-library-card" key={item.id}>
                        <button type="button" className="ghost-btn" disabled={saving} aria-pressed={selectedId === item.id} onClick={() => selectTheme(item, item.id)}>{item.name}</button>
                        <button type="button" className="ghost-btn" disabled={saving} aria-label={`Delete ${item.name}`} onClick={() => setDeleteId(item.id)}>Delete</button>
                    </article>)}
                </div>
                {deleteId && <div role="group" aria-label="Confirm theme deletion">
                    <p>Remove this saved theme? The editor draft and applied client theme will remain.</p>
                    <button type="button" className="ghost-btn" disabled={saving} onClick={removeTheme}>Confirm Delete</button>
                    <button type="button" className="ghost-btn" disabled={saving} onClick={() => setDeleteId(null)}>Cancel</button>
                </div>}
            </section>
            <div className="theme-editor-grid">
                <section className="card ui-panel">
                    <div className="ui-section-header">
                        <div className="ui-section-header__icon"><Palette size={16} /></div>
                        <div className="ui-section-header__copy">
                            <h3 className="ui-section-header__title">Theme Editor</h3>
                            <p className="ui-section-header__description">The CSS is stored locally and injected only into your client.</p>
                        </div>
                    </div>
                    <label className="theme-field-label" htmlFor="theme-name">Theme name</label>
                    <input id="theme-name" className="theme-name-input" value={theme.name} maxLength={80} onChange={event => setTheme(current => ({ ...current, name: event.target.value }))} />
                    <label className="theme-field-label" htmlFor="theme-css">Theme CSS</label>
                    <textarea id="theme-css" className="theme-css-editor" spellCheck={false} value={theme.css} onChange={event => setTheme(current => ({ ...current, css: event.target.value }))} />
                    <div className="theme-editor-actions">
                        <button type="button" className="ghost-btn" onClick={importTheme} disabled={saving || !libraryReady}><Upload size={15} /> Import CSS</button>
                        <button type="button" className="ghost-btn" onClick={() => saveToLibrary()} disabled={saving || !libraryReady}>{selectedId ? 'Update Saved Theme' : 'Save to My Themes'}</button>
                        {selectedId && <button type="button" className="ghost-btn" onClick={() => saveToLibrary(true)} disabled={saving}>Save as Copy</button>}
                        <button type="button" className="ghost-btn" onClick={() => exportFile()}><Download size={15} /> Export CSS</button>
                        <button type="button" className="ghost-btn theme-primary-action" onClick={saveTheme} disabled={saving}><Check size={15} /> {saving ? 'Applying...' : 'Apply Theme'}</button>
                        <button type="button" className="ghost-btn" onClick={resetTheme} disabled={saving}><RotateCcw size={15} /> Disable</button>
                    </div>
                    {applied && <p className="theme-guide-note">Saved theme: {applied.name}.{applied.css !== theme.css || applied.name !== theme.name ? ' Draft changes are not applied yet.' : ''}</p>}
                    <p className="theme-guide-note">Requires Pengu Loader. Restart League after installing or updating the plugin; subsequent CSS changes refresh within 5 seconds. Import CSS from authors you trust; styles can load remote resources.</p>
                </section>

                <section className="card ui-panel theme-guide-card">
                    <div className="ui-section-header">
                        <div className="ui-section-header__icon"><BookOpen size={16} /></div>
                        <div className="ui-section-header__copy">
                            <h3 className="ui-section-header__title">Theme Guide</h3>
                            <p className="ui-section-header__description">A theme is a normal CSS file.</p>
                        </div>
                    </div>
                    <div className="theme-guide-list">
                        <div><Code2 size={15} /><span>Use valid CSS selectors and add <code>!important</code> when the client overrides your rule.</span></div>
                        <div><FileCode2 size={15} /><span>Inspect the client to discover stable classes, then target small areas instead of the whole document.</span></div>
                        <div><Download size={15} /><span>Save your file as <code>.css</code>, import it, then click Apply Theme.</span></div>
                    </div>
                    <pre className="theme-guide-code">{`/* Example theme */\nbody {\n  background: #09090b !important;\n}\n\n.some-client-panel {\n  background: #18181b !important;\n  border-color: #3b82f6 !important;\n}`}</pre>
                    <p className="theme-guide-note">The example panel selector is a placeholder. Client selectors change between patches; document which patch you tested. Styles do not cross closed Shadow DOM boundaries.</p>
                    <button type="button" className="ghost-btn" onClick={() => exportFile(true)}><BookOpen size={15} /> Download full guide</button>
                    <h3>CSS preview (sample page)</h3>
                    <p className="theme-guide-note">This isolated sample is not the League Client. Verify real selectors in League.</p>
                    <iframe title="Theme CSS sample preview" sandbox="" className="theme-preview" srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https://raw.communitydragon.org"><style>body{margin:0;min-height:390px;box-sizing:border-box;background:#091428;color:#f0e6d2;font:14px/1.5 sans-serif;padding:24px}nav{display:flex;gap:24px;padding:14px;margin-bottom:38px}.some-client-panel{padding:16px;border:1px solid #c8aa6e;max-width:190px}h2{font-size:24px;margin:0 0 10px}small{letter-spacing:.14em}input{box-sizing:border-box;padding:8px;width:100%;border:1px solid;margin-top:12px}</style><style>${theme.css.replace(/</g, '\\3c ')}</style></head><body><nav class="rcp-fe-lol-navigation"><span class="navigation-tab active">HOME</span><span class="navigation-tab">PROFILE</span><span class="navigation-tab">COLLECTION</span></nav><section class="some-client-panel"><small>YOUR NEXT CHAPTER</small><h2>Welcome home</h2><p>Your champion.<br>Your client.</p><label>Find a friend<input type="search" placeholder="Search…"></label></section></body></html>`} />
                </section>
            </div>
        </div>
    );
};

export default React.memo(ThemeTab);
