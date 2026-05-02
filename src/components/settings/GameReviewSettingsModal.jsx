import React from 'react';
import {
  DEFAULT_GAME_REVIEW_SETTINGS,
  GAME_REVIEW_SETTING_LABELS,
} from '../../constants/gameReviewSettings.js';

function SelectSetting({ id, path, label, options, value }) {
  return (
    <label className="gr-settings-row">
      <span>{label}</span>
      <select id={id} className="gr-settings-select" data-review-setting={path} defaultValue={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleSetting({ id, path, label, checked }) {
  return (
    <label className="gr-settings-row gr-settings-toggle-row">
      <span>{label}</span>
      <span className="gr-settings-switch">
        <input id={id} type="checkbox" data-review-setting={path} defaultChecked={checked} />
        <span aria-hidden="true"></span>
      </span>
    </label>
  );
}

function ActionSetting({ id, label, actionLabel }) {
  return (
    <div className="gr-settings-row">
      <span>{label}</span>
      <button type="button" className="gr-settings-action" id={id}>{actionLabel}</button>
    </div>
  );
}

function optionsFrom(labelKey, values) {
  const labels = GAME_REVIEW_SETTING_LABELS[labelKey] || {};
  return values.map((value) => ({ value, label: labels[value] || value }));
}

const defaults = DEFAULT_GAME_REVIEW_SETTINGS;

export default function GameReviewSettingsModal() {
  return (
    <div className="game-review-settings-overlay" id="gameReviewSettingsOverlay" hidden>
      <div
        className="game-review-settings-modal"
        id="gameReviewSettingsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gameReviewSettingsTitle"
        tabIndex="-1"
      >
        <div className="game-review-settings-header">
          <h2 id="gameReviewSettingsTitle">Settings</h2>
          <button type="button" className="game-review-settings-close" id="gameReviewSettingsClose" aria-label="Close settings">&#215;</button>
        </div>

        <div className="game-review-settings-tabs" role="tablist" aria-label="Settings sections">
          <button type="button" className="game-review-settings-tab active" data-settings-tab="engine" role="tab">
            <span aria-hidden="true">&#9881;</span>
            Engine
          </button>
          <button type="button" className="game-review-settings-tab" data-settings-tab="interface" role="tab">
            <span aria-hidden="true">&#9638;</span>
            Interface
          </button>
          <button type="button" className="game-review-settings-tab" data-settings-tab="board" role="tab">
            <span aria-hidden="true">&#9636;</span>
            Board
          </button>
        </div>

        <div className="game-review-settings-body">
          <section className="game-review-settings-panel active" data-settings-panel="engine">
            <div className="gr-settings-section-title">Engine Analysis</div>
            <SelectSetting id="grsEngineProvider" path="engine.provider" label="Engine Provider" value={defaults.engine.provider} options={optionsFrom('provider', ['browser', 'server', 'auto'])} />
            <SelectSetting id="grsEngineDepth" path="engine.depth" label="Engine Depth" value={defaults.engine.depth} options={optionsFrom('depth', ['8', '10', '12', '14', '16', '18'])} />
            <SelectSetting id="grsEngineMultiPv" path="engine.multiPv" label="MultiPV" value={defaults.engine.multiPv} options={optionsFrom('multiPv', ['1', '2', '3'])} />
            <ToggleSetting id="grsShowEngineLines" path="engine.showEngineLines" label="Show Engine Lines" checked={defaults.engine.showEngineLines} />
            <ToggleSetting id="grsUseOpeningBook" path="engine.useOpeningBook" label="Use Opening Book" checked={defaults.engine.useOpeningBook} />
          </section>

          <section className="game-review-settings-panel" data-settings-panel="interface">
            <div className="game-review-settings-subtabs" role="tablist" aria-label="Interface settings">
              <button type="button" className="game-review-settings-subtab active" data-settings-subtab="analysis">Analysis</button>
              <button type="button" className="game-review-settings-subtab" data-settings-subtab="review">Review</button>
            </div>

            <div className="game-review-settings-subpanel active" data-settings-subpanel="analysis">
              <div className="gr-settings-section-title">Analysis View</div>
              <ToggleSetting id="grsAnalysisSuggestionArrow" path="interface.analysis.suggestionArrow" label="Suggestion Arrow" checked={defaults.interface.analysis.suggestionArrow} />
              <ToggleSetting id="grsAnalysisClassificationBoard" path="interface.analysis.showMoveClassificationOnBoard" label="Show Move Classification On Board" checked={defaults.interface.analysis.showMoveClassificationOnBoard} />
              <ToggleSetting id="grsAnalysisThreats" path="interface.analysis.showThreats" label="Show Threats" checked={defaults.interface.analysis.showThreats} />
              <ToggleSetting id="grsAnalysisHotkeys" path="interface.analysis.useHotkeys" label="Use Hotkeys" checked={defaults.interface.analysis.useHotkeys} />
              <div className="gr-settings-hint">Press <kbd>Shift</kbd> + <kbd>D</kbd> to see all available hotkeys</div>
              <SelectSetting id="grsMoveStrengthColoring" path="interface.analysis.moveStrengthColoring" label="Move Strength Coloring" value={defaults.interface.analysis.moveStrengthColoring} options={optionsFrom('moveStrengthColoring', ['none', 'key', 'all'])} />
            </div>

            <div className="game-review-settings-subpanel" data-settings-subpanel="review">
              <div className="gr-settings-section-title">Review Flow</div>
              <SelectSetting id="grsReviewShowArrows" path="interface.review.showArrows" label="Show Arrows" value={defaults.interface.review.showArrows} options={optionsFrom('showArrows', ['none', 'best', 'played', 'both'])} />
              <SelectSetting id="grsHighlightKeyMovesFor" path="interface.review.highlightKeyMovesFor" label="Highlight Key Moves For" value={defaults.interface.review.highlightKeyMovesFor} options={optionsFrom('highlightKeyMovesFor', ['white', 'black', 'both'])} />
              <ToggleSetting id="grsReviewClassificationBoard" path="interface.review.showMoveClassificationOnBoard" label="Show Move Classification On Board" checked={defaults.interface.review.showMoveClassificationOnBoard} />
              <ToggleSetting id="grsReviewAutoplay" path="interface.review.autoplayShowMoves" label="Autoplay Show Moves" checked={defaults.interface.review.autoplayShowMoves} />
              <SelectSetting id="grsReviewDelay" path="interface.review.delayBetweenMoves" label="Delay Between Moves" value={defaults.interface.review.delayBetweenMoves} options={optionsFrom('delayBetweenMoves', ['500', '1000', '1500', '2000', '3000'])} />
              <ToggleSetting id="grsShowCoachAvatar" path="interface.review.showCoachAvatar" label="Show Coach Avatar" checked={defaults.interface.review.showCoachAvatar} />
              <ToggleSetting id="grsShowCourseRecommendations" path="interface.review.showCourseRecommendations" label="Show Course Recommendations" checked={defaults.interface.review.showCourseRecommendations} />
            </div>
          </section>

          <section className="game-review-settings-panel" data-settings-panel="board">
            <div className="gr-settings-section-title">Board Controls</div>
            <ActionSetting id="grsFlipBoard" label="Board Orientation" actionLabel="Flip board" />
            <SelectSetting id="grsPieces" path="board.pieces" label="Pieces" value={defaults.board.pieces} options={optionsFrom('pieces', ['classic', 'modern', 'gothic', 'neo'])} />
            <SelectSetting id="grsBoard" path="board.board" label="Board" value={defaults.board.board} options={optionsFrom('board', ['green', 'blue', 'brown', 'purple', 'dark'])} />
            <SelectSetting id="grsSoundTheme" path="board.soundTheme" label="Sound Theme" value={defaults.board.soundTheme} options={optionsFrom('soundTheme', ['none', 'classic', 'modern'])} />
            <SelectSetting id="grsCoordinates" path="board.coordinates" label="Coordinates" value={defaults.board.coordinates} options={optionsFrom('coordinates', ['none', 'inside', 'outside'])} />
            <SelectSetting id="grsPieceNotation" path="board.pieceNotation" label="Piece Notation" value={defaults.board.pieceNotation} options={optionsFrom('pieceNotation', ['figurine', 'letters'])} />
            <SelectSetting id="grsMoveClassificationStyle" path="board.moveClassificationStyle" label="Move Classification Style" value={defaults.board.moveClassificationStyle} options={optionsFrom('moveClassificationStyle', ['default', 'compact', 'badge'])} />
            <SelectSetting id="grsPieceAnimations" path="board.pieceAnimations" label="Piece Animations" value={defaults.board.pieceAnimations} options={optionsFrom('pieceAnimations', ['none', 'fast', 'normal', 'slow'])} />
            <ToggleSetting id="grsHighlightMoves" path="board.highlightMoves" label="Highlight Moves" checked={defaults.board.highlightMoves} />
            <ToggleSetting id="grsPlaySounds" path="board.playSounds" label="Play Sounds" checked={defaults.board.playSounds} />
            <ToggleSetting id="grsShowLegalMoves" path="board.showLegalMoves" label="Show Legal Moves" checked={defaults.board.showLegalMoves} />
          </section>
        </div>
      </div>
    </div>
  );
}
