import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { invoke } from "@tauri-apps/api/core";
import { LcuInfo } from '../../hooks/useLcu';
import { Icon } from '../../hooks/useIcons';
import { SAVED_ICON_KEY } from '../../storageKeys';

interface IconTabProps {
    lcu: LcuInfo | null;
    showToast: (text: string, type: string) => void;
    addLog: (msg: string) => void;
    visibleIcons: Icon[];
    iconSearchTerm: string;
    setIconSearchTerm: (term: string) => void;
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    gridRef: React.RefObject<HTMLDivElement | null>;
}

const IconTab: React.FC<IconTabProps> = ({
    lcu, showToast, addLog,
    visibleIcons, iconSearchTerm, setIconSearchTerm,
    handleScroll, gridRef
}) => {
    const [selectedIcon, setSelectedIcon] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const applyIcon = async () => {
        if (!lcu || selectedIcon === null) return;
        setLoading(true);
        try {
            await invoke("lcu_request", {
                method: "PUT",
                endpoint: "/lol-summoner/v1/current-summoner/icon",
                body: { profileIconId: selectedIcon },
                port: lcu.port,
                token: lcu.token
            }).catch((err) => addLog(`Official icon update failed (${err}). Trying Force method...`));

            await invoke("lcu_request", {
                method: "PUT",
                endpoint: "/lol-chat/v1/me",
                body: { icon: selectedIcon },
                port: lcu.port,
                token: lcu.token
            });

            localStorage.setItem(SAVED_ICON_KEY, selectedIcon.toString());

            addLog(`Icon ID ${selectedIcon} applied (Force sync).`);
            showToast("Icon Applied!", "success");
        } catch (err) {
            addLog(`Icon Error: ${err}`);
            showToast("Failed to apply icon", "error");
        } finally { setLoading(false); }
    };

    return (
        <div className="tab-content fadeIn">
            <div className="card">
                <h3 className="card-title">Icon Swapper</h3>
                <div style={{ 
                    background: 'rgba(0, 0, 0, 0.2)', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '8px', 
                    padding: '10px 12px', 
                    marginBottom: '15px', 
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4'
                }}>
                    <strong style={{ color: 'var(--hextech-gold)' }}>Note:</strong> Due to server-side ownership checks by Riot, equipping an icon you do not own will only display in chat and above the friends list. Your official profile page inside the client will continue to display your previously owned icon.
                </div>
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
                            value={iconSearchTerm}
                            onChange={(e) => setIconSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px 8px 35px', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>

                <div
                    ref={gridRef}
                    className="icon-grid"
                    onScroll={handleScroll}
                    style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '10px',
                        contentVisibility: 'auto'
                    }}
                >
                    {visibleIcons.map((icon) => (
                        <button
                            key={icon.id}
                            type="button"
                            className={`icon-item ${selectedIcon === icon.id ? 'selected' : ''}`}
                            onClick={() => setSelectedIcon(icon.id)}
                            style={{
                                cursor: 'pointer', borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
                                padding: '10px', textAlign: 'center', border: selectedIcon === icon.id ? '2px solid var(--hextech-gold)' : '2px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <img 
                                src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${icon.id}.jpg`} 
                                alt={icon.name} 
                                style={{ width: '100%', borderRadius: '6px', marginBottom: '8px', aspectRatio: '1/1', background: 'rgba(255,255,255,0.02)' }} 
                                loading="lazy" 
                            />
                            <div 
                                title={icon.name}
                                style={{ 
                                    fontSize: '0.65rem', 
                                    color: 'var(--text-secondary)', 
                                    fontWeight: 600, 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    lineHeight: '1.2',
                                    height: '2.4em',
                                    marginBottom: '4px'
                                }}
                            >
                                {icon.name}
                            </div>
                            <div style={{ fontSize: '0.55rem', opacity: 0.5 }}>ID: {icon.id}</div>
                        </button>
                    ))}
                </div>

                <button type="button"
                    className="primary-btn"
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={applyIcon}
                    disabled={!lcu || loading || selectedIcon === null}
                >
                    APPLY ICON
                </button>
            </div>
        </div>
    );
};

export default React.memo(IconTab);
