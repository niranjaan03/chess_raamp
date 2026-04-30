import React from 'react';

export default function SettingsTab() {
  const engineOptions = (
    <>
      <option value="sf18">Stockfish 18 Browser</option>
      <option value="sf18-lite">Stockfish 18 Lite Browser</option>
      <option value="sf18-full">Stockfish 18 Full Browser</option>
      <option value="sf17-1-lite">Stockfish 17.1 Lite Browser</option>
      <option value="sf17-1-full">Stockfish 17.1 Full Browser</option>
      <option value="sf17-lite">Stockfish 17 Lite Browser</option>
      <option value="sf17-full">Stockfish 17 Full Browser</option>
      <option value="sf16-1-lite">Stockfish 16.1 Lite Browser</option>
      <option value="sf16-1-full">Stockfish 16.1 Full Browser</option>
      <option value="sf16-nnue">Stockfish 16 NNUE Browser</option>
    </>
  );

  return (
    <div className="tab-content" id="tab-settings">
      <div className="settings-layout">
        <div className="settings-hero">
          <div className="support-badge">Settings</div>
          <h2 className="support-title">Customize your analysis setup</h2>
          <p className="support-subtitle">
            Tune browser Stockfish, board colors, piece style, and move sound. Changes apply across analysis, practice, and puzzle boards.
          </p>
        </div>

        <div className="settings-grid">
          <div className="settings-card settings-engine-card">
            <div className="settings-card-title">Browser Stockfish Settings</div>
            <p className="settings-card-text">Analysis runs on your device through WebAssembly workers. Mobile devices may use lower depth.</p>
            <div className="settings-engine-controls">
              <div className="setting-row settings-engine-row">
                <span>Engine</span>
                <select id="settingsEngineSelect" className="dark-select settings-engine-select" defaultValue="sf18">
                  {engineOptions}
                </select>
              </div>
              <div className="slider-row settings-engine-row">
                <span>Depth</span>
                <input type="range" min="8" max="35" defaultValue="20" id="depthSlider" className="dark-slider" />
                <span id="depthVal">20</span>
              </div>
              <div className="slider-row settings-engine-row">
                <span>Threads</span>
                <input type="range" min="1" max="16" defaultValue="2" id="threadsSlider" className="dark-slider" />
                <span id="threadsVal">2</span>
              </div>
              <div className="slider-row settings-engine-row">
                <span>Hash (MB)</span>
                <input type="range" min="64" max="1024" step="64" defaultValue="256" id="hashSlider" className="dark-slider" />
                <span id="hashVal">256</span>
              </div>
              <div className="setting-row toggle-row settings-engine-row">
                <span>Analysis Mode</span>
                <label className="toggle">
                  <input type="checkbox" id="analysisMode" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-card-title">Appearance Mode</div>
            <p className="settings-card-text">Switch the whole website between dark and light mode for day and night use.</p>
            <select id="settingsColorMode" className="dark-select settings-select settings-native-select" defaultValue="dark">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
            <div className="settings-visual-grid settings-mode-grid">
              <button type="button" className="settings-option-card active" data-target="settingsColorMode" data-value="dark">
                <div className="settings-mode-preview settings-mode-preview-dark">
                  <span className="settings-mode-icon">&#9790;</span>
                </div>
                <span className="settings-option-label">Dark</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsColorMode" data-value="light">
                <div className="settings-mode-preview settings-mode-preview-light">
                  <span className="settings-mode-icon">&#9728;</span>
                </div>
                <span className="settings-option-label">Light</span>
              </button>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-card-title">Board Theme</div>
            <p className="settings-card-text">Pick the board color palette you want to use across the app.</p>
            <select id="settingsBoardTheme" className="dark-select settings-select settings-native-select" defaultValue="green">
              <option value="green">Classic Green</option>
              <option value="brown">Brown Wood</option>
              <option value="blue">Blue Ice</option>
              <option value="purple">Purple Dark</option>
              <option value="red">Crimson</option>
            </select>
            <div className="settings-visual-grid">
              <button type="button" className="settings-option-card active" data-target="settingsBoardTheme" data-value="green">
                <div className="settings-preview-board theme-green">
                  <span className="preview-piece preview-white">♘</span>
                  <span className="preview-piece preview-black">♞</span>
                </div>
                <span className="settings-option-label">Classic Green</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="brown">
                <div className="settings-preview-board theme-brown">
                  <span className="preview-piece preview-white">♘</span>
                  <span className="preview-piece preview-black">♞</span>
                </div>
                <span className="settings-option-label">Brown Wood</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="blue">
                <div className="settings-preview-board theme-blue">
                  <span className="preview-piece preview-white">♘</span>
                  <span className="preview-piece preview-black">♞</span>
                </div>
                <span className="settings-option-label">Blue Ice</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="purple">
                <div className="settings-preview-board theme-purple">
                  <span className="preview-piece preview-white">♘</span>
                  <span className="preview-piece preview-black">♞</span>
                </div>
                <span className="settings-option-label">Purple Dark</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="red">
                <div className="settings-preview-board theme-red">
                  <span className="preview-piece preview-white">♘</span>
                  <span className="preview-piece preview-black">♞</span>
                </div>
                <span className="settings-option-label">Crimson</span>
              </button>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-card-title">Piece Style</div>
            <p className="settings-card-text">Switch between six piece looks and use the one you prefer.</p>
            <select id="settingsPieceStyle" className="dark-select settings-select settings-native-select" defaultValue="classic">
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="glass">Glass</option>
              <option value="minimal">Minimal</option>
              <option value="outline">Outline</option>
              <option value="bold">Bold</option>
            </select>
            <div className="settings-visual-grid settings-piece-grid">
              <button type="button" className="settings-option-card active" data-target="settingsPieceStyle" data-value="classic">
                <div className="settings-preview-piece style-classic">
                  <span className="preview-piece preview-white">♕</span>
                  <span className="preview-piece preview-black">♛</span>
                </div>
                <span className="settings-option-label">Classic</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="modern">
                <div className="settings-preview-piece style-modern">
                  <span className="preview-piece preview-white">♕</span>
                  <span className="preview-piece preview-black">♛</span>
                </div>
                <span className="settings-option-label">Modern</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="glass">
                <div className="settings-preview-piece style-glass">
                  <span className="preview-piece preview-white">♕</span>
                  <span className="preview-piece preview-black">♛</span>
                </div>
                <span className="settings-option-label">Glass</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="minimal">
                <div className="settings-preview-piece style-minimal">
                  <span className="preview-piece preview-white">♕</span>
                  <span className="preview-piece preview-black">♛</span>
                </div>
                <span className="settings-option-label">Minimal</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="outline">
                <div className="settings-preview-piece style-outline">
                  <span className="preview-piece preview-white">♕</span>
                  <span className="preview-piece preview-black">♛</span>
                </div>
                <span className="settings-option-label">Outline</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="bold">
                <div className="settings-preview-piece style-bold">
                  <span className="preview-piece preview-white">♕</span>
                  <span className="preview-piece preview-black">♛</span>
                </div>
                <span className="settings-option-label">Bold</span>
              </button>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-card-title">Move Sound</div>
            <p className="settings-card-text">Play a sound for accepted moves across Analyze, Practice, and Puzzles.</p>
            <div className="setting-row toggle-row settings-sound-row">
              <span>Move sound</span>
              <label className="toggle">
                <input type="checkbox" id="settingsMoveSound" />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-sound-label" style={{ marginTop: '16px', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Sound Style</div>
            <select id="settingsSoundStyle" className="dark-select settings-select settings-native-select" defaultValue="classic">
              <option value="classic">Classic Tick</option>
              <option value="premium">Premium Chime</option>
              <option value="glass">Glass Bell</option>
            </select>
            <div className="settings-visual-grid settings-sound-grid" style={{ marginTop: '12px' }}>
              <button type="button" className="settings-option-card active" data-target="settingsSoundStyle" data-value="classic">
                <div className="settings-sound-preview">
                  <span style={{ fontSize: '24px' }}>🎵</span>
                </div>
                <span className="settings-option-label">Classic</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsSoundStyle" data-value="premium">
                <div className="settings-sound-preview">
                  <span style={{ fontSize: '24px' }}>✨</span>
                </div>
                <span className="settings-option-label">Premium</span>
              </button>
              <button type="button" className="settings-option-card" data-target="settingsSoundStyle" data-value="glass">
                <div className="settings-sound-preview">
                  <span style={{ fontSize: '24px' }}>🔔</span>
                </div>
                <span className="settings-option-label">Glass Bell</span>
              </button>
            </div>
            <div className="settings-sound-note">
              Choose your preferred sound style. All options stay on during autoplay, opponent replies, and puzzle continuation.
            </div>
          </div>
        </div>

        <div className="support-info-grid">
          <div className="support-panel">
            <div className="support-panel-title">Theme notes</div>
            <div className="support-list">
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>`Classic Green` and `Brown Wood` match traditional chessboard colors.</span>
              </div>
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>`Blue Ice`, `Purple Dark`, and `Crimson` give higher contrast visual styles.</span>
              </div>
            </div>
          </div>

          <div className="support-panel">
            <div className="support-panel-title">Piece style notes</div>
            <div className="support-list">
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>`Classic` and `Bold` are easiest to read quickly during review.</span>
              </div>
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>`Minimal`, `Outline`, and `Glass` are better if you want a cleaner visual style.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
