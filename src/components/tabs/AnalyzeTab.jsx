import React from 'react';
import {
  PlayerInfoBar,
  MoveNavigationControls,
  ReviewTabs,
  AccuracySummary,
  MoveQualityBreakdown,
  CriticalMomentsPanel,
  CoachRampPanel,
  AnalysisPanel,
} from '../review/index.jsx';
import { ReviewProgressOverlay } from '../modals/Modals.jsx';
import GameReviewSettingsModal from '../settings/GameReviewSettingsModal.jsx';

export default function AnalyzeTab() {
  return (
    <div className="tab-content" id="tab-analyze">
      <div className="analyze-shell game-review-shell" id="analyzeShell">
        <div className="analyze-layout game-review-layout" id="analyzeContent">
          <section className="board-panel review-board-panel">
            <PlayerInfoBar
              side="black"
              avatar="♜"
              nameId="blackName"
              ratingId="blackRating"
              flagId="blackFlag"
              capturedId="blackCapturedPieces"
              materialId="blackMaterialAdvantage"
              clockId="blackClock"
              defaultName="Black Player"
            />

            <div className="review-board-stage">
              <div className="review-eval-rail" aria-label="Evaluation">
                <span className="review-eval-side">White</span>
                <div className="eval-bar review-eval-bar">
                  <div className="eval-fill eval-fill-white white-fill" id="evalFillWhite"></div>
                  <div className="eval-fill eval-fill-black black-fill" id="evalFillBlack"></div>
                </div>
                <span className="review-eval-side">Black</span>
              </div>

              <div className="review-board-stack">
                <div className="board-wrapper">
                  <div className="board-main">
                    <canvas id="chessBoard" width="640" height="640"></canvas>
                    <div id="boardOverlay" className="board-overlay"></div>
                  </div>
                  <div className="board-coordinates" id="rankCoords"></div>
                </div>
                <div className="board-coordinates coords-file" id="fileCoords"></div>
              </div>
            </div>

            <PlayerInfoBar
              side="white"
              avatar="♖"
              nameId="whiteName"
              ratingId="whiteRating"
              flagId="whiteFlag"
              capturedId="whiteCapturedPieces"
              materialId="whiteMaterialAdvantage"
              clockId="whiteClock"
              defaultName="White Player"
            />
          </section>

          <aside className="analysis-panel review-side-panel">
            <div className="right-analysis-panel">
              <div className="game-review-panel is-empty" id="gameReviewPanel">
                <div className="gr-header review-panel-header">
                  <div>
                    <span className="gr-title">Game Review</span>
                    <span className="review-panel-subtitle">Report, engine lines, and review settings</span>
                  </div>
                  <div className="moves-actions review-panel-actions">
                    <button type="button" className="analysis-settings-btn review-settings-gear" id="reviewSettingsGear" aria-label="Open game review settings">&#9881;</button>
                  </div>
                </div>

                <ReviewTabs />

                <div className="gr-tab-panel" id="grReportPanel" style={{ display: 'none' }}>
                  <CoachRampPanel />
                  <AccuracySummary />
                  <MoveQualityBreakdown />
                  <CriticalMomentsPanel />
                </div>

                <AnalysisPanel />

                <div className="review-panel-footer">
                  <MoveNavigationControls compact />
                </div>
              </div>
              <ReviewProgressOverlay />
            </div>
          </aside>
        </div>
        <GameReviewSettingsModal />
      </div>
    </div>
  );
}
