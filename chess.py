from __future__ import annotations

import io
import json
import math
import os
import shutil
import sys
import time
import uuid
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import threading

# Ensure we import the external `python-chess` package even though this file is named chess.py
_THIS_DIR = Path(__file__).resolve().parent
if sys.path and sys.path[0] == str(_THIS_DIR):
    sys.path.pop(0)
import chess
import chess.engine
import chess.pgn
# Make local modules (e.g., reason_classifier.py) available after pulling in python-chess.
if str(_THIS_DIR) not in sys.path:
    sys.path.append(str(_THIS_DIR))
from reason_classifier import EngineLine as ReasonEngineLine, ReasonClassifier, ReasonResult
from llmreviewer import LLMReviewer
from explanation_engine import ExplanationEngine, ExplanationResult
from context_builder import StockfishEngineWrapper, build_position_context
from positional_context import build_positional_context
sys.path.insert(0, str(_THIS_DIR))
from PySide6.QtCore import QObject, QPoint, QPointF, QRect, QRectF, QSize, Qt, QSettings, QThread, QTimer, Signal, Slot
from PySide6.QtGui import (
    QAction,
    QColor,
    QGuiApplication,
    QKeySequence,
    QMouseEvent,
    QPainter,
    QPainterPath,
    QPen,
    QPixmap,
    QPolygonF,
    QShortcut,
    QStandardItem,
    QStandardItemModel,
)
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QDialog,
    QDialogButtonBox,
    QProgressDialog,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QInputDialog,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QSpinBox,
    QDoubleSpinBox,
    QSplitter,
    QStatusBar,
    QTreeView,
    QVBoxLayout,
    QWidget,
    QLabel,
    QComboBox,
)

from app.ui.sound_manager import SoundManager


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------
WIN_PCT_SCALE = 0.00368208
EP_BEST_MAX = 0.002
EP_EXCELLENT_MAX = 0.02
EP_GOOD_MAX = 0.05
EP_INACCURACY_MAX = 0.10
EP_MISTAKE_MAX = 0.20
EP_BOUNDARIES = [EP_EXCELLENT_MAX, EP_GOOD_MAX, EP_INACCURACY_MAX, EP_MISTAKE_MAX]
EP_BOUNDARY_FUZZ = 0.01
MULTIPV_TOLERANCE = 0.01
GREAT_ONLY_GAP = 0.20
MISS_GAIN_MIN = 0.15
MISS_IF_BEST_AT_LEAST = 0.70
BRILLIANT_MAX_EP_BEFORE = 0.90
ACCURACY_A = 103.1668
ACCURACY_B = -0.04354
ACCURACY_C = -3.1669
BES_TOL_CP = 10  # centipawn tolerance to treat played move as near-best
ACC_DROP_SCALE = 1.3  # moderate penalty on win% drops
MIN_DROP_FOR_ACC = 0.1  # minimum drop (if any loss) to avoid auto-100
GAME_ACC_BLEND_WT = 0.6  # weight on weighted_mean vs harmonic_mean

LABEL_ANALYSIS_TIME = 0.05  # seconds; speed up labeling (aim ~10s per game)
BES_TOL_CP = 0  # tolerance (centipawns) for matching best move exactly
DEEPEN_MULTIPLIER = 1.0

_LABEL_ANALYSIS_CACHE: Dict[Tuple[str, float, int, str], List[dict]] = {}
_LABEL_ANALYSIS_LOCK = threading.Lock()
_LABEL_ENGINE_LOCAL = threading.local()
_LABEL_ENGINE_POOL: List[chess.engine.SimpleEngine] = []
_LABEL_ENGINE_POOL_LOCK = threading.Lock()
_DEBUG_LOG: List[str] = []


def debug_log(msg: str) -> None:
    """Print and store debug lines so users can copy them from the UI."""
    print(msg)
    _DEBUG_LOG.append(msg)
    # Cap in memory to avoid unbounded growth
    if len(_DEBUG_LOG) > 2000:
        del _DEBUG_LOG[: len(_DEBUG_LOG) - 2000]


def _get_label_engine(engine_path: str, threads: int | None = None, hash_size: int | None = None) -> chess.engine.SimpleEngine:
    """Thread-local Stockfish instance for labeling/preload to avoid process churn while allowing parallelism."""
    eng = getattr(_LABEL_ENGINE_LOCAL, "engine", None)
    if eng is not None:
        return eng
    eng = chess.engine.SimpleEngine.popen_uci(engine_path)
    try:
        if threads:
            eng.configure({"Threads": max(1, threads // 2)})  # keep light for parallel instances
        if hash_size:
            eng.configure({"Hash": min(128, hash_size)})  # smaller hash per instance
        eng.configure({"MultiPV": 3})
        eng.configure({"UCI_ShowWDL": True})
    except Exception:
        pass
    _LABEL_ENGINE_LOCAL.engine = eng
    with _LABEL_ENGINE_POOL_LOCK:
        _LABEL_ENGINE_POOL.append(eng)
    return eng


def _shutdown_label_engine() -> None:
    with _LABEL_ENGINE_POOL_LOCK:
        while _LABEL_ENGINE_POOL:
            eng = _LABEL_ENGINE_POOL.pop()
            try:
                eng.quit()
            except Exception:
                pass


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def score_to_cp_or_mate(pov_score: Optional[chess.engine.PovScore]) -> Tuple[Optional[int], Optional[int]]:
    """Return (cp, mate) for a POV score. Caller must pass score.pov(player_color)."""
    if pov_score is None:
        return None, None
    mate = None
    try:
        mate = pov_score.mate()
    except Exception:
            mate = None
    cp = None
    if mate is None:
        try:
            cp_raw = pov_score.score()
            if cp_raw is not None:
                cp = int(cp_raw)
        except Exception:
            try:
                cp_attr = getattr(pov_score, "cp", None)
                if cp_attr is not None:
                    cp = int(cp_attr)
            except Exception:
                cp = None
    return cp, mate


def win_pct_from_score(cp: Optional[int], mate: Optional[int]) -> float:
    """Map cp/mate to win% using Lichess formula; mate>0 => 100, mate<0 => 0."""
    if mate is not None:
        return 100.0 if mate > 0 else 0.0
    if cp is None:
        return 50.0
    win = 50.0 + 50.0 * (2 * (1.0 / (1.0 + math.exp(-WIN_PCT_SCALE * cp))) - 1.0)
    return clamp(win, 0.0, 100.0)


def score_components(score: Optional[chess.engine.PovScore]) -> Tuple[Optional[int], Optional[int]]:
    """Return centipawn score (white POV) and mate score, tolerant of raw Cp values and legacy objects."""
    if score is None:
        return None, None
    try:
        pov_score = score.pov(chess.WHITE)  # type: ignore[attr-defined]
    except Exception:
        try:
            pov_score = chess.engine.PovScore(score, chess.WHITE)  # type: ignore[arg-type]
        except Exception:
            return None, None
    # Some old python-chess versions expose .relative rather than .mate()
    mate = None
    try:
        mate = pov_score.mate()
    except Exception:
        try:
            rel = getattr(pov_score, "relative", None)
            if rel is not None and hasattr(rel, "mate"):
                mate = rel.mate()
        except Exception:
            mate = None
    cp = None
    if mate is None:
        try:
            cp = pov_score.score()
        except Exception:
            try:
                rel = getattr(pov_score, "relative", None)
                if rel is not None and hasattr(rel, "score"):
                    cp = rel.score()
            except Exception:
                cp = None
    return cp, mate


def cp_to_bar_value(cp: float) -> float:
    return 0.5 + 0.5 * math.tanh(cp / 600.0)


def mate_to_bar_value(mate: int) -> float:
    capped = max(-12, min(12, mate))
    direction = 1.0 if capped > 0 else -1.0
    magnitude = 1.0 - math.exp(-abs(capped) / 3.5)
    return 0.5 + 0.5 * direction * magnitude


def score_to_bar_value(score: Optional[chess.engine.PovScore]) -> float:
    cp, mate = score_components(score)
    if mate is not None:
        return mate_to_bar_value(mate)
    if cp is None:
        return 0.5
    return cp_to_bar_value(cp)


def format_score(score: Optional[chess.engine.PovScore]) -> str:
    cp, mate = score_components(score)
    if mate is not None:
        sign = "+" if mate > 0 else "-"
        return f"{sign}M{abs(mate)}"
    if cp is None:
        return "–"
    return f"{cp/100:.2f}"


def _analysis_cache_key(board: chess.Board, limit: chess.engine.Limit, multipv: int = 1, root_move_uci: str = "") -> Tuple[str, float, int, str]:
    return (board.fen(), float(getattr(limit, "time", 0.0) or 0.0), int(multipv), root_move_uci)


def _normalize_infos(info_obj) -> List[dict]:
    infos: List[dict] = info_obj if isinstance(info_obj, list) else [info_obj]
    infos = [inf for inf in infos if isinstance(inf, dict)]
    return sorted(infos, key=lambda d: d.get("multipv", 1))


def _cached_infos(engine: chess.engine.SimpleEngine, board: chess.Board, limit: chess.engine.Limit, multipv: int = 1, root_move: Optional[chess.Move] = None) -> List[dict]:
    root_uci = root_move.uci() if root_move else ""
    key = _analysis_cache_key(board, limit, multipv, root_uci)
    with _LABEL_ANALYSIS_LOCK:
        cached = _LABEL_ANALYSIS_CACHE.get(key)
    if cached is not None:
        return cached
    analyse_kwargs = {"limit": limit, "multipv": multipv}
    if root_move:
        analyse_kwargs["root_moves"] = [root_move]
    info_obj = engine.analyse(board, **analyse_kwargs)
    infos = _normalize_infos(info_obj)
    with _LABEL_ANALYSIS_LOCK:
        _LABEL_ANALYSIS_CACHE[key] = infos
    return infos


def _pov_score(score_raw, player_color: chess.Color) -> Optional[chess.engine.PovScore]:
    """Convert engine score to the mover's POV; never assume side-to-move semantics."""
    if score_raw is None:
        return None
    try:
        return score_raw.pov(player_color)  # type: ignore[attr-defined]
    except Exception:
        try:
            return chess.engine.PovScore(score_raw, player_color)  # type: ignore[arg-type]
        except Exception:
            return None


def _wdl_to_tuple(wdl_obj) -> Optional[Tuple[int, int, int]]:
    if wdl_obj is None:
        return None
    try:
        return (int(wdl_obj[0]), int(wdl_obj[1]), int(wdl_obj[2]))
    except Exception:
        pass
    try:
        return (int(getattr(wdl_obj, "wins")), int(getattr(wdl_obj, "draws")), int(getattr(wdl_obj, "losses")))
    except Exception:
        return None


def _ep_from_info(info: dict, board: chess.Board, player_color: chess.Color) -> Tuple[float, Dict[str, object]]:
    """Compute Expected Points from Stockfish info using WDL if present; fallback to cp/mate -> win%."""
    meta: Dict[str, object] = {}
    score_raw = info.get("score")
    pov = _pov_score(score_raw, player_color)
    cp, mate = score_to_cp_or_mate(pov)
    win_pct = win_pct_from_score(cp, mate)
    meta.update({"cp": cp, "mate": mate, "win_pct": win_pct, "pov_score": pov})
    wdl = _wdl_to_tuple(info.get("wdl"))
    if wdl:
        w, d, l = wdl
        if player_color != board.turn:
            w, l = l, w  # flip POV if engine reported for the opposite side-to-move
        denom = w + d + l
        if denom > 0:
            ep = (w + 0.5 * d) / denom
            meta["wdl"] = (w, d, l)
            return ep, meta
    return win_pct / 100.0, meta


def _stddev(vals: List[float]) -> float:
    if not vals:
        return 0.0
    mean = sum(vals) / len(vals)
    return math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))


def move_accuracy_from_win_drop(drop: float) -> float:
    drop = max(0.0, float(drop))
    return clamp(ACCURACY_A * math.exp(ACCURACY_B * drop) + ACCURACY_C, 0.0, 100.0)


def move_accuracy_from_ep_loss(ep_loss: float) -> float:
    drop = clamp(ep_loss * 100.0 * ACC_DROP_SCALE, 0.0, 200.0)
    return move_accuracy_from_win_drop(drop)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


def move_accuracy_from_label_ep_loss(label: str, ep_loss: float, tags: List[str] | None = None, novelty: bool = False) -> float:
    # Calibrate closer to chess.com-style accuracies: harsher on real blunders, softer on small errors.
    score_map = {
        "Best": 100.0,
        "Excellent": 95.0,
        "Good": 85.0,
        "Inaccuracy": 70.0,
        "Mistake": 45.0,
        "Blunder": 20.0,
        "Novelty": 100.0,
    }
    score = score_map.get(label, 50.0)
    tags = tags or []
    if "Brilliant" in tags:
        score += 5.0
    if "Miss" in tags:
        score -= 10.0
    if novelty:
        score = max(score, 95.0)
    return clamp(score, 0.0, 100.0)


def compute_player_game_accuracy(move_acc: List[float], win_before: List[float], debug: bool = False, label: str = "") -> Optional[float]:
    n = min(len(move_acc), len(win_before))
    if n == 0:
        return None
    acc = [clamp(float(a), 0.0, 100.0) for a in move_acc[:n]]
    win = [clamp(float(w), 0.0, 100.0) for w in win_before[:n]]
    if n == 1:
        return acc[0]
    k = int(round(math.sqrt(n)))
    k = max(3, min(12, k))
    k = min(k, n)

    accum = [0.0 for _ in range(n)]
    counts = [0 for _ in range(n)]
    for start in range(0, n - k + 1):
        window = win[start : start + k]
        v = _stddev(window)
        v = clamp(v, 0.5, 12.0)
        for idx in range(start, start + k):
            accum[idx] += v
            counts[idx] += 1
    weights: List[float] = []
    for a, c in zip(accum, counts):
        if c <= 0:
            weights.append(0.5)
        else:
            weights.append(a / c)
    weight_sum = sum(weights)
    if weight_sum <= 0:
        return None
    weighted_mean = sum(w * a for w, a in zip(weights, acc)) / weight_sum
    eps = 1e-6
    harmonic_mean = n / sum(1.0 / max(a, eps) for a in acc)
    final = clamp((weighted_mean + harmonic_mean) / 2.0, 0.0, 100.0)
    if debug:
        try:
            assert all(0.0 <= w <= 100.0 for w in win)
        except Exception:
            pass
        debug_log(f"[AccuracyDebug][{label}] n={n} k={k} weighted_mean={weighted_mean:.3f} harmonic_mean={harmonic_mean:.3f} final={final:.3f}")
    return final


def compute_player_game_accuracy_label_based(move_scores: List[float], labels: List[str], debug: bool = False, label: str = "") -> Optional[float]:
    n = min(len(move_scores), len(labels))
    if n == 0:
        return None
    scores = [max(clamp(float(s), 0.0, 100.0), 10.0) for s in move_scores[:n]]  # floor to avoid zeroing harmonic mean
    weight_map = {
        "Best": 1.0,
        "Excellent": 1.0,
        "Good": 1.2,
        "Inaccuracy": 1.6,
        "Mistake": 2.0,
        "Blunder": 2.5,
        "Novelty": 1.0,
    }
    weights = [float(weight_map.get(labels[i], 1.0)) for i in range(n)]
    ws = sum(weights)
    if ws <= 0:
        return None
    weighted_mean = sum(weights[i] * scores[i] for i in range(n)) / ws
    eps = 1.0  # keep harmonic mean stable even with low scores
    harmonic_mean = n / sum(1.0 / max(scores[i], eps) for i in range(n))
    final = clamp((weighted_mean + harmonic_mean) / 2.0, 0.0, 100.0)
    if debug:
        debug_log(f"[AccLabelBased][{label}] n={n} weighted_mean={weighted_mean:.3f} harmonic_mean={harmonic_mean:.3f} final={final:.3f}")
    return final


def evaluate_board_ep(
    engine: chess.engine.SimpleEngine,
    board: chess.Board,
    player_color: chess.Color,
    limit: chess.engine.Limit,
    multipv: int = 1,
    root_move: Optional[chess.Move] = None,
) -> Tuple[float, Optional[chess.Move], Dict[str, object], List[dict]]:
    infos = _cached_infos(engine, board, limit, multipv=multipv, root_move=root_move)
    best_info = infos[0] if infos else {}
    pv_moves = best_info.get("pv") or []
    best_move = pv_moves[0] if pv_moves else None
    ep, meta = _ep_from_info(best_info, board, player_color)
    meta.setdefault("pov_score", _pov_score(best_info.get("score"), player_color))
    return ep, best_move, meta, infos


# ---------------------------------------------------------------------------
# Game model with mainline + variation handling
# ---------------------------------------------------------------------------
class PositionSource(Enum):
    MAINLINE = "mainline"
    VARIATION = "variation"


@dataclass
class MoveNode:
    move: Optional[chess.Move]
    san: Optional[str]
    parent: Optional["MoveNode"]
    children: List["MoveNode"] = field(default_factory=list)
    is_mainline: bool = False
    board_fen: str = ""
    comment: str = ""
    nags: List[int] = field(default_factory=list)
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class PositionState:
    board: chess.Board
    last_move: Optional[chess.Move]
    mainline_index: int
    current_source: PositionSource
    current_node: MoveNode


def is_novelty_node(node: Optional[MoveNode]) -> bool:
    """Detect novelty markers from PGN NAGs or explicit comments."""
    if not node:
        return False
    try:
        if chess.pgn.NAG_NOVELTY in getattr(node, "nags", []):
            return True
        comment = getattr(node, "comment", "") or ""
        return "novelty" in comment.lower()
    except Exception:
        return False


class GameModel(QObject):
    positionChanged = Signal(object)  # PositionState
    moveTreeUpdated = Signal(object)  # MoveNode root
    mainlineIndexChanged = Signal(int)

    def __init__(self) -> None:
        super().__init__()
        self.root: MoveNode = MoveNode(None, None, None, [], True, chess.STARTING_FEN)
        self.mainline: List[MoveNode] = [self.root]
        self.mainline_index: int = 0
        self.mainline_pgn_len: int = len(self.mainline)
        self.novelty_anchor_index: Optional[int] = None
        self.current_node: MoveNode = self.root
        self.current_source: PositionSource = PositionSource.MAINLINE
        self.navigate_variation_mode: bool = False
        self.variation_anchor: Optional[MoveNode] = None  # mainline node where a variation branches
        self.moveTreeUpdated.emit(self.root)
        self._emit_position()

    def reset(self, fen: str = chess.STARTING_FEN) -> None:
        board = chess.Board(fen)
        self.root = MoveNode(None, None, None, [], True, board.fen())
        self.mainline = [self.root]
        self.mainline_index = 0
        self.mainline_pgn_len = len(self.mainline)
        self.novelty_anchor_index = None
        self.current_node = self.root
        self.current_source = PositionSource.MAINLINE
        self.navigate_variation_mode = False
        self.variation_anchor = None
        self.moveTreeUpdated.emit(self.root)
        self._emit_position()

    def set_fen(self, fen: str) -> Optional[str]:
        try:
            board = chess.Board(fen)
        except ValueError as exc:
            return str(exc)
        self.reset(board.fen())
        return None

    def load_pgn(self, text: str) -> Optional[str]:
        def _try_parse(blob: str):
            try:
                return chess.pgn.read_game(io.StringIO(blob))
            except Exception:
                return None

        game = _try_parse(text)
        if game is None:
            sanitized = re.sub(r"\([^()]*\)", "", text)
            sanitized = re.sub(r"\{[^{}]*\}", "", sanitized)
            sanitized = "\n".join(ln for ln in sanitized.splitlines() if ln.strip())
            game = _try_parse(sanitized)
        if game is None:
            return "Could not parse PGN: unable to read moves (check for unbalanced parentheses or comments)."
        if game is None:
            return "No PGN game found."

        board = game.board()
        self.root = MoveNode(None, None, None, [], True, board.fen())
        self.mainline = [self.root]
        self.mainline_index = 0
        self.mainline_pgn_len = len(self.mainline)
        self.novelty_anchor_index = None
        self.current_node = self.root
        self.current_source = PositionSource.MAINLINE
        self.navigate_variation_mode = False
        self.variation_anchor = None

        self._build_nodes(self.root, game, board, is_mainline_path=True)
        self.mainline_pgn_len = len(self.mainline)
        self.novelty_anchor_index = None
        self.moveTreeUpdated.emit(self.root)
        self._emit_position()
        return None

    def play_move(self, move: chess.Move) -> bool:
        base_node = self.current_node if self.navigate_variation_mode else self.mainline[self.mainline_index]
        base_board = chess.Board(base_node.board_fen)
        if move not in base_board.legal_moves:
            return False
        san = base_board.san(move)
        base_board.push(move)
        parent_idx = self.mainline_index
        target = self._find_child(base_node, move)
        if target:
            self.current_node = target
            if target.is_mainline:
                self.current_source = PositionSource.MAINLINE
                self.mainline_index = self.mainline.index(target)
                self.mainlineIndexChanged.emit(self.mainline_index)
                self._exit_variation_mode()
            else:
                self.current_source = PositionSource.VARIATION
                if self.novelty_anchor_index is None:
                    try:
                        anchor_node = self._mainline_ancestor(target) or base_node
                        self.novelty_anchor_index = self.mainline.index(anchor_node)
                    except Exception:
                        self.novelty_anchor_index = None
                self._enter_variation_mode(self.current_node)
        else:
            make_mainline = (
                base_node.is_mainline and self.current_source == PositionSource.MAINLINE and not self.navigate_variation_mode
            )
            new_node = MoveNode(
                move=move,
                san=san,
                parent=base_node,
                children=[],
                is_mainline=make_mainline,
                board_fen=base_board.fen(),
            )
            base_node.children.append(new_node)
            self.current_node = new_node
            if make_mainline:
                self.mainline.append(new_node)
                self.mainline_index = len(self.mainline) - 1
                if self.novelty_anchor_index is None:
                    # Branch point is the position before this move (parent_idx)
                    self.novelty_anchor_index = parent_idx
                self.current_source = PositionSource.MAINLINE
                self.mainlineIndexChanged.emit(self.mainline_index)
                self._exit_variation_mode()
            else:
                self.current_source = PositionSource.VARIATION
                if self.novelty_anchor_index is None:
                    try:
                        anchor_node = self._mainline_ancestor(new_node) or base_node
                        self.novelty_anchor_index = self.mainline.index(anchor_node)
                    except Exception:
                        self.novelty_anchor_index = None
                self._enter_variation_mode(self.current_node)
        self.moveTreeUpdated.emit(self.root)
        self._emit_position()
        return True

    def set_mainline_index(self, index: int) -> None:
        clamped = max(0, min(index, len(self.mainline) - 1))
        self.mainline_index = clamped
        self.current_node = self.mainline[self.mainline_index]
        self.current_source = PositionSource.MAINLINE
        self._exit_variation_mode()
        self.mainlineIndexChanged.emit(self.mainline_index)
        self._emit_position()

    def step_mainline(self, delta: int) -> None:
        self.set_mainline_index(self.mainline_index + delta)

    def step(self, delta: int) -> None:
        if self.navigate_variation_mode and self.current_source == PositionSource.VARIATION:
            if self._step_variation(delta):
                return
        if self.navigate_variation_mode and self.current_source == PositionSource.MAINLINE and self.variation_anchor:
            anchor = self.variation_anchor
            if delta > 0 and self.current_node is anchor:
                child = self._first_variation_child(anchor)
                if child:
                    self.current_node = child
                    self.current_source = PositionSource.VARIATION
                    self._emit_position()
                    return
            if delta < 0 and self.current_node is anchor:
                self._exit_variation_mode()
                self.step_mainline(delta)
                return
        self.step_mainline(delta)

    def goto_start(self) -> None:
        self.set_mainline_index(0)

    def goto_end(self) -> None:
        self.set_mainline_index(len(self.mainline) - 1)

    def select_node(self, node: MoveNode, follow_variation: bool = False) -> None:
        self.current_node = node
        if node.is_mainline:
            self.mainline_index = self.mainline.index(node)
            self.current_source = PositionSource.MAINLINE
            self._exit_variation_mode()
            self.mainlineIndexChanged.emit(self.mainline_index)
        else:
            self.current_source = PositionSource.VARIATION
            if follow_variation:
                self._enter_variation_mode(node)
        self._emit_position()

    def toggle_variation_navigation(self, enabled: bool) -> None:
        self.navigate_variation_mode = enabled
        if not enabled:
            self.variation_anchor = None

    def export_pgn(self) -> str:
        game = chess.pgn.Game()
        root_board = chess.Board(self.root.board_fen)
        if self.root.board_fen != chess.STARTING_FEN:
            game.setup(root_board)
            game.headers["FEN"] = root_board.board_fen()
        self._append_variations(game, self.root)
        exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
        return game.accept(exporter)

    def current_board(self) -> chess.Board:
        return chess.Board(self.current_node.board_fen)

    def current_fen(self) -> str:
        return self.current_node.board_fen

    def _find_child(self, node: MoveNode, move: chess.Move) -> Optional[MoveNode]:
        for child in node.children:
            if child.move == move:
                return child
        return None

    def _build_nodes(self, parent_node: MoveNode, game_node: chess.pgn.ChildNode, board: chess.Board, is_mainline_path: bool) -> None:
        for idx, child in enumerate(game_node.variations):
            move = child.move
            san = board.san(move)
            board.push(move)
            child_is_mainline = is_mainline_path and idx == 0
            new_node = MoveNode(
                move=move,
                san=san,
                parent=parent_node,
                children=[],
                is_mainline=child_is_mainline,
                board_fen=board.fen(),
                comment=child.comment or "",
                nags=list(child.nags),
            )
            parent_node.children.append(new_node)
            if child_is_mainline:
                self.mainline.append(new_node)
            self._build_nodes(new_node, child, board, child_is_mainline)
            board.pop()

    def _append_variations(self, game_node: chess.pgn.ChildNode, model_node: MoveNode) -> None:
        for child in model_node.children:
            new_child = game_node.add_variation(child.move, comment=child.comment, nags=set(child.nags))
            self._append_variations(new_child, child)

    def _step_variation(self, delta: int) -> bool:
        if delta > 0 and self.current_node.children:
            self.current_node = self.current_node.children[0]
            self.current_source = PositionSource.VARIATION if not self.current_node.is_mainline else PositionSource.MAINLINE
            if self.current_node.is_mainline:
                self.mainline_index = self.mainline.index(self.current_node)
                self.mainlineIndexChanged.emit(self.mainline_index)
            self._emit_position()
            return True
        if delta < 0 and self.current_node.parent:
            self.current_node = self.current_node.parent
            self.current_source = PositionSource.VARIATION if not self.current_node.is_mainline else PositionSource.MAINLINE
            if self.current_node.is_mainline:
                self.mainline_index = self.mainline.index(self.current_node)
                self.mainlineIndexChanged.emit(self.mainline_index)
            self._emit_position()
            return True
        return False

    def _mainline_ancestor(self, node: MoveNode) -> Optional[MoveNode]:
        cur = node.parent
        while cur:
            if cur.is_mainline:
                return cur
            cur = cur.parent
        return None

    def _enter_variation_mode(self, node: MoveNode) -> None:
        self.navigate_variation_mode = True
        self.variation_anchor = self._mainline_ancestor(node)

    def _exit_variation_mode(self) -> None:
        self.navigate_variation_mode = False
        self.variation_anchor = None

    def _first_variation_child(self, node: MoveNode) -> Optional[MoveNode]:
        for child in node.children:
            if not child.is_mainline:
                return child
        return None

    def _emit_position(self) -> None:
        state = PositionState(
            board=self.current_board(),
            last_move=self.current_node.move,
            mainline_index=self.mainline_index,
            current_source=self.current_source,
            current_node=self.current_node,
        )
        self.positionChanged.emit(state)


# ---------------------------------------------------------------------------
# Engine management (Stockfish via python-chess)
# ---------------------------------------------------------------------------
def _default_stockfish_path() -> Optional[str]:
    env_path = os.environ.get("STOCKFISH_PATH")
    candidates = [
        env_path,
        "/opt/homebrew/bin/stockfish",
        "/usr/local/bin/stockfish",
        shutil.which("stockfish"),
    ]
    for path in candidates:
        if path and Path(path).exists():
            return path
    return None


class AnalysisMode:
    INFINITE = "infinite"
    LIMITED = "limited"


@dataclass
class EngineSettings:
    engine_path: Optional[str] = _default_stockfish_path()
    threads: int = max(1, os.cpu_count() or 4)
    hash_size: int = 256
    multipv: int = 5
    analysis_mode: str = AnalysisMode.INFINITE
    limited_time: float = 0.1
    infinite_time: float = 3.0


@dataclass
class EngineLine:
    score: Optional[chess.engine.PovScore]
    cp: Optional[int]
    mate: Optional[int]
    depth: Optional[int]
    nodes: Optional[int]
    nps: Optional[int]
    pv_moves: List[chess.Move] = field(default_factory=list)
    pv_san: str = ""
    pv_uci: str = ""
    multipv: int = 1


_PIECE_VALUES = {
    chess.PAWN: 1.0,
    chess.KNIGHT: 3.0,
    chess.BISHOP: 3.0,
    chess.ROOK: 5.0,
    chess.QUEEN: 9.0,
}
_FILE_NAMES = "abcdefgh"


def _pv_excerpt(board: chess.Board, moves: List[chess.Move], min_plies: int = 6, max_plies: int = 10) -> str:
    tmp = board.copy()
    sans: List[str] = []
    for mv in moves:
        if len(sans) >= max_plies:
            break
        try:
            sans.append(tmp.san(mv))
        except Exception:
            sans.append(mv.uci())
        tmp.push(mv)
    if len(sans) < min_plies:
        for mv in moves[len(sans) :]:
            if len(sans) >= min_plies or len(sans) >= max_plies:
                break
            try:
                sans.append(tmp.san(mv))
            except Exception:
                sans.append(mv.uci())
            tmp.push(mv)
    return " ".join(sans)


def _material_diff(board: chess.Board, color: bool) -> float:
    own = sum(_PIECE_VALUES.get(p.piece_type, 0.0) for p in board.piece_map().values() if p.color == color)
    opp = sum(_PIECE_VALUES.get(p.piece_type, 0.0) for p in board.piece_map().values() if p.color != color)
    return own - opp


def _value_label(delta: float) -> str:
    val = abs(delta)
    if val >= 8:
        return "a queen"
    if val >= 5:
        return "a rook"
    if val >= 3:
        return "a minor piece"
    if val >= 2:
        return "two pawns"
    return "a pawn"


def _pawn_structure(board: chess.Board, color: bool) -> Dict[str, object]:
    pawns = [sq for sq, piece in board.piece_map().items() if piece.piece_type == chess.PAWN and piece.color == color]
    files = sorted({chess.square_file(sq) for sq in pawns})
    isolated = {f for f in files if (f - 1) not in files and (f + 1) not in files}
    counts: Dict[int, int] = {}
    for sq in pawns:
        f = chess.square_file(sq)
        counts[f] = counts.get(f, 0) + 1
    doubled = {f for f, c in counts.items() if c > 1}
    islands = 0
    prev = None
    for f in files:
        if prev is None or f - prev > 1:
            islands += 1
        prev = f
    backward: set[int] = set()
    for sq in pawns:
        f = chess.square_file(sq)
        r = chess.square_rank(sq)
        if color == chess.WHITE:
            support = [psq for psq in pawns if chess.square_file(psq) in (f - 1, f + 1) and chess.square_rank(psq) < r]
        else:
            support = [psq for psq in pawns if chess.square_file(psq) in (f - 1, f + 1) and chess.square_rank(psq) > r]
        if not support:
            backward.add(f)
    return {"isolated": isolated, "doubled": doubled, "islands": islands, "backward": backward}


def _king_shield(board: chess.Board, color: bool) -> int:
    king_sq = board.king(color)
    if king_sq is None:
        return 0
    file = chess.square_file(king_sq)
    rank = chess.square_rank(king_sq)
    direction = 1 if color == chess.WHITE else -1
    shield = 0
    for df in (-1, 0, 1):
        for dr in (1, 2):
            rf = file + df
            rr = rank + dr * direction
            if 0 <= rf <= 7 and 0 <= rr <= 7:
                sq = chess.square(rf, rr)
                piece = board.piece_at(sq)
                if piece and piece.piece_type == chess.PAWN and piece.color == color:
                    shield += 1
    return shield


def _detect_forced_mate(board: chess.Board, best_line: EngineLine, pv_text: str) -> Optional[str]:
    if best_line.mate is not None:
        mate_in = abs(best_line.mate)
        return f"Forced mate in {mate_in}; checks seal the king. PV: {pv_text}"
    tmp = board.copy()
    checks_by_best = 0
    for idx, mv in enumerate(best_line.pv_moves[:6]):
        tmp.push(mv)
        mover_is_best = idx % 2 == 0
        if mover_is_best and tmp.is_check():
            checks_by_best += 1
        elif mover_is_best:
            break
        if checks_by_best >= 2:
            return f"Line opens with forcing checks that limit replies. PV: {pv_text}"
    return None


def _detect_material(board: chess.Board, best_line: EngineLine, pv_text: str, window: int = 6) -> Optional[str]:
    mover = board.turn
    base = _material_diff(board, mover)
    tmp = board.copy()
    for idx, mv in enumerate(best_line.pv_moves[:window]):
        tmp.push(mv)
        delta = _material_diff(tmp, mover) - base
        if abs(delta) >= 1.0:
            direction = "wins" if delta > 0 else "loses"
            return f"This {direction} {_value_label(delta)} within {idx + 1} ply. PV: {pv_text}"
    return None


def _detect_hanging(board: chess.Board, best_line: EngineLine, pv_text: str) -> Optional[str]:
    if not best_line.pv_moves:
        return None
    mover = board.turn
    opponent = not mover
    tmp = board.copy()
    tmp.push(best_line.pv_moves[0])
    for sq, piece in tmp.piece_map().items():
        if piece.color != opponent:
            continue
        attackers = len(tmp.attackers(mover, sq))
        defenders = len(tmp.attackers(opponent, sq))
        if attackers > defenders and (_PIECE_VALUES.get(piece.piece_type, 0) >= 2 or defenders == 0):
            piece_name = chess.piece_name(piece.piece_type)
            return f"Targets an under-defended {piece_name} on {chess.square_name(sq)}. PV: {pv_text}"
    return None


def _detect_fork_or_pin(board: chess.Board, best_line: EngineLine, pv_text: str) -> Optional[str]:
    if not best_line.pv_moves:
        return None
    mover = board.turn
    opponent = not mover
    tmp = board.copy()
    tmp.push(best_line.pv_moves[0])
    for sq, piece in tmp.piece_map().items():
        if piece.color != mover:
            continue
        targets = [
            t
            for t in tmp.attacks(sq)
            if (p := tmp.piece_at(t)) and p.color == opponent and _PIECE_VALUES.get(p.piece_type, 0) >= 3
        ]
        if len(targets) >= 2:
            names = [chess.square_name(t) for t in targets[:2]]
            piece_name = chess.piece_name(piece.piece_type).capitalize()
            return f"{piece_name} on {chess.square_name(sq)} forks {', '.join(names)}. PV: {pv_text}"
    for sq, piece in tmp.piece_map().items():
        if piece.color != opponent:
            continue
        if tmp.is_pinned(opponent, sq):
            pinned_name = chess.piece_name(piece.piece_type)
            return f"Pins the {pinned_name} on {chess.square_name(sq)} to the king. PV: {pv_text}"
    return None


def _detect_pawn_structure(board: chess.Board, best_line: EngineLine, pv_text: str) -> Optional[str]:
    if not best_line.pv_moves:
        return None
    mover = board.turn
    opponent = not mover
    before_m = _pawn_structure(board, mover)
    before_o = _pawn_structure(board, opponent)
    tmp = board.copy()
    tmp.push(best_line.pv_moves[0])
    after_m = _pawn_structure(tmp, mover)
    after_o = _pawn_structure(tmp, opponent)

    new_isolated = after_o["isolated"] - before_o["isolated"]
    if new_isolated:
        file_idx = sorted(new_isolated)[0]
        return f"Creates isolated pawn on {_FILE_NAMES[file_idx]}-file for the opponent. PV: {pv_text}"
    new_doubled = after_o["doubled"] - before_o["doubled"]
    if new_doubled:
        file_idx = sorted(new_doubled)[0]
        return f"Line forces doubled pawns on {_FILE_NAMES[file_idx]}-file. PV: {pv_text}"
    islands_drop = before_m["islands"] - after_m["islands"]
    if islands_drop > 0:
        return f"Improves pawn structure by reducing islands from {before_m['islands']} to {after_m['islands']}. PV: {pv_text}"
    new_backward = after_o["backward"] - before_o["backward"]
    if new_backward:
        file_idx = sorted(new_backward)[0]
        return f"Leaves opponent with a backward pawn on {_FILE_NAMES[file_idx]}-file. PV: {pv_text}"
    return None


def _signed_cp(line: EngineLine, color: bool) -> Optional[int]:
    if line.cp is None:
        return None
    return line.cp if color == chess.WHITE else -line.cp


def _detect_king_safety(board: chess.Board, best_line: EngineLine, pv_text: str, lines: List[EngineLine]) -> Optional[str]:
    if not best_line.pv_moves:
        return None
    mover = board.turn
    opponent = not mover
    before_shield = _king_shield(board, opponent)
    tmp = board.copy()
    tmp.push(best_line.pv_moves[0])
    after_shield = _king_shield(tmp, opponent)
    cp_signed = _signed_cp(best_line, mover)
    eval_support = (cp_signed is not None and cp_signed >= 80) or best_line.mate is not None
    if after_shield < before_shield and eval_support:
        return f"Damages king safety by stripping pawn cover ({before_shield}→{after_shield}). PV: {pv_text}"
    king_sq = board.king(opponent)
    if king_sq is None:
        return None
    king_file = chess.square_file(king_sq)
    first_move = best_line.pv_moves[0]
    to_file = chess.square_file(first_move.to_square)
    if abs(to_file - king_file) <= 1 and eval_support:
        return f"Opens lines near the king; main threat runs on adjacent files. PV: {pv_text}"
    return None


def build_coach_explanations(board: chess.Board, lines: List[EngineLine]) -> List[str]:
    return []


@dataclass
class EngineResult:
    fen: str
    lines: List[EngineLine]
    best_move: Optional[chess.Move]
    bar_value: float
    display_score: str
    coach_lines: List[str] = field(default_factory=list)


class EngineWorker(QObject):
    analysisUpdated = Signal(int, object)  # request_id, EngineResult
    engineCrashed = Signal(str)
    ready = Signal()
    contextReady = Signal(int, str, object)  # request_id, node_uid, context

    def __init__(self, settings: EngineSettings) -> None:
        super().__init__()
        self.settings = settings
        self.engine: Optional[chess.engine.SimpleEngine] = None
        self.current_analysis = None
        self.analysis_lock = threading.Lock()
        self.active_request_id: Optional[int] = None

    @Slot(object)
    def update_settings(self, settings: EngineSettings) -> None:
        self.settings = settings
        self._restart_engine()

    @Slot()
    def start_engine(self) -> None:
        self._restart_engine()

    @Slot()
    def stop(self) -> None:
        with self.analysis_lock:
            if self.current_analysis:
                try:
                    self.current_analysis.stop()
                except Exception:
                    pass
                self.current_analysis = None

    @Slot()
    def shutdown(self) -> None:
        self.stop()
        if self.engine:
            try:
                self.engine.quit()
            except Exception:
                pass
            self.engine = None

    @Slot(int, str, bool)
    def analyse(self, request_id: int, fen: str, fast: bool = False) -> None:
        if not self._ensure_engine():
            self.engineCrashed.emit("Stockfish path is not configured or invalid.")
            return
        board = chess.Board(fen)
        limit = self._limit_for_mode(fast)
        use_multipv = max(5, self.settings.multipv)
        with self.analysis_lock:
            if self.current_analysis:
                try:
                    self.current_analysis.stop()
                except Exception:
                    pass
            self.active_request_id = request_id
            self.current_analysis = None

        lines: Dict[int, EngineLine] = {}
        try:
            with self.engine.analysis(board, limit=limit, multipv=use_multipv) as analysis:
                with self.analysis_lock:
                    self.current_analysis = analysis
                for info in analysis:
                    if self.active_request_id != request_id:
                        break
                    line = self._info_to_line(board, info)
                    if line:
                        lines[line.multipv] = line
                        result = self._result_from_lines(board, fen, lines)
                        self.analysisUpdated.emit(request_id, result)
                final_info = analysis.wait()
                if final_info and self.active_request_id == request_id:
                    line = self._info_to_line(board, final_info)
                    if line:
                        lines[line.multipv] = line
                        result = self._result_from_lines(board, fen, lines)
                        self.analysisUpdated.emit(request_id, result)
        except (chess.engine.EngineTerminatedError, FileNotFoundError) as exc:
            self.engineCrashed.emit(str(exc))
            self.engine = None
        except Exception as exc:  # pragma: no cover
            self.engineCrashed.emit(str(exc))
        finally:
            with self.analysis_lock:
                self.current_analysis = None

    def _limit_for_mode(self, fast: bool) -> chess.engine.Limit:
        if fast or self.settings.analysis_mode == AnalysisMode.LIMITED:
            return chess.engine.Limit(time=self.settings.limited_time)
        return chess.engine.Limit(time=self.settings.infinite_time)

    def _ensure_engine(self) -> bool:
        if self.engine:
            return True
        if not self.settings.engine_path or not Path(self.settings.engine_path).exists():
            return False
        use_multipv = max(5, self.settings.multipv)
        try:
            self.engine = chess.engine.SimpleEngine.popen_uci(self.settings.engine_path)
            try:
                self.engine.configure({"Threads": self.settings.threads, "Hash": self.settings.hash_size})
            except Exception:
                pass
            try:
                self.engine.configure({"MultiPV": use_multipv})
            except (chess.engine.EngineError, ValueError):
                # Some Stockfish builds manage MultiPV internally; fall back to 1.
                self.settings.multipv = 3
            try:
                self.engine.configure({"UCI_ShowWDL": True})
            except Exception:
                pass
            self.ready.emit()
            return True
        except Exception as exc:  # pragma: no cover
            self.engine = None
            self.engineCrashed.emit(str(exc))
            return False

    def _restart_engine(self) -> None:
        if self.engine:
            try:
                self.engine.quit()
            except Exception:
                pass
            self.engine = None
        self._ensure_engine()

    def _info_to_line(self, board: chess.Board, info) -> Optional[EngineLine]:
        if not hasattr(info, "get"):
            return None
        pv = info.get("pv")
        if not pv:
            return None
        depth = info.get("depth")
        nodes = info.get("nodes")
        nps = info.get("nps")
        score_raw = info.get("score")
        pov_score = None
        if score_raw:
            if hasattr(score_raw, "pov"):
                pov_score = score_raw.pov(chess.WHITE)
            else:
                try:
                    pov_score = chess.engine.PovScore(score_raw, chess.WHITE)
                except Exception:
                    pov_score = None
        cp, mate = score_components(pov_score)
        pv_san = self._pv_to_san(board, pv)
        pv_uci = " ".join(move.uci() for move in pv)
        multipv = info.get("multipv", 1)
        return EngineLine(
            score=pov_score,
            cp=cp,
            mate=mate,
            depth=depth,
            nodes=nodes,
            nps=nps,
            pv_moves=list(pv),
            pv_san=pv_san,
            pv_uci=pv_uci,
            multipv=multipv,
        )

    def _pv_to_san(self, board: chess.Board, pv: List[chess.Move]) -> str:
        tmp = board.copy()
        sans: List[str] = []
        for move in pv:
            sans.append(tmp.san(move))
            tmp.push(move)
        return " ".join(sans)

    def _result_from_lines(self, board: chess.Board, fen: str, lines: Dict[int, EngineLine]) -> EngineResult:
        ordered = [lines[k] for k in sorted(lines.keys())]
        best_move = ordered[0].pv_moves[0] if ordered and ordered[0].pv_moves else None
        score = ordered[0].score if ordered else None
        bar_value = score_to_bar_value(score)
        display_score = format_score(score)
        coach_lines: List[str] = []
        return EngineResult(
            fen=fen,
            lines=ordered,
            best_move=best_move,
            bar_value=bar_value,
            display_score=display_score,
            coach_lines=coach_lines,
        )

    @Slot(int, str, object, float, int, str)
    def build_context(self, request_id: int, fen: str, played_move_uci: object, time_limit_s: float, multipv: int, node_uid: str) -> None:
        if not self._ensure_engine():
            self.engineCrashed.emit("Stockfish path is not configured or invalid.")
            return
        try:
            with self.analysis_lock:
                if self.current_analysis:
                    try:
                        self.current_analysis.stop()
                    except Exception:
                        pass
                    self.current_analysis = None
                engine_obj = self.engine
                if engine_obj is None:
                    self.engineCrashed.emit("Engine unavailable.")
                    return
                wrapper = StockfishEngineWrapper(engine_obj)
                context = build_position_context(fen, wrapper, played_move_uci if isinstance(played_move_uci, str) else None, time_limit_s, multipv)
            self.contextReady.emit(request_id, node_uid, context)
        except Exception as exc:
            self.engineCrashed.emit(str(exc))


class EngineManager(QObject):
    analysisReady = Signal(object)  # EngineResult
    engineError = Signal(str)
    statusChanged = Signal(str)
    contextReady = Signal(int, str, object)  # request_id, node_uid, context

    requestAnalysis = Signal(int, str, bool)  # request_id, fen, fast
    requestStop = Signal()
    requestSettings = Signal(object)
    requestShutdown = Signal()
    requestContext = Signal(int, str, object, float, int, str)  # request_id, fen, played_move_uci, time_limit_s, multipv, node_uid

    def __init__(self, settings: Optional[EngineSettings] = None) -> None:
        super().__init__()
        self.settings = settings or EngineSettings()
        self.thread = QThread()
        self.worker = EngineWorker(self.settings)
        self.worker.moveToThread(self.thread)

        self.requestAnalysis.connect(self.worker.analyse, Qt.QueuedConnection)
        self.requestStop.connect(self.worker.stop, Qt.QueuedConnection)
        self.requestSettings.connect(self.worker.update_settings, Qt.QueuedConnection)
        self.requestShutdown.connect(self.worker.shutdown, Qt.QueuedConnection)
        self.requestContext.connect(self.worker.build_context, Qt.QueuedConnection)
        self.thread.started.connect(self.worker.start_engine)
        self.worker.analysisUpdated.connect(self._handle_result, Qt.QueuedConnection)
        self.worker.engineCrashed.connect(self._handle_engine_error, Qt.QueuedConnection)
        self.worker.contextReady.connect(self._handle_context_ready, Qt.QueuedConnection)
        self.thread.start()

        self.last_results: Dict[str, EngineResult] = {}
        self.request_id = 0

    def shutdown(self) -> None:
        self.requestShutdown.emit()
        self.thread.quit()
        self.thread.wait(2000)

    def update_settings(self, settings: EngineSettings) -> None:
        self.settings = settings
        self.requestSettings.emit(settings)

    def request(self, board: chess.Board, fast: bool = False) -> None:
        self.request_id += 1
        fen = board.fen()
        self.requestAnalysis.emit(self.request_id, fen, fast)
        if fen in self.last_results:
            self.analysisReady.emit(self.last_results[fen])

    def stop(self) -> None:
        self.requestStop.emit()

    @Slot(int, object)
    def _handle_result(self, request_id: int, result: EngineResult) -> None:
        self.last_results[result.fen] = result
        self.analysisReady.emit(result)

    @Slot(str)
    def _handle_engine_error(self, message: str) -> None:
        self.engineError.emit(message)
        self.statusChanged.emit("Engine unavailable: " + message)

    @Slot(int, str, object)
    def _handle_context_ready(self, request_id: int, node_uid: str, context: object) -> None:
        self.contextReady.emit(request_id, node_uid, context)

    def request_position_context(self, fen: str, played_move_uci: Optional[str], time_limit_s: float, multipv: int, node_uid: str) -> int:
        self.request_id += 1
        self.requestContext.emit(self.request_id, fen, played_move_uci, time_limit_s, multipv, node_uid)
        return self.request_id


# ---------------------------------------------------------------------------
# Move classification worker (async to avoid blocking UI)
# ---------------------------------------------------------------------------
@dataclass
class MoveEPDiagnostics:
    ply: int
    san: str
    uci: str
    label: str
    ep_before: float
    ep_after: float
    ep_after_best: float
    ep_loss: float
    miss_gain: float
    move_accuracy: float
    win_before_pct: float
    win_after_pct: float
    win_after_best_pct: float
    win_drop_pct: float
    best_move: Optional[str]
    pv_moves: List[str]
    ep_pv: Dict[str, float]
    eval_payloads: Dict[str, Dict[str, object]]
    flags: Dict[str, bool] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)


def _label_from_ep_loss(ep_loss: float) -> str:
    if ep_loss <= EP_BEST_MAX:
        return "Best"
    if ep_loss <= EP_EXCELLENT_MAX:
        return "Excellent"
    if ep_loss <= EP_GOOD_MAX:
        return "Good"
    if ep_loss <= EP_INACCURACY_MAX:
        return "Inaccuracy"
    if ep_loss <= EP_MISTAKE_MAX:
        return "Mistake"
    return "Blunder"


def _is_near_boundary(ep_loss: float) -> bool:
    for b in EP_BOUNDARIES:
        if abs(ep_loss - b) <= EP_BOUNDARY_FUZZ:
            return True
    return False


def _material_score(board: chess.Board, color: chess.Color) -> float:
    return sum(_PIECE_VALUES.get(p.piece_type, 0.0) for p in board.piece_map().values() if p.color == color)


def _is_sacrifice(board_before: chess.Board, board_after: chess.Board, mover: chess.Color) -> bool:
    return (_material_score(board_after, mover) - _material_score(board_before, mover)) <= -1.0


def compute_move_ep_diagnostics(
    engine: chess.engine.SimpleEngine,
    board_before: chess.Board,
    move: chess.Move,
    limit: chess.engine.Limit,
    best_hint: Optional[chess.Move] = None,
) -> Tuple[MoveEPDiagnostics, Optional[chess.Move]]:
    player_color = board_before.turn
    base_limit = chess.engine.Limit(time=LABEL_ANALYSIS_TIME)

    ep_before, best_move, before_meta, infos_before = evaluate_board_ep(engine, board_before, player_color, base_limit, multipv=2)
    pv_first = infos_before[0].get("pv", [None])[0] if infos_before else None
    # Prefer PV first move as the engine's best
    if pv_first:
        best_move = pv_first
    elif best_hint and not best_move:
        best_move = best_hint

    move_set = {move}
    if best_move:
        move_set.add(best_move)

    eval_payloads: Dict[str, Dict[str, object]] = {"before": {"meta": before_meta, "ep": ep_before}}
    ep_after_map: Dict[str, float] = {}

    def _ep_after_for_move(mv: chess.Move, use_limit: chess.engine.Limit) -> Tuple[float, Dict[str, object]]:
        board = board_before.copy(stack=False)
        board.push(mv)
        ep_val, _, meta, _ = evaluate_board_ep(engine, board, player_color, use_limit, multipv=1)
        eval_payloads[mv.uci()] = {"meta": meta, "ep": ep_val}
        return ep_val, meta

    # Evaluate played and best only
    for mv in list(move_set):
        ep_val, _ = _ep_after_for_move(mv, base_limit)
        ep_after_map[mv.uci()] = ep_val

    ep_after_played = ep_after_map.get(move.uci(), ep_before)
    ep_after_best = ep_after_map.get(best_move.uci(), ep_before) if best_move else ep_before

    ep_loss = max(0.0, ep_after_best - ep_after_played)
    miss_gain = ep_after_best - ep_after_played

    # Skip deepening to keep labeling fast.

    base_label = _label_from_ep_loss(ep_loss) if best_move else "Good"
    # If played move equals engine PV0, force Best; otherwise no tolerance (BES_TOL_CP=0).
    if best_move and move == best_move:
        base_label = "Best"
    pv_ucis: List[str] = []

    # MultiPV tolerance
    # (disable tolerance auto-upgrade; rely on ep_loss thresholds)

    tags: List[str] = []
    flags: Dict[str, bool] = {}

    if miss_gain >= MISS_GAIN_MIN and ep_after_best >= MISS_IF_BEST_AT_LEAST:
        tags.append("Miss")
        flags["miss"] = True

    # Brilliant: near-best + sacrifice + trailing position
    played_board = board_before.copy(stack=False)
    played_board.push(move)
    if base_label in ("Best", "Excellent") and ep_before < BRILLIANT_MAX_EP_BEFORE and _is_sacrifice(board_before, played_board, player_color):
        tags.append("Brilliant")
        flags["brilliant"] = True

    win_before_pct = float(before_meta.get("win_pct", ep_before * 100.0))
    played_meta = eval_payloads.get(move.uci(), {}).get("meta", {})
    win_after_pct = float(played_meta.get("win_pct", ep_after_played * 100.0))
    best_pct = win_before_pct
    if best_move:
        best_meta = eval_payloads.get(best_move.uci(), {}).get("meta", {})
        best_pct = float(best_meta.get("win_pct", ep_after_best * 100.0))
    win_drop = max(0.0, win_before_pct - win_after_pct)
    novelty = False
    move_accuracy = move_accuracy_from_label_ep_loss(base_label, ep_loss, tags=tags, novelty=novelty)

    diag = MoveEPDiagnostics(
        ply=board_before.ply(),
        san=board_before.san(move),
        uci=move.uci(),
        label=base_label,
        ep_before=ep_before,
        ep_after=ep_after_played,
        ep_after_best=ep_after_best,
        ep_loss=ep_loss,
        miss_gain=miss_gain,
        move_accuracy=move_accuracy,
        win_before_pct=win_before_pct,
        win_after_pct=win_after_pct,
        win_after_best_pct=best_pct,
        win_drop_pct=win_drop,
        best_move=best_move.uci() if best_move else None,
        pv_moves=pv_ucis,
        ep_pv={},
        eval_payloads=eval_payloads,
        flags=flags,
        tags=tags,
    )
    return diag, best_move


class MoveLabelWorker(QObject):
    finished = Signal(str, object)  # node_uid, MoveEPDiagnostics | None
    error = Signal(str)

    def __init__(
        self,
        fen: str,
        move: chess.Move,
        engine_path: str,
        rating: int,
        node_uid: str,
        initial_result: Optional[EngineResult] = None,
    ) -> None:
        super().__init__()
        self.fen = fen
        self.move = move
        self.engine_path = engine_path
        self.rating = rating
        self.node_uid = node_uid
        self.initial_result = initial_result

    @Slot()
    def run(self) -> None:
        try:
            engine = _get_label_engine(self.engine_path)
            board = chess.Board(self.fen)
            limit = chess.engine.Limit(time=LABEL_ANALYSIS_TIME)
            best_hint = None
            if self.initial_result and getattr(self.initial_result, "fen", None) == self.fen and getattr(self.initial_result, "best_move", None):
                best_hint = self.initial_result.best_move
            diag, _ = compute_move_ep_diagnostics(engine, board, self.move, limit, best_hint=best_hint)
            self.finished.emit(self.node_uid, diag)
        except Exception as exc:
            self.error.emit(str(exc))


class PreloadMainlineWorker(QObject):
    progress = Signal(str, object, object, str, object)  # node_uid, diag or None, best_move or None, fen, lines list or None
    finished = Signal()
    error = Signal(str)

    def __init__(self, engine_path: str, rating: int, items: List[Tuple[str, Optional[chess.Move], str]], tail_fen: Optional[str]) -> None:
        super().__init__()
        self.engine_path = engine_path
        self.rating = rating
        self.items = items
        self.tail_fen = tail_fen
        self._stop = False

    @Slot()
    def stop(self) -> None:
        self._stop = True

    @Slot()
    def run(self) -> None:
        try:
            engine = _get_label_engine(self.engine_path)
            limit = chess.engine.Limit(time=LABEL_ANALYSIS_TIME)

            for fen, move, uid in self.items:
                if self._stop:
                    break
                board = chess.Board(fen)
                infos = engine.analyse(board, limit=limit, multipv=2)
                infos_list = infos if isinstance(infos, list) else [infos]
                lines: List[EngineLine] = []
                for inf in infos_list:
                    line = self._info_to_line(board, inf)
                    if line:
                        lines.append(line)
                lines = sorted(lines, key=lambda l: l.multipv)
                best_move = lines[0].pv_moves[0] if lines and lines[0].pv_moves else None
                diag = None
                if move:
                    diag, best_move = compute_move_ep_diagnostics(engine, board, move, limit)
                self.progress.emit(uid, diag, best_move, fen, lines)

            if self.tail_fen and not self._stop:
                board = chess.Board(self.tail_fen)
                infos = engine.analyse(board, limit=limit, multipv=2)
                infos_list = infos if isinstance(infos, list) else [infos]
                lines: List[EngineLine] = []
                for inf in infos_list:
                    line = self._info_to_line(board, inf)
                    if line:
                        lines.append(line)
                lines = sorted(lines, key=lambda l: l.multipv)
                best_tail = lines[0].pv_moves[0] if lines and lines[0].pv_moves else None
                self.progress.emit("", None, best_tail, self.tail_fen, lines)
            self.finished.emit()
        except Exception as exc:
            self.error.emit(str(exc))

    def _info_to_line(self, board: chess.Board, info) -> Optional[EngineLine]:
        if not hasattr(info, "get"):
            return None
        pv = info.get("pv")
        if not pv:
            return None
        depth = info.get("depth")
        nodes = info.get("nodes")
        nps = info.get("nps")
        score_raw = info.get("score")
        pov_score = None
        if score_raw:
            if hasattr(score_raw, "pov"):
                pov_score = score_raw.pov(chess.WHITE)
            else:
                try:
                    pov_score = chess.engine.PovScore(score_raw, chess.WHITE)
                except Exception:
                    pov_score = None
        cp, mate = score_components(pov_score)
        pv_san = self._pv_to_san(board, pv)
        pv_uci = " ".join(move.uci() for move in pv)
        multipv = info.get("multipv", 1)
        return EngineLine(
            score=pov_score,
            cp=cp,
            mate=mate,
            depth=depth,
            nodes=nodes,
            nps=nps,
            pv_moves=list(pv),
            pv_san=pv_san,
            pv_uci=pv_uci,
            multipv=multipv,
        )

    def _pv_to_san(self, board: chess.Board, pv: List[chess.Move]) -> str:
        tmp = board.copy()
        sans: List[str] = []
        for move in pv:
            sans.append(tmp.san(move))
            tmp.push(move)
        return " ".join(sans)
# ---------------------------------------------------------------------------
# UI widgets
# ---------------------------------------------------------------------------
class BoardWidget(QWidget):
    movePlayed = Signal(object)  # chess.Move

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.board = chess.Board()
        self.last_move: Optional[chess.Move] = None
        self.best_move_arrow: Optional[Tuple[int, int]] = None
        self.guide_move_arrow: Optional[Tuple[int, int]] = None
        self.highlight_squares: List[int] = []
        self.selected_square: Optional[int] = None
        self.legal_targets: List[chess.Move] = []
        self.dragging: bool = False
        self.drag_origin: Optional[int] = None
        self.drag_pos: Optional[QPointF] = None
        self.orientation_white: bool = True
        self.drag_threshold: float = 6.0
        self.setMouseTracking(True)
        self.setMinimumSize(520, 520)

        self.piece_renderers = self._load_piece_renderers()
        self._piece_cache: dict[tuple[str, int, float], QPixmap] = {}

    def set_position(
        self,
        board: chess.Board,
        last_move: Optional[chess.Move] = None,
        best_move_arrow: Optional[chess.Move] = None,
        guide_move_arrow: Optional[chess.Move] = None,
        highlight_squares: Optional[List[int]] = None,
        preserve_selection: bool = False,
    ) -> None:
        self.board = board.copy()
        self.last_move = last_move
        if best_move_arrow:
            self.best_move_arrow = (best_move_arrow.from_square, best_move_arrow.to_square)
        else:
            self.best_move_arrow = None
        if guide_move_arrow:
            self.guide_move_arrow = (guide_move_arrow.from_square, guide_move_arrow.to_square)
        else:
            self.guide_move_arrow = None
        self.highlight_squares = highlight_squares or []
        if not preserve_selection:
            self.selected_square = None
            self.legal_targets = []
        self.update()

    def flip(self) -> None:
        self.orientation_white = not self.orientation_white
        self.update()

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if event.button() != Qt.LeftButton:
            return
        square = self._square_from_point(event.position())
        if square is None:
            return

        # Click-to-move: if a piece is already selected and another square is clicked, try the move.
        if self.selected_square is not None and square != self.selected_square:
            if self._attempt_move(self.selected_square, square):
                self.dragging = False
                self.drag_origin = None
                self.drag_pos = None
                self.update()
                return

        piece = self.board.piece_at(square)
        if piece:
            self.selected_square = square
            self.legal_targets = [m for m in self.board.legal_moves if m.from_square == square]
            self.dragging = False
            self.drag_origin = square
            self.drag_pos = event.position()
        else:
            # Clicking empty square clears selection
            self.selected_square = None
            self.legal_targets = []
            self.dragging = False
            self.drag_origin = None
            self.drag_pos = None
        self.update()

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if event.buttons() & Qt.LeftButton and self.selected_square is not None:
            if not self.dragging and self.drag_pos is not None:
                delta = event.position() - self.drag_pos
                if (delta.x() ** 2 + delta.y() ** 2) ** 0.5 > self.drag_threshold:
                    self.dragging = True
                    self.drag_origin = self.selected_square
            if self.dragging:
                self.drag_pos = event.position()
                self.update()

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        if event.button() != Qt.LeftButton:
            return
        target_square = self._square_from_point(event.position())
        if self.dragging and self.drag_origin is not None and target_square is not None:
            self._attempt_move(self.drag_origin, target_square)
        elif self.selected_square is not None and target_square is not None and target_square != self.selected_square:
            self._attempt_move(self.selected_square, target_square)

        self.dragging = False
        self.drag_origin = None
        self.drag_pos = None
        self.update()

    def paintEvent(self, _) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        rect, square_size, _ = self._board_rect()
        light = QColor(240, 217, 181)
        dark = QColor(181, 136, 99)
        last_move_color = QColor(246, 246, 105, 160)
        highlight_color = QColor(120, 187, 255, 150)

        for rank in range(8):
            for file in range(8):
                board_file, board_rank = self._board_coordinates(file, rank)
                square = chess.square(board_file, board_rank)
                square_rect = QRect(
                    rect.left() + file * square_size,
                    rect.top() + rank * square_size,
                    square_size,
                    square_size,
                )
                painter.fillRect(square_rect, light if (file + rank) % 2 == 0 else dark)
                if self.last_move and (square == self.last_move.from_square or square == self.last_move.to_square):
                    painter.fillRect(square_rect, last_move_color)
                if square in self.highlight_squares or (self.selected_square == square):
                    painter.fillRect(square_rect, highlight_color)
                if self.selected_square is not None:
                    for move in self.legal_targets:
                        if move.to_square == square:
                            painter.setBrush(QColor(30, 30, 30, 150))
                            painter.setPen(Qt.NoPen)
                            center = square_rect.center()
                            radius = square_size * 0.12
                            painter.drawEllipse(center, radius, radius)

        painter.setPen(QColor(70, 70, 70))
        files = "abcdefgh"
        for idx in range(8):
            file_label = files[idx] if self.orientation_white else files[::-1][idx]
            rank_label = str(8 - idx) if self.orientation_white else str(idx + 1)
            file_x = rect.left() + idx * square_size + square_size // 2
            painter.drawText(file_x - 4, rect.bottom() + 16, file_label)
            rank_y = rect.top() + idx * square_size + square_size // 2
            painter.drawText(rect.left() - 18, rank_y + 5, rank_label)

        for square, piece in self.board.piece_map().items():
            if self.dragging and square == self.drag_origin:
                continue
            square_rect = self._square_rect(rect, square_size, square)
            pix = self._piece_pixmap(piece.symbol(), square_size)
            if pix:
                painter.drawPixmap(square_rect, pix)

        if self.dragging and self.drag_origin is not None and self.drag_pos is not None:
            pix = self._piece_pixmap(self.board.piece_at(self.drag_origin).symbol(), square_size)
            if pix:
                painter.drawPixmap(
                    QRect(self.drag_pos.x() - square_size / 2, self.drag_pos.y() - square_size / 2, square_size, square_size),
                    pix,
                )

        if self.best_move_arrow:
            self._draw_arrow(painter, rect, square_size, self.best_move_arrow[0], self.best_move_arrow[1], QColor(22, 163, 74, 200))
        if getattr(self, "guide_move_arrow", None):
            self._draw_arrow(painter, rect, square_size, self.guide_move_arrow[0], self.guide_move_arrow[1], QColor(50, 120, 220, 210))

    def _board_rect(self) -> Tuple[QRect, int, QPoint]:
        margin = 28
        size = min(self.width() - margin * 2, self.height() - margin * 2)
        size = max(size, 10)
        top_left = QPoint((self.width() - size) // 2, (self.height() - size) // 2)
        return QRect(top_left, QSize(size, size)), size // 8, top_left

    def _board_coordinates(self, file: int, rank: int) -> Tuple[int, int]:
        if self.orientation_white:
            return file, 7 - rank
        return 7 - file, rank

    def _screen_coordinates(self, square: int) -> Tuple[int, int]:
        file = chess.square_file(square)
        rank = chess.square_rank(square)
        if self.orientation_white:
            return file, 7 - rank
        return 7 - file, rank

    def _square_from_point(self, point: QPointF) -> Optional[int]:
        rect, square_size, _ = self._board_rect()
        if not rect.contains(point.toPoint()):
            return None
        file = int((point.x() - rect.left()) // square_size)
        rank = int((point.y() - rect.top()) // square_size)
        board_file, board_rank = self._board_coordinates(file, rank)
        return chess.square(board_file, board_rank)

    def _square_rect(self, rect: QRect, square_size: int, square: int) -> QRect:
        file, rank = self._screen_coordinates(square)
        x = rect.left() + file * square_size
        y = rect.top() + rank * square_size
        return QRect(x, y, square_size, square_size)

    def _attempt_move(self, from_sq: int, to_sq: int) -> bool:
        candidates = [m for m in self.board.legal_moves if m.from_square == from_sq and m.to_square == to_sq]
        move = None
        if not candidates:
            return False
        if len(candidates) == 1:
            move = candidates[0]
        else:
            for m in candidates:
                if m.promotion == chess.QUEEN:
                    move = m
                    break
            move = move or candidates[0]
        self.movePlayed.emit(move)
        return True

    def _load_piece_renderers(self) -> Dict[str, QSvgRenderer]:
        renderers: Dict[str, QSvgRenderer] = {}
        root = Path(__file__).resolve().parent
        candidates = [
            root / "app" / "assets" / "pieces",
            root / "assets" / "pieces",
        ]
        base = next((p for p in candidates if p.exists()), None)
        if not base:
            return renderers
        mapping = {
            "P": "w_pawn.svg",
            "N": "w_knight.svg",
            "B": "w_bishop.svg",
            "R": "w_rook.svg",
            "Q": "w_queen.svg",
            "K": "w_king.svg",
            "p": "b_pawn.svg",
            "n": "b_knight.svg",
            "b": "b_bishop.svg",
            "r": "b_rook.svg",
            "q": "b_queen.svg",
            "k": "b_king.svg",
        }
        for key, filename in mapping.items():
            path = base / filename
            if path.exists():
                renderers[key] = QSvgRenderer(str(path))
        return renderers

    def _piece_pixmap(self, symbol: str, square_size: int) -> Optional[QPixmap]:
        renderer = self.piece_renderers.get(symbol)
        if not renderer:
            return None

        device_ratio = self.devicePixelRatioF()
        cache_key = (symbol, square_size, device_ratio)
        if cache_key in self._piece_cache:
            return self._piece_cache[cache_key]

        target_px = max(1, int(math.ceil(square_size * device_ratio)))
        pixmap = QPixmap(target_px, target_px)
        pixmap.fill(Qt.transparent)

        painter = QPainter(pixmap)
        renderer.render(painter, QRectF(0, 0, target_px, target_px))
        painter.end()

        pixmap.setDevicePixelRatio(device_ratio)
        self._piece_cache[cache_key] = pixmap
        return pixmap

    def _draw_arrow(self, painter: QPainter, rect: QRect, square_size: int, from_sq: int, to_sq: int, color: QColor = QColor(22, 163, 74)) -> None:
        start_rect = self._square_rect(rect, square_size, from_sq)
        end_rect = self._square_rect(rect, square_size, to_sq)
        start = start_rect.center()
        end = end_rect.center()
        path = QPainterPath()
        path.moveTo(start)
        path.lineTo(end)
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        arrow_color = color
        painter.setPen(QPen(arrow_color, max(3, square_size // 14), Qt.SolidLine, Qt.RoundCap))
        painter.drawPath(path)

        direction = (end - start)
        length = max(1.0, (direction.x() ** 2 + direction.y() ** 2) ** 0.5)
        ux, uy = direction.x() / length, direction.y() / length
        arrow_size = max(12, square_size // 2)
        left = QPointF(
            end.x() - arrow_size * ux - arrow_size * 0.35 * uy,
            end.y() - arrow_size * uy + arrow_size * 0.35 * ux,
        )
        right = QPointF(
            end.x() - arrow_size * ux + arrow_size * 0.35 * uy,
            end.y() - arrow_size * uy - arrow_size * 0.35 * ux,
        )
        painter.setBrush(arrow_color)
        painter.drawPolygon(QPolygonF([end, left, right]))
        painter.restore()


class MoveListWidget(QWidget):
    nodeSelected = Signal(object)  # MoveNode

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.tree = QTreeView(self)
        self.tree.setHeaderHidden(True)
        self.tree.setIndentation(18)
        self.tree.clicked.connect(self._on_clicked)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.tree)

        self.model = QStandardItemModel(self.tree)
        self.tree.setModel(self.model)
        self.node_map: dict[str, QStandardItem] = {}
        self.current_uid: str | None = None

    def refresh(self, root: MoveNode, current_node: MoveNode) -> None:
        self.model.clear()
        self.node_map = {}
        root_item = self.model.invisibleRootItem()
        for child in root.children:
            self._add_node(child, root_item)
        self.tree.expandAll()
        self._select_node(current_node)

    def select_node(self, node: MoveNode) -> None:
        self._select_node(node)

    def _add_node(self, node: MoveNode, parent_item: QStandardItem) -> QStandardItem:
        label = self._label_for_node(node)
        item = QStandardItem(label)
        item.setEditable(False)
        if node.is_mainline:
            font = item.font()
            font.setBold(True)
            item.setFont(font)
        item.setData(node, Qt.UserRole)
        parent_item.appendRow(item)
        self.node_map[node.uid] = item
        for child in node.children:
            self._add_node(child, item)
        return item

    def _label_for_node(self, node: MoveNode) -> str:
        if not node.parent or not node.move:
            return "Start"
        board_before = chess.Board(node.parent.board_fen)
        prefix = f"{board_before.fullmove_number}{'.' if board_before.turn == chess.WHITE else '...'}"
        suffix = "" if node.is_mainline else " (var)"
        novelty = " [Novelty]" if is_novelty_node(node) else ""
        return f"{prefix} {node.san or node.move.uci()}{suffix}{novelty}"

    def _on_clicked(self, index) -> None:
        node = index.data(Qt.UserRole)
        if node:
            self.current_uid = node.uid
            self.nodeSelected.emit(node)

    def _select_node(self, node: MoveNode) -> None:
        target_item = self.node_map.get(node.uid)
        if not target_item:
            return
        idx = self.model.indexFromItem(target_item)
        if idx.isValid():
            self.tree.setCurrentIndex(idx)
            self.tree.scrollTo(idx)


class EvalBar(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._value_target = 0.5  # latest target value (0..1)
        self._value_display = 0.5  # animated displayed value
        self._label = "0.00"
        self.setMinimumWidth(40)
        # Simple tween timer for smooth updates (~60 FPS)
        self._anim_timer = QTimer(self)
        self._anim_timer.setInterval(16)
        self._anim_timer.timeout.connect(self._tick_anim)

    def set_value(self, value: float, label: str) -> None:
        self._value_target = clamp(value, 0.0, 1.0)
        self._label = label
        # Kick animation if not already running
        if not self._anim_timer.isActive():
            self._anim_timer.start()
        self.update()

    def _tick_anim(self) -> None:
        # Ease the displayed value toward the target
        diff = self._value_target - self._value_display
        if abs(diff) < 0.001:
            self._value_display = self._value_target
            self._anim_timer.stop()
        else:
            self._value_display += diff * 0.18  # smoothing factor
        self.update()

    def paintEvent(self, _) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        bar_rect = self.rect().adjusted(6, 6, -6, -6)

        white_color = QColor(238, 238, 238)
        black_color = QColor(32, 32, 32)
        painter.fillRect(bar_rect, black_color)
        fill_height = int(bar_rect.height() * self._value_display)
        fill_rect = bar_rect.adjusted(0, bar_rect.height() - fill_height, 0, 0)
        painter.fillRect(fill_rect, white_color)

        painter.setPen(QPen(QColor(70, 70, 70), 1.2))
        painter.drawRoundedRect(bar_rect, 6, 6)

        # No numeric label per request


class AnalysisPanel(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.score_label = QLabel("+0.00")
        self.depth_label = QLabel("Depth –")
        self.nodes_label = QLabel("Nodes –")
        self.nps_label = QLabel("Nps –")

        self.lines_list = QListWidget()
        self.coach_label = QLabel("")
        self.coach_list = QListWidget()
        self.coach_list.setUniformItemSizes(False)
        self.coach_list.setWordWrap(True)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.score_label)
        layout.addWidget(self.depth_label)
        layout.addWidget(self.nodes_label)
        layout.addWidget(self.nps_label)
        layout.addWidget(self.lines_list, 1)
        layout.addWidget(self.coach_label)
        layout.addWidget(self.coach_list, 2)

    def set_result(self, result: EngineResult | None) -> None:
        if not result or not result.lines:
            self.score_label.setText("Eval –")
            self.depth_label.setText("Depth –")
            self.nodes_label.setText("Nodes –")
            self.nps_label.setText("Nps –")
            self.lines_list.clear()
            self.coach_list.clear()
            return
        best = result.lines[0]
        self.score_label.setText(f"Eval {format_score(best.score)}")
        self.depth_label.setText(f"Depth {best.depth or '-'}")
        self.nodes_label.setText(f"Nodes {best.nodes or '-'}")
        self.nps_label.setText(f"Nps {best.nps or '-'}")

        self.lines_list.clear()
        for line in result.lines:
            item = QListWidgetItem(self._line_text(line))
            if line.multipv == 1:
                font = item.font()
                font.setBold(True)
                item.setFont(font)
            self.lines_list.addItem(item)

        self.coach_list.clear()

    def _line_text(self, line: EngineLine) -> str:
        score_text = format_score(line.score)
        depth_text = f"d{line.depth}" if line.depth else "-"
        return f"{line.multipv}. {score_text} {depth_text} | {line.pv_san}"


class SettingsDialog(QDialog):
    def __init__(self, settings: EngineSettings, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Engine Settings")
        self.settings = settings

        self.path_edit = QLineEdit(settings.engine_path or "")
        browse_btn = QPushButton("Browse")
        browse_btn.clicked.connect(self._browse)

        path_layout = QHBoxLayout()
        path_layout.addWidget(self.path_edit, 1)
        path_layout.addWidget(browse_btn)

        self.thread_spin = QSpinBox()
        self.thread_spin.setRange(1, max(1, os.cpu_count() or 16))
        self.thread_spin.setValue(settings.threads)

        self.hash_spin = QSpinBox()
        self.hash_spin.setRange(16, 8192)
        self.hash_spin.setValue(settings.hash_size)
        self.hash_spin.setSingleStep(16)

        self.multipv_spin = QSpinBox()
        self.multipv_spin.setRange(3, 5)
        self.multipv_spin.setValue(settings.multipv)

        self.mode_combo = QComboBox()
        self.mode_combo.addItem("Infinite", AnalysisMode.INFINITE)
        self.mode_combo.addItem("Limited", AnalysisMode.LIMITED)
        idx = self.mode_combo.findData(settings.analysis_mode)
        if idx >= 0:
            self.mode_combo.setCurrentIndex(idx)

        self.limited_time_spin = QDoubleSpinBox()
        self.limited_time_spin.setRange(0.1, 3.0)
        self.limited_time_spin.setSingleStep(0.1)
        self.limited_time_spin.setValue(settings.limited_time)

        self.infinite_time_spin = QDoubleSpinBox()
        self.infinite_time_spin.setRange(1.0, 30.0)
        self.infinite_time_spin.setSingleStep(0.5)
        self.infinite_time_spin.setValue(settings.infinite_time)

        form = QFormLayout()
        form.addRow("Stockfish path", path_layout)
        form.addRow("Threads", self.thread_spin)
        form.addRow("Hash (MB)", self.hash_spin)
        form.addRow("MultiPV", self.multipv_spin)
        form.addRow("Analysis mode", self.mode_combo)
        form.addRow("Limited time (s)", self.limited_time_spin)
        form.addRow("Infinite time (s)", self.infinite_time_spin)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        layout = QFormLayout(self)
        layout.addRow(form)
        layout.addRow(buttons)

    def _browse(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Select Stockfish binary", "", "All Files (*)")
        if path:
            self.path_edit.setText(path)

    def result_settings(self) -> EngineSettings:
        return EngineSettings(
            engine_path=self.path_edit.text() or None,
            threads=self.thread_spin.value(),
            hash_size=self.hash_spin.value(),
            multipv=self.multipv_spin.value(),
            analysis_mode=self.mode_combo.currentData(),
            limited_time=self.limited_time_spin.value(),
            infinite_time=self.infinite_time_spin.value(),
        )


# ---------------------------------------------------------------------------
# Main window
# ---------------------------------------------------------------------------
class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Lichess-style Analysis Board")
        self.setFocusPolicy(Qt.StrongFocus)

        self.reason_classifier = ReasonClassifier()
        self.explanation_engine = ExplanationEngine()
        self.llm_reviewer = LLMReviewer()
        self.last_reason_result: Optional[ReasonResult] = None
        self.last_explanation: Optional[ExplanationResult] = None
        self.last_llm_explanation: Optional[dict] = None
        self.question_edit = None
        self.llm_answer_view = None
        self.best_move_pending: bool = False
        self.best_move_request_fen: Optional[str] = None
        self.analysis_time_s = 0.0
        self.rating_estimate = 1600
        self.label_thread: Optional[QThread] = None
        self.label_worker: Optional[MoveLabelWorker] = None
        self.preload_thread: Optional[QThread] = None
        self.preload_worker: Optional[PreloadMainlineWorker] = None
        self.preload_progress_dialog: Optional[QProgressDialog] = None
        self.preload_total: int = 0
        self.preload_done: int = 0
        self.move_labels: Dict[str, object] = {}
        self.pending_label: Optional[Tuple[str, chess.Move, str]] = None  # (fen, move, uid)
        self.show_prev_best: bool = True  # always compare against previous best
        self.position_contexts: Dict[str, dict] = {}
        self.positional_contexts_deep: Dict[str, dict] = {}
        self.llm_explanations: Dict[str, dict] = {}
        self.pending_context_requests: Dict[int, str] = {}
        self.best_move_cache: Dict[str, chess.Move] = {}
        self.current_engine_lines: List[EngineLine] = []
        self.selected_line_index: Optional[int] = None
        self.game_accuracy_overall: float = 0.0
        self.white_accuracy: float = 0.0
        self.black_accuracy: float = 0.0
        self.accuracy_debug: bool = True

        self.game_model = GameModel()
        self.settings_store = QSettings("codex", "lichess_desktop")
        self.engine_settings = self._load_engine_settings()
        self.engine_manager = EngineManager(self.engine_settings)

        self.analysis_enabled = True
        self.navigate_variation = True
        self.current_state: Optional[PositionState] = None
        self._scrubbing = False
        self._last_nav_ts = time.monotonic()
        self.selected_line_index: Optional[int] = None

        self.analysis_timer = QTimer(self)
        self.analysis_timer.setSingleShot(True)
        self.analysis_timer.setInterval(50)
        self.analysis_timer.timeout.connect(self._start_analysis)

        self.board_widget = BoardWidget()
        self.eval_bar = EvalBar()
        self.move_list = MoveListWidget()
        self.analysis_panel = AnalysisPanel()
        self.sound = SoundManager(self)
        self.move_label_widget = self._build_move_label_widget()
        self.accuracy_widget = self._build_accuracy_widget()
        self.lines_widget = self._build_lines_widget()
        self.analysis_checkbox = QCheckBox("Analysis on")
        self.analysis_checkbox.setChecked(True)
        self.analysis_checkbox.stateChanged.connect(self._toggle_analysis)

        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

        self._build_ui()
        self._wire_signals()
        QShortcut(QKeySequence(Qt.Key_Backspace), self, activated=self._jump_to_novelty_anchor)
        QShortcut(QKeySequence(Qt.Key_Down), self, activated=self._goto_pgn_start)
        QShortcut(QKeySequence(Qt.Key_Up), self, activated=self._goto_pgn_end)
        self._refresh_controls()

    def _load_engine_settings(self) -> EngineSettings:
        defaults = EngineSettings()

        def fetch(key: str, default, caster):
            val = self.settings_store.value(key, default)
            try:
                return caster(val)
            except Exception:
                return default

        return EngineSettings(
            engine_path=self.settings_store.value("engine_path", defaults.engine_path),
            threads=fetch("threads", defaults.threads, int),
            hash_size=fetch("hash_size", defaults.hash_size, int),
            multipv=fetch("multipv", defaults.multipv, int),
            analysis_mode=self.settings_store.value("analysis_mode", defaults.analysis_mode),
            limited_time=fetch("limited_time", defaults.limited_time, float),
            infinite_time=fetch("infinite_time", defaults.infinite_time, float),
        )

    def _save_engine_settings(self, settings: EngineSettings) -> None:
        self.settings_store.setValue("engine_path", settings.engine_path or "")
        self.settings_store.setValue("threads", settings.threads)
        self.settings_store.setValue("hash_size", settings.hash_size)
        self.settings_store.setValue("multipv", settings.multipv)
        self.settings_store.setValue("analysis_mode", settings.analysis_mode)
        self.settings_store.setValue("limited_time", settings.limited_time)
        self.settings_store.setValue("infinite_time", settings.infinite_time)

    def _build_ui(self) -> None:
        controls = self._build_controls()

        board_row = QWidget()
        board_row_layout = QHBoxLayout(board_row)
        board_row_layout.setContentsMargins(0, 0, 0, 0)
        board_row_layout.setSpacing(6)
        board_row_layout.addWidget(self.eval_bar)
        board_row_layout.addWidget(self.board_widget, 1)

        left_container = QWidget()
        left_layout = QVBoxLayout(left_container)
        left_layout.setContentsMargins(6, 6, 6, 6)
        left_layout.setSpacing(6)
        left_layout.addWidget(board_row, 1)
        left_layout.addWidget(controls, 0)

        right_container = QWidget()
        right_layout = QVBoxLayout(right_container)
        right_layout.setContentsMargins(6, 6, 6, 6)
        right_layout.setSpacing(6)
        right_layout.addWidget(self.lines_widget, 0)
        right_layout.addWidget(self.move_list, 2)
        right_layout.addWidget(self.move_label_widget, 0)
        right_layout.addWidget(self.analysis_panel, 2)
        right_layout.addWidget(self.accuracy_widget, 0)
        right_layout.addWidget(self.analysis_checkbox)

        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(left_container)
        splitter.addWidget(right_container)
        splitter.setSizes([720, 420])

        container = QWidget()
        container_layout = QHBoxLayout(container)
        container_layout.setContentsMargins(0, 0, 0, 0)
        container_layout.addWidget(splitter)
        self.setCentralWidget(container)

        self._make_menu()

    def _build_controls(self) -> QWidget:
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        start_btn = QPushButton("|<")
        back_btn = QPushButton("<")
        forward_btn = QPushButton(">")
        end_btn = QPushButton(">|")
        start_btn.clicked.connect(self._nav_goto_start)
        back_btn.clicked.connect(lambda: self._nav_step_mainline(-1))
        forward_btn.clicked.connect(lambda: self._nav_step_mainline(1))
        end_btn.clicked.connect(self._nav_goto_end)

        flip_btn = QPushButton("Flip")
        flip_btn.clicked.connect(self.board_widget.flip)

        import_btn = QPushButton("Import PGN")
        import_btn.clicked.connect(lambda: self._open_pgn_text_dialog("Import PGN"))

        fen_btn = QPushButton("Set FEN")
        fen_btn.clicked.connect(self._set_fen)

        reset_btn = QPushButton("Reset")
        reset_btn.clicked.connect(self._reset_board)

        copy_fen_btn = QPushButton("Copy FEN")
        copy_fen_btn.clicked.connect(self._copy_fen)

        copy_pgn_btn = QPushButton("Copy PGN")
        copy_pgn_btn.clicked.connect(self._copy_pgn)

        settings_btn = QPushButton("Settings")
        settings_btn.clicked.connect(self._open_settings)

        for btn in [
            start_btn,
            back_btn,
            forward_btn,
            end_btn,
            flip_btn,
            import_btn,
            fen_btn,
            reset_btn,
            copy_fen_btn,
            copy_pgn_btn,
            settings_btn,
        ]:
            layout.addWidget(btn)
        layout.addStretch(1)
        return widget

    def _build_move_label_widget(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)
        title = QLabel("Move Label")
        badge = QLabel("—")
        badge.setStyleSheet("QLabel { padding:4px 8px; border-radius:10px; background:#999; color:white; font-weight:bold; }")
        text = QLabel("No move selected")
        reason = QLabel("")
        reason.setStyleSheet("color:#666; font-size:11px;")
        layout.addWidget(title)
        row = QHBoxLayout()
        row.addWidget(badge, 0)
        row.addWidget(text, 1)
        layout.addLayout(row)
        layout.addWidget(reason)
        self.label_badge = badge
        self.label_text = text
        self.label_reason = reason
        return widget

    def _build_lines_widget(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        header = QLabel("Top Lines")
        header.setStyleSheet("font-weight:bold;")
        self.lines_list = QListWidget()
        self.lines_list.setUniformItemSizes(True)
        self.lines_list.setFocusPolicy(Qt.NoFocus)  # avoid stealing arrow-key navigation
        self.lines_list.itemClicked.connect(self._on_line_clicked)
        layout.addWidget(header)
        layout.addWidget(self.lines_list)
        return widget

    def _on_line_clicked(self, item: QListWidgetItem) -> None:
        line = item.data(Qt.UserRole)
        if not line or not isinstance(line, EngineLine):
            self._clear_preview()
            return
        # Show suggested move (blue arrow) and clear list highlight so navigation stays normal.
        self.selected_line_index = None  # one-shot preview only
        if line.pv_moves:
            mv = line.pv_moves[0]
            self.board_widget.guide_move_arrow = (mv.from_square, mv.to_square)
        else:
            self.board_widget.guide_move_arrow = None
        try:
            self.lines_list.clearSelection()
            self.lines_list.setCurrentRow(-1)
        except Exception:
            pass
        self.board_widget.update()


    def _build_accuracy_widget(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)
        title = QLabel("Game Accuracy")
        row = QHBoxLayout()
        self.acc_white = QLabel("--")
        self.acc_black = QLabel("--")
        for lbl, color in [(self.acc_white, "#e5e7eb"), (self.acc_black, "#111827")]:
            lbl.setMinimumWidth(60)
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setStyleSheet(
                f"QLabel {{ padding:4px 8px; border-radius:8px; background:{color}; color:{'#111827' if color=='#e5e7eb' else '#f9fafb'}; font-weight:bold; }}"
            )
        row.addWidget(QLabel("White:"))
        row.addWidget(self.acc_white)
        row.addSpacing(8)
        row.addWidget(QLabel("Black:"))
        row.addWidget(self.acc_black)
        layout.addWidget(title)
        layout.addLayout(row)
        return widget

    def _make_menu(self) -> None:
        menubar = self.menuBar()
        file_menu = menubar.addMenu("&File")
        import_action = QAction("Import PGN...", self)
        import_action.triggered.connect(lambda: self._open_pgn_text_dialog("Import PGN"))
        file_menu.addAction(import_action)

        settings_action = QAction("Settings...", self)
        settings_action.triggered.connect(self._open_settings)
        file_menu.addAction(settings_action)

        debug_action = QAction("Show Debug Log", self)
        debug_action.triggered.connect(self._open_debug_log)
        file_menu.addAction(debug_action)

        quit_action = QAction("Quit", self)
        quit_action.setShortcut(QKeySequence.Quit)
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)

    def _wire_signals(self) -> None:
        self.board_widget.movePlayed.connect(self._on_move_played)
        self.move_list.nodeSelected.connect(self._on_move_selected)
        self.game_model.positionChanged.connect(self._on_position_changed)
        self.game_model.moveTreeUpdated.connect(self._on_tree_changed)
        self.engine_manager.analysisReady.connect(self._on_engine_result)
        self.engine_manager.engineError.connect(self._on_engine_error)
        self.engine_manager.contextReady.connect(self._on_context_ready)

    def keyPressEvent(self, event) -> None:
        if event.key() == Qt.Key_Left:
            if self.selected_line_index is not None:
                self._clear_preview()
            # If we are in a novelty/variation, snap back to the branch root (PGN point), no extra step.
            if self._snap_to_pgn_anchor():
                return
            self.game_model.step(-1)
            return
        if event.key() == Qt.Key_Right:
            if self.selected_line_index is not None:
                self._clear_preview()
            if self._snap_to_pgn_anchor():
                return
            self.game_model.step(1)
            return
        if event.key() in (Qt.Key_Backspace, Qt.Key_Delete):
            self._jump_to_novelty_anchor()
            return
        if event.key() == Qt.Key_Up:
            self._goto_pgn_end()
            return
        if event.key() == Qt.Key_Down:
            self._goto_pgn_start()
            return
        super().keyPressEvent(event)

    def _goto_pgn_start(self) -> None:
        self.game_model.goto_start()
        self._clear_preview()

    def _goto_pgn_end(self) -> None:
        self.game_model.goto_end()
        self._clear_preview()

    def _nav_step_mainline(self, delta: int) -> None:
        if self.selected_line_index is not None:
            self._clear_preview()
        self.game_model.step_mainline(delta)

    def _nav_goto_start(self) -> None:
        if self.selected_line_index is not None:
            self._clear_preview()
        self.game_model.goto_start()

    def _nav_goto_end(self) -> None:
        if self.selected_line_index is not None:
            self._clear_preview()
        self.game_model.goto_end()

    def _on_move_played(self, move: chess.Move) -> None:
        pre_board = self.game_model.current_board()
        post_board = pre_board.copy(stack=False)
        post_board.push(move)
        is_capture = pre_board.is_capture(move)
        is_check = post_board.is_check()

        if not self.game_model.play_move(move):
            self.status_bar.showMessage("Illegal move", 2500)
            self.sound.play_error()
            return
        self.sound.play_move(capture=is_capture, check=is_check)
        self._start_move_label(pre_board, move)
        # Kick off analysis immediately for fresh positions (esp. new novelties)
        self.analysis_timer.stop()
        self._start_analysis()

    def _on_move_selected(self, node: MoveNode) -> None:
        self.game_model.select_node(node, follow_variation=self.navigate_checkbox.isChecked())

    def _on_position_changed(self, state: PositionState) -> None:
        self.current_state = state
        now = time.monotonic()
        self._scrubbing = (now - self._last_nav_ts) < 0.6
        self._last_nav_ts = now

        fen = state.board.fen()
        cached = self.engine_manager.last_results.get(fen)
        best_move = None
        if cached and cached.best_move:
            best_move = cached.best_move
            self.best_move_cache[fen] = cached.best_move
        elif fen in self.best_move_cache:
            best_move = self.best_move_cache[fen]
        else:
            try:
                diag = self.move_labels.get(state.current_node.uid)
                if diag and diag.best_move:
                    best_move = chess.Move.from_uci(diag.best_move)
            except Exception:
                best_move = None
        prev_best = self._prev_best_move_for_current()
        # Render board/arrow depending on compare mode (always previous best now)
        self._set_board_view(state, best_move, prev_best_override=prev_best)
        if cached:
            self.eval_bar.set_value(cached.bar_value, cached.display_score)
            self.analysis_panel.set_result(cached)
            self._update_reason_display(cached)
        else:
            self.current_engine_lines = []
            self.lines_list.clear()
            self.eval_bar.set_value(0.5, "–")
            self.analysis_panel.set_result(None)
        self.move_list.select_node(state.current_node)
        self._ensure_label_for_node(state.current_node)
        self._update_move_label_display(state.current_node)
        self._update_accuracy_display()

        if self.analysis_enabled:
            self.analysis_timer.start()
        else:
            self.engine_manager.stop()
        if self.show_prev_best:
            self._refresh_prev_best_arrow()
        # Clear any PV selection when changing positions
        self._clear_preview()
        # Clear guide highlight if we jumped back
        self.board_widget.last_move = state.last_move

    def _on_tree_changed(self, root: MoveNode) -> None:
        node = self.current_state.current_node if self.current_state else root
        self.move_list.refresh(root, node)

    def _on_engine_result(self, result: EngineResult) -> None:
        target_fen = self.current_state.board.fen() if self.current_state else None
        if target_fen and result.fen == target_fen:
            if result.best_move:
                self.best_move_cache[result.fen] = result.best_move
            self.current_engine_lines = result.lines
            self.eval_bar.set_value(result.bar_value, result.display_score)
            self.analysis_panel.set_result(result)
            prev_best = self._prev_best_move_for_current()
            self._set_board_view(self.current_state, result.best_move, prev_best_override=prev_best)
            self._update_lines_widget(result, prev_best)
            try:
                engine_lines_payload = self._engine_lines_payload(result)
                node_uid = self.current_state.current_node.uid if self.current_state else ""
                pos_ctx = build_positional_context(result.fen, engine_lines_payload, self.current_state.current_node.move.uci() if self.current_state and self.current_state.current_node.move else None)
                self.positional_contexts_deep[node_uid] = pos_ctx
                deep_exp = self.llm_reviewer.explain_deep(engine_lines_payload, pos_ctx, self.current_state.current_node.move.uci() if self.current_state and self.current_state.current_node.move else None)
                self.llm_explanations[node_uid] = deep_exp
                self.last_llm_explanation = deep_exp
                self._render_llm_answer(deep_exp)
            except Exception:
                pass
        if self.best_move_pending and self.best_move_request_fen and result.fen == self.best_move_request_fen:
            self.best_move_pending = False
            self.best_move_request_fen = None
        # If we receive analysis for the previous position while compare mode is on, refresh the arrow.
        if self.show_prev_best and self.current_state and self.current_state.current_node.parent:
            parent_fen = self.current_state.current_node.parent.board_fen
            if result.fen == parent_fen:
                if result.best_move:
                    self.best_move_cache[parent_fen] = result.best_move
                self._refresh_prev_best_arrow()

    def _on_engine_error(self, message: str) -> None:
        self.status_bar.showMessage(f"Engine error: {message}", 5000)
        QMessageBox.warning(self, "Engine error", f"Stockfish is not available.\n{message}")
        self.analysis_enabled = False
        self.analysis_checkbox.setChecked(False)

    @Slot(int, str, object)
    def _on_context_ready(self, request_id: int, node_uid: str, context: object) -> None:
        self.pending_context_requests.pop(request_id, None)
        if not isinstance(context, dict):
            return
        self.position_contexts[node_uid] = context
        explanation = self.llm_reviewer.explain_from_context(context)
        self.llm_explanations[node_uid] = explanation
        self.last_llm_explanation = explanation
        if self.current_state and self.current_state.current_node.uid == node_uid:
            self._render_llm_answer(explanation)

    def _open_pgn_text_dialog(self, title: str) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle(title)
        layout = QVBoxLayout(dialog)
        edit = QPlainTextEdit()
        layout.addWidget(edit)
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)
        if dialog.exec() == QDialog.Accepted:
            raw = edit.toPlainText()
            cleaned = self._extract_pgn(raw)
            if not cleaned.strip():
                QMessageBox.warning(self, "PGN error", "No PGN content found.")
                return
            error = self.game_model.load_pgn(cleaned)
            if error:
                QMessageBox.warning(self, "PGN error", error)
            else:
                self._clear_analysis_state()
                self._start_preload_mainline()

    def _extract_pgn(self, raw: str) -> str:
        """Attempt to strip unrelated text, keeping headers/moves."""
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        if not lines:
            return ""
        # If we see a header line, start from the first header.
        for idx, ln in enumerate(lines):
            if ln.startswith("[") and ln.endswith("]"):
                return "\n".join(lines[idx:])
        # Otherwise, find the first move number pattern.
        blob = " ".join(lines)
        match = re.search(r"\d+\\.\\s*[A-Za-z0-9]", blob)
        if match:
            return blob[match.start():]
        return blob

    def _set_fen(self) -> None:
        text, ok = QInputDialog.getText(self, "Set FEN", "Enter FEN:", text=self.game_model.current_fen())
        if ok:
            error = self.game_model.set_fen(text)
            if error:
                QMessageBox.warning(self, "Invalid FEN", error)
            else:
                self._clear_analysis_state()

    def _copy_fen(self) -> None:
        if not self.current_state:
            return
        QGuiApplication.clipboard().setText(self.current_state.board.fen())
        self.status_bar.showMessage("FEN copied", 2000)

    def _copy_pgn(self) -> None:
        pgn = self.game_model.export_pgn()
        QGuiApplication.clipboard().setText(pgn)
        self.status_bar.showMessage("PGN copied", 2000)

    def _reset_board(self) -> None:
        self._clear_analysis_state()
        self.game_model.reset(chess.STARTING_FEN)

    def _clear_analysis_state(self) -> None:
        """Clear cached analysis, labels, and reset displays for a fresh game."""
        try:
            self.engine_manager.last_results.clear()
        except Exception:
            pass
        self.move_labels.clear()
        self.best_move_cache.clear()
        self.position_contexts.clear()
        self.positional_contexts_deep.clear()
        self.llm_explanations.clear()
        self.pending_context_requests.clear()
        self.last_reason_result = None
        self.last_explanation = None
        self.last_llm_explanation = None
        # Reset accuracy display immediately
        self.white_accuracy = 0.0
        self.black_accuracy = 0.0
        self.game_accuracy_overall = 0.0
        self.acc_white.setText("--")
        self.acc_black.setText("--")
        # Clear lines/arrow UI
        self.current_engine_lines = []
        self.selected_line_index = None
        self.lines_list.clear()
        self.board_widget.best_move_arrow = None
        self.board_widget.guide_move_arrow = None
        self.board_widget.update()
        self.eval_bar.set_value(0.5, "–")

    def _open_settings(self) -> None:
        dialog = SettingsDialog(self.engine_settings, self)
        if dialog.exec() == QDialog.Accepted:
            self.engine_settings = dialog.result_settings()
            self._save_engine_settings(self.engine_settings)
            self.engine_manager.update_settings(self.engine_settings)
        self.status_bar.showMessage("Engine settings updated", 2500)
        self._start_analysis()

    def _open_debug_log(self) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("Debug Log (MoveAcc, AccLabelBased, AccuracyDebug)")
        layout = QVBoxLayout(dialog)
        text = QPlainTextEdit()
        text.setReadOnly(True)
        text.setPlainText("\n".join(_DEBUG_LOG))
        layout.addWidget(text, 1)

        buttons = QHBoxLayout()
        refresh_btn = QPushButton("Refresh")
        copy_btn = QPushButton("Copy All")
        close_btn = QPushButton("Close")
        buttons.addWidget(refresh_btn)
        buttons.addWidget(copy_btn)
        buttons.addStretch(1)
        buttons.addWidget(close_btn)
        layout.addLayout(buttons)

        def _refresh() -> None:
            text.setPlainText("\n".join(_DEBUG_LOG))
            text.moveCursor(text.textCursor().End)

        def _copy() -> None:
            QGuiApplication.clipboard().setText("\n".join(_DEBUG_LOG))

        refresh_btn.clicked.connect(_refresh)
        copy_btn.clicked.connect(_copy)
        close_btn.clicked.connect(dialog.accept)
        dialog.resize(720, 480)
        dialog.exec()

    def _toggle_variation_navigation(self, state: int) -> None:
        self.navigate_variation = state == Qt.Checked
        self.game_model.toggle_variation_navigation(self.navigate_variation)

    def _jump_to_novelty_anchor(self) -> None:
        """Return to the PGN point where the current branch started."""
        def _reset_nav_state() -> None:
            self.game_model.toggle_variation_navigation(False)
            self.navigate_variation = False
            self.game_model.variation_anchor = None

        # If we have a recorded novelty anchor, go there first.
        if self.game_model.novelty_anchor_index is not None:
            try:
                self.game_model.set_mainline_index(self.game_model.novelty_anchor_index)
                _reset_nav_state()
                self.board_widget.best_move_arrow = None
                self.board_widget.guide_move_arrow = None
                self._clear_preview()
                self.game_model.novelty_anchor_index = None
                return
            except Exception:
                pass
        # If we've extended beyond the PGN length, jump to the last PGN move.
        if self.game_model.mainline_index >= self.game_model.mainline_pgn_len and self.game_model.mainline_pgn_len > 0:
            target_idx = self.game_model.mainline_pgn_len - 1
            self.game_model.set_mainline_index(target_idx)
            _reset_nav_state()
            self.board_widget.best_move_arrow = None
            self.board_widget.guide_move_arrow = None
            self._clear_preview()
            self.game_model.novelty_anchor_index = None
            return
        # If on a variation node, jump to its mainline ancestor.
        node = self.current_state.current_node if self.current_state else None
        if node and not node.is_mainline:
            anchor = self.game_model._mainline_ancestor(node)
            if anchor:
                try:
                    anchor_idx = self.game_model.mainline.index(anchor)
                    self.game_model.set_mainline_index(anchor_idx)
                    _reset_nav_state()
                    self.board_widget.best_move_arrow = None
                    self.board_widget.guide_move_arrow = None
                except Exception:
                    self.game_model.goto_start()
            else:
                self.game_model.goto_start()
            self._clear_preview()
            self.game_model.novelty_anchor_index = None
            return
        # Otherwise, step back one move as a fallback.
        self.game_model.step(-1)
        _reset_nav_state()
        self._clear_preview()
        self.game_model.novelty_anchor_index = None

    def _snap_to_pgn_anchor(self) -> bool:
        """If currently off-PGN, jump back to the PGN branch root. Returns True if a snap occurred."""
        # If we have a recorded anchor, snap to it
        if self.game_model.novelty_anchor_index is not None:
            try:
                self.game_model.set_mainline_index(self.game_model.novelty_anchor_index)
                self.game_model.novelty_anchor_index = None
                self.game_model.toggle_variation_navigation(False)
                self.navigate_variation = False
                self.game_model.variation_anchor = None
                self._clear_preview()
                self.board_widget.best_move_arrow = None
                self.board_widget.guide_move_arrow = None
                return True
            except Exception:
                pass
        # If we're in a variation node without anchor, snap to its mainline ancestor
        node = self.current_state.current_node if self.current_state else None
        if node and not node.is_mainline:
            anchor = self.game_model._mainline_ancestor(node)
            if anchor:
                try:
                    anchor_idx = self.game_model.mainline.index(anchor)
                    self.game_model.set_mainline_index(anchor_idx)
                    self.game_model.toggle_variation_navigation(False)
                    self.navigate_variation = False
                    self.game_model.variation_anchor = None
                    self._clear_preview()
                    self.board_widget.best_move_arrow = None
                    self.board_widget.guide_move_arrow = None
                    return True
                except Exception:
                    pass
        return False

    def _toggle_analysis(self, state: int) -> None:
        self.analysis_enabled = state == Qt.Checked
        if not self.analysis_enabled:
            self.engine_manager.stop()
        else:
            self._start_analysis()

    def _on_best_move_clicked(self) -> None:
        if not self.current_state:
            return
        fen = self.current_state.board.fen()
        cached = self.engine_manager.last_results.get(fen)
        if cached:
            self._apply_best_move_reason(cached)
            return
        self.best_move_pending = True
        self.best_move_request_fen = fen
        self.engine_manager.request(self.current_state.board, fast=True)
        self.status_bar.showMessage("Requesting engine for best move...", 2000)

    def _apply_best_move_reason(self, result: EngineResult) -> None:
        if not result.lines:
            return
        board = chess.Board(result.fen)
        self.last_reason_result = self._build_reason_result(board, result)
        avoid_line = result.lines[1] if len(result.lines) > 1 else None
        explanation = self.explanation_engine.generate_explanation(board, result.lines, avoid_line)
        self.last_explanation = explanation
        self._update_reason_display(result)
        if self.current_state:
            node = self.current_state.current_node
            if node.uid in self.position_contexts:
                ctx = self.position_contexts[node.uid]
                explanation_json = self.llm_reviewer.explain_from_context(ctx)
                self.llm_explanations[node.uid] = explanation_json
                self.last_llm_explanation = explanation_json
                self._render_llm_answer(explanation_json)
            else:
                played_uci = node.move.uci() if node.move else None
                self._request_position_context(node, result.fen, played_uci)
        self._log_best_move(result, explanation)

    def _render_explanation(self, explanation: Optional[ExplanationResult]) -> None:
        # Coach explanations hidden from UI per user request; no-op render.
        return

    def _render_llm_answer(self, llm_result: Optional[dict]) -> None:
        if not self.llm_answer_view:
            return
        if not llm_result:
            self.llm_answer_view.clear()
            return
        lines: List[str] = []
        if "positionalSummary" in llm_result:
            best = llm_result.get("bestMove")
            eval_text = llm_result.get("eval")
            if best:
                lines.append(f"Best: {best} ({eval_text or '–'})")
            summary = llm_result.get("positionalSummary", {})
            for bullet in summary.get("imbalances", []) or []:
                lines.append(f"Imbalance: {bullet}")
            for bullet in summary.get("plan", []) or []:
                lines.append(f"Plan: {bullet}")
            if summary.get("opponentIdea"):
                lines.append(f"Opp idea: {summary.get('opponentIdea')}")
            if summary.get("whyThisMoveNow"):
                lines.append(f"Why now: {summary.get('whyThisMoveNow')}")
            for guide in summary.get("conversionGuide", []) or []:
                lines.append(f"Convert: {guide}")
            for mistake in summary.get("commonMistakes", []) or []:
                lines.append(f"Common mistake: {mistake}")
        else:
            best = llm_result.get("bestMove")
            eval_text = llm_result.get("eval")
            if best:
                lines.append(f"Best: {best} ({eval_text or '–'})")
            primary = llm_result.get("primaryReason")
            if primary:
                lines.append(primary)
            supporting = llm_result.get("supportingReasons", []) or []
            for sup in supporting:
                lines.append(f"- {sup}")
            main_threat = llm_result.get("mainThreat")
            if main_threat:
                lines.append(f"Threat: {main_threat}")
            trade_text = llm_result.get("tradeExplanation")
            if trade_text:
                lines.append(f"Trade: {trade_text}")
            why_not = llm_result.get("whyNotSecondBest")
            if why_not:
                lines.append(f"Why not second: {why_not}")
            coach_tip = llm_result.get("coachTip")
            if coach_tip:
                lines.append(f"Tip: {coach_tip}")
        self.llm_answer_view.setPlainText("\n".join(lines))

    def _on_show_line_clicked(self) -> None:
        # Hidden feature; no-op
        return

    def _on_compare_lines_clicked(self) -> None:
        # Hidden feature; no-op
        return

    def _on_ask_question_clicked(self) -> None:
        # Chat UI removed; no-op
        return

    def _request_position_context(self, node: MoveNode, fen: str, played_move_uci: Optional[str]) -> None:
        try:
            req_id = self.engine_manager.request_position_context(
                fen,
                played_move_uci,
                time_limit_s=max(self.engine_settings.limited_time, 0.2),
                multipv=max(5, self.engine_settings.multipv),
                node_uid=node.uid,
            )
            self.pending_context_requests[req_id] = node.uid
            self.status_bar.showMessage("Building engine-grounded context…", 1500)
        except Exception as exc:
            self.status_bar.showMessage(f"Context build failed: {exc}", 4000)

    def _log_best_move(self, result: EngineResult, explanation) -> None:
        best_line = result.lines[0]
        second_line = result.lines[1] if len(result.lines) > 1 else best_line
        log_payload = {
            "fen": result.fen,
            "best_move": result.best_move.uci() if result.best_move else None,
            "driver": getattr(explanation, "driver", ""),
            "summary": getattr(explanation, "summary_sentence", ""),
            "cp1": best_line.cp,
            "cp2": second_line.cp,
            "mate1": best_line.mate,
            "mate2": second_line.mate,
            "pv_best": getattr(explanation, "pv_best_san", []),
            "pv_avoid": getattr(explanation, "pv_avoid_san", []),
            "counter": getattr(explanation, "counterfactual_text", ""),
            "llm_explanation": self.last_llm_explanation,
            "reason": {
                "id": getattr(self.last_reason_result, "reason_id", ""),
                "label": getattr(self.last_reason_result, "reason_label", ""),
                "explanation": getattr(self.last_reason_result, "short_explanation", ""),
                "evidence": getattr(self.last_reason_result, "evidence", {}),
            },
        }
        print("[BestMove]", log_payload)

    def _engine_lines_payload(self, result: EngineResult) -> List[Dict[str, object]]:
        payload: List[Dict[str, object]] = []
        for line in result.lines:
            payload.append(
                {
                    "rank": line.multipv,
                    "eval": format_score(line.score),
                    "evalCp": line.cp,
                    "mate": line.mate,
                    "depth": line.depth,
                    "pv": [mv.uci() for mv in line.pv_moves],
                }
            )
        return payload

    def _update_lines_widget(self, result: Optional[EngineResult] = None, prev_best: Optional[chess.Move] = None) -> None:
        if result is None:
            result = self.engine_manager.last_results.get(self.current_state.board.fen() if self.current_state else "")
        if result is None:
            return
        self.lines_list.clear()
        lines = result.lines[:3]
        played_move = self.current_state.current_node.move if self.current_state else None
        diag = self.move_labels.get(self.current_state.current_node.uid) if (self.current_state and self.current_state.current_node) else None
        played_cp = None
        mover_is_white = True
        try:
            mover_is_white = self.current_state.board.turn if self.current_state else True
        except Exception:
            mover_is_white = True
        if diag and played_move:
            try:
                meta = diag.eval_payloads.get(played_move.uci(), {}).get("meta", {})
                played_cp = meta.get("cp")
            except Exception:
                played_cp = None
        # Fallback: use cached engine lines for this position
        if played_cp is None and played_move:
            cached_res = self.engine_manager.last_results.get(self.current_state.board.fen() if self.current_state else "")
            if cached_res:
                for l in cached_res.lines:
                    if l.pv_moves and l.pv_moves[0] == played_move:
                        if l.cp is not None:
                            played_cp = l.cp
                        elif l.score:
                            cp_tmp, _ = score_components(l.score)
                            played_cp = cp_tmp
                        break
        # Fallback: use current_engine_lines if present
        if played_cp is None and played_move and self.current_engine_lines:
            for l in self.current_engine_lines:
                if l.pv_moves and l.pv_moves[0] == played_move:
                    if l.cp is not None:
                        played_cp = l.cp
                    elif l.score:
                        cp_tmp, _ = score_components(l.score)
                        played_cp = cp_tmp
                    break
        # Do not issue extra engine calls here; if cp is unknown, display "–".
        for line in lines:
            pv_san = line.pv_san
            cp = line.cp
            # Fallback: derive cp from score if engine did not populate .cp (e.g., mates or older builds)
            if cp is None and line.score:
                cp_tmp, mate_tmp = score_components(line.score)
                if cp_tmp is not None:
                    cp = cp_tmp
                elif mate_tmp is not None:
                    cp = 100000 if mate_tmp > 0 else -100000
            if cp is not None and not mover_is_white:
                cp = -cp
            cp_text = f"{cp/100:+.2f}" if cp is not None else "–"
            text = f"{cp_text:>8}  {pv_san}"
            item = QListWidgetItem(text)
            item.setData(Qt.UserRole, line)
            self.lines_list.addItem(item)
        # PGN line: evaluate the next PGN move from the current position (reuse known evals only)
        try:
            next_pgn_move = None
            if self.current_state:
                cur_idx = self.game_model.mainline.index(self.current_state.current_node)
                if cur_idx + 1 < len(self.game_model.mainline):
                    next_pgn_move = self.game_model.mainline[cur_idx + 1].move
            cp_pgn = None
            san_pgn = "—"
            if next_pgn_move and self.current_state:
                # If the move is already one of the top lines, reuse its cp.
                for l in lines:
                    if l.pv_moves and l.pv_moves[0] == next_pgn_move:
                        cp_pgn = l.cp
                        if cp_pgn is None and l.score:
                            cp_tmp, mate_tmp = score_components(l.score)
                            if cp_tmp is not None:
                                cp_pgn = cp_tmp
                            elif mate_tmp is not None:
                                cp_pgn = 100000 if mate_tmp > 0 else -100000
                        break
                san_pgn = self.current_state.board.san(next_pgn_move)
                # Fallback: use precomputed move label for that PGN move (from preload)
                if cp_pgn is None:
                    try:
                        next_node = self.game_model.mainline[cur_idx + 1]
                        diag_next = self.move_labels.get(next_node.uid)
                        if diag_next:
                            meta_next = diag_next.eval_payloads.get(next_pgn_move.uci(), {}).get("meta", {})
                            cp_pgn = meta_next.get("cp")
                            if cp_pgn is None:
                                mate_tmp = meta_next.get("mate")
                                if mate_tmp is not None:
                                    cp_pgn = 100000 if mate_tmp > 0 else -100000
                    except Exception:
                        cp_pgn = None
                # If still unknown, try cached engine results for this position
                if cp_pgn is None:
                    cached_res = self.engine_manager.last_results.get(self.current_state.board.fen())
                    if cached_res:
                        for l in cached_res.lines:
                            if l.pv_moves and l.pv_moves[0] == next_pgn_move:
                                cp_pgn = l.cp
                                if cp_pgn is None and l.score:
                                    cp_tmp, mate_tmp = score_components(l.score)
                                    if cp_tmp is not None:
                                        cp_pgn = cp_tmp
                                    elif mate_tmp is not None:
                                        cp_pgn = 100000 if mate_tmp > 0 else -100000
                                break
                # If still unknown, try the most recent streamed lines
                if cp_pgn is None and self.current_engine_lines:
                    for l in self.current_engine_lines:
                        if l.pv_moves and l.pv_moves[0] == next_pgn_move:
                            cp_pgn = l.cp
                            if cp_pgn is None and l.score:
                                cp_tmp, mate_tmp = score_components(l.score)
                                if cp_tmp is not None:
                                    cp_pgn = cp_tmp
                                elif mate_tmp is not None:
                                    cp_pgn = 100000 if mate_tmp > 0 else -100000
                            break
            cp_adj = cp_pgn
            if cp_adj is not None and not mover_is_white:
                cp_adj = -cp_adj
            cp_text = f"{cp_adj/100:+.2f}" if cp_adj is not None else "–"
            text = f"{cp_text:>8}  {san_pgn}   (PGN)"
        except Exception:
            text = "played"
        item = QListWidgetItem(text)
        item.setBackground(QColor(255, 180, 180))
        self.lines_list.addItem(item)
        # Do not keep list selection; arrow is enough

    def _clear_preview(self) -> None:
        self.selected_line_index = None
        self.board_widget.guide_move_arrow = None
        try:
            self.lines_list.clearSelection()
            self.lines_list.setCurrentRow(-1)
        except Exception:
            pass
        if self.current_state:
            prev_best = self._prev_best_move_for_current()
            cached = self.engine_manager.last_results.get(self.current_state.board.fen())
            best = cached.best_move if cached and cached.best_move else self._best_move_for_fen(self.current_state.board.fen())
            self._set_board_view(self.current_state, best, prev_best_override=prev_best)
        else:
            self.board_widget.update()

    def _best_move_for_fen(self, fen: str) -> Optional[chess.Move]:
        cached = self.best_move_cache.get(fen)
        if cached:
            return cached
        res = self.engine_manager.last_results.get(fen)
        if res and res.best_move:
            return res.best_move
        return None

    def _prev_best_move_for_current(self) -> Optional[chess.Move]:
        """Best move for the previous position (parent), prefer label-derived best, else cache/engine result."""
        if not self.current_state or not self.current_state.current_node:
            return None
        node = self.current_state.current_node
        # Prefer the move label's best for consistency with displayed accuracy
        diag = self.move_labels.get(node.uid)
        if diag and diag.best_move:
            try:
                return chess.Move.from_uci(diag.best_move)
            except Exception:
                pass
        parent = node.parent
        if not parent:
            return None
        # Next try cached best for parent fen
        cached = self._best_move_for_fen(parent.board_fen)
        if cached:
            return cached
        # Finally, try any stored engine result for parent fen
        res = self.engine_manager.last_results.get(parent.board_fen)
        if res and res.best_move:
            return res.best_move
        return None

    def _refresh_prev_best_arrow(self) -> None:
        """Update arrow/label using previous position's best move when compare mode is on."""
        if not self.show_prev_best or not self.current_state:
            return
        parent = self.current_state.current_node.parent
        if not parent:
            return
        prev_best = self._prev_best_move_for_current()
        prev_board = None
        if prev_best is None:
            # kick off labeling for this move if not already present, to get parent best
            if self.current_state.current_node.uid not in self.move_labels:
                self._ensure_label_for_node(self.current_state.current_node)
            try:
                prev_board = chess.Board(parent.board_fen)
                self.engine_manager.request(prev_board, fast=True)
            except Exception:
                pass
            # As a fallback, run a quick synchronous probe for the parent best move.
            if not prev_best:
                try:
                    engine_path = self.engine_settings.engine_path
                    if engine_path and Path(engine_path).exists() and prev_board is not None:
                        import chess.engine as _ce  # local import to avoid top-level cost
                        with _ce.SimpleEngine.popen_uci(engine_path) as eng:
                            info = eng.analyse(prev_board, limit=_ce.Limit(time=max(0.15, self.engine_settings.limited_time)))
                            pv = info.get("pv") if isinstance(info, dict) else None
                            if pv:
                                prev_best = pv[0]
                                self.best_move_cache[parent.board_fen] = prev_best
                except Exception:
                    prev_best = None
        # Refresh arrow (or clear it if None) without disturbing selection
        self._set_board_view(self.current_state, None, prev_best_override=prev_best)
        # Also refresh label to show "(prev)" tag (or blank if none)
        cached = self.engine_manager.last_results.get(self.current_state.board.fen())
        if cached:
            self._update_reason_display(cached)

    def _update_reason_display(self, result: EngineResult) -> None:
        return  # reason panel removed

    def _build_reason_result(self, board: chess.Board, result: EngineResult) -> Optional[ReasonResult]:
        return None

    def _find_node_by_uid(self, root: MoveNode, uid: str) -> Optional[MoveNode]:
        if root.uid == uid:
            return root
        for child in root.children:
            found = self._find_node_by_uid(child, uid)
            if found:
                return found
        return None

    def _start_move_label(self, pre_board: chess.Board, move: chess.Move) -> None:
        node_uid = self.game_model.current_node.uid
        self._start_move_label_with_uid(pre_board, move, node_uid)

    def _start_move_label_with_uid(self, pre_board: chess.Board, move: chess.Move, node_uid: str) -> None:
        if not self.engine_settings.engine_path or not Path(self.engine_settings.engine_path).exists():
            self.status_bar.showMessage("No Stockfish configured; cannot label moves.", 3000)
            return
        initial_result = self.engine_manager.last_results.get(pre_board.fen())
        # Clean up previous worker
        if self.label_thread and self.label_thread.isRunning():
            self.pending_label = (pre_board.fen(), move, node_uid)
            return
        self.label_thread = QThread()
        self.label_worker = MoveLabelWorker(
            pre_board.fen(),
            move,
            self.engine_settings.engine_path,
            self.rating_estimate,
            node_uid,
            initial_result,
        )
        self.label_worker.moveToThread(self.label_thread)
        self.label_thread.started.connect(self.label_worker.run)
        self.label_worker.finished.connect(self._on_move_label_ready, Qt.QueuedConnection)
        self.label_worker.error.connect(self._on_label_error, Qt.QueuedConnection)
        self.label_worker.finished.connect(self.label_thread.quit)
        self.label_thread.finished.connect(self.label_worker.deleteLater)
        self.label_thread.start()

    def _start_preload_mainline(self) -> None:
        if not self.engine_settings.engine_path or not Path(self.engine_settings.engine_path).exists():
            return
        if self.preload_thread and self.preload_thread.isRunning():
            self.preload_thread.quit()
            self.preload_thread.wait(100)
        items: List[Tuple[str, Optional[chess.Move], str]] = []
        mainline = self.game_model.mainline
        for idx, node in enumerate(mainline):
            parent_fen = mainline[idx - 1].board_fen if idx > 0 else node.board_fen
            move = node.move if idx > 0 else None
            items.append((parent_fen, move, node.uid))
        self.preload_total = len(items)
        self.preload_done = 0
        tail_fen = mainline[-1].board_fen if mainline else None
        if self.preload_progress_dialog:
            self.preload_progress_dialog.close()
        if self.preload_total > 0:
            self.preload_progress_dialog = QProgressDialog("Preloading labels…", "Cancel", 0, self.preload_total, self)
            self.preload_progress_dialog.setWindowModality(Qt.ApplicationModal)
            self.preload_progress_dialog.setMinimumDuration(0)
            self.preload_progress_dialog.canceled.connect(self._cancel_preload)
            self.preload_progress_dialog.show()
        self.preload_thread = QThread()
        self.preload_worker = PreloadMainlineWorker(self.engine_settings.engine_path, self.rating_estimate, items, tail_fen)
        self.preload_worker.moveToThread(self.preload_thread)
        self.preload_thread.started.connect(self.preload_worker.run)
        self.preload_worker.progress.connect(self._on_preload_progress, Qt.QueuedConnection)
        self.preload_worker.error.connect(self._on_preload_error, Qt.QueuedConnection)
        self.preload_worker.finished.connect(self._on_preload_finished, Qt.QueuedConnection)
        self.preload_worker.finished.connect(self.preload_thread.quit)
        self.preload_thread.finished.connect(self.preload_worker.deleteLater)
        self.preload_thread.start()

    @Slot(str, object, object, str, object)
    def _on_preload_progress(self, node_uid: str, diag: object, best_move: object, fen: str, lines_obj: object) -> None:
        self.preload_done += 1
        if self.preload_progress_dialog:
            self.preload_progress_dialog.setValue(min(self.preload_done, self.preload_total))
            self.preload_progress_dialog.setLabelText(f"Preloading labels… {self.preload_done}/{self.preload_total}")
        if best_move:
            self.best_move_cache[fen] = best_move
            if self.current_state and self.current_state.board.fen() == fen:
                self._set_board_view(self.current_state, best_move, prev_best_override=best_move)
        if lines_obj:
            try:
                ordered_lines = list(lines_obj) if isinstance(lines_obj, list) else []
                cached_result = EngineResult(
                    fen=fen,
                    lines=ordered_lines,
                    best_move=ordered_lines[0].pv_moves[0] if ordered_lines and ordered_lines[0].pv_moves else best_move,
                    bar_value=score_to_bar_value(ordered_lines[0].score if ordered_lines else None),
                    display_score=format_score(ordered_lines[0].score if ordered_lines else None),
                )
                self.engine_manager.last_results[fen] = cached_result
                if self.current_state and self.current_state.board.fen() == fen:
                    self.current_engine_lines = cached_result.lines
                    self._update_lines_widget(cached_result, None)
            except Exception:
                pass
        if diag:
            # Mirror the per-move logging so users can see labels during preload too.
            if self.accuracy_debug:
                try:
                    debug_log(
                        f"[MoveAcc][preload] {diag.san} {diag.label} "
                        f"win {diag.win_before_pct:.1f}->{diag.win_after_pct:.1f} "
                        f"drop={diag.win_drop_pct:.1f} acc={diag.move_accuracy:.1f} "
                        f"tags={getattr(diag, 'tags', [])}"
                    )
                except Exception:
                    pass
            self.move_labels[node_uid] = diag
            # Preload caches best move for parent fen (fen param is parent)
            if diag.best_move:
                try:
                    self.best_move_cache[fen] = chess.Move.from_uci(diag.best_move)
                except Exception:
                    pass
            if self.current_state and self.current_state.current_node.uid == node_uid:
                self._update_move_label_display(self.current_state.current_node)
                self._refresh_prev_best_arrow()
            self._update_accuracy_display()

    @Slot(str)
    def _on_label_error(self, msg: str) -> None:
        self.status_bar.showMessage(f"Labeling error: {msg}", 4000)

    @Slot(str)
    def _on_preload_error(self, msg: str) -> None:
        self.status_bar.showMessage(f"Preload error: {msg}", 4000)
        if self.preload_progress_dialog:
            self.preload_progress_dialog.cancel()

    def _on_preload_finished(self) -> None:
        if self.preload_progress_dialog:
            self.preload_progress_dialog.reset()
            self.preload_progress_dialog.close()
            self.preload_progress_dialog = None
        self.setEnabled(True)
        self._update_accuracy_display()
        try:
            self._update_lines_widget()
        except Exception:
            pass

    def _cancel_preload(self) -> None:
        if self.preload_worker:
            try:
                self.preload_worker.stop()
            except Exception:
                pass
        if self.preload_progress_dialog:
            self.preload_progress_dialog.close()
            self.preload_progress_dialog = None
        self.setEnabled(True)

    def _on_move_label_ready(self, node_uid: str, diag) -> None:
        if diag is None:
            return
        self.move_labels[node_uid] = diag
        # Cache parent best move for quick retrieval when comparing previous best
        try:
            node = self._find_node_by_uid(self.game_model.root, node_uid)
            if node and node.parent and diag.best_move:
                self.best_move_cache[node.parent.board_fen] = chess.Move.from_uci(diag.best_move)
        except Exception:
            pass
        if self.accuracy_debug:
            try:
                debug_log(
                    f"[MoveAcc] {diag.san} {diag.label} win {diag.win_before_pct:.1f}->{diag.win_after_pct:.1f} "
                    f"drop={diag.win_drop_pct:.1f} acc={diag.move_accuracy:.1f} tags={getattr(diag, 'tags', [])}"
                )
            except Exception:
                pass
        self._update_move_label_display(self.current_state.current_node if self.current_state else None)
        self.status_bar.showMessage(f"Move {diag.ply}: {diag.san} -> {diag.label}", 5000)
        if self.pending_label:
            fen, mv, uid = self.pending_label
            self.pending_label = None
            try:
                board = chess.Board(fen)
            except Exception:
                return
            self._start_move_label_with_uid(board, mv, uid)
        if self.show_prev_best and self.current_state and self.current_state.current_node.uid == node_uid:
            self._refresh_prev_best_arrow()
        self._update_accuracy_display()
        try:
            self._update_lines_widget()
        except Exception:
            pass

    def _update_move_label_display(self, node: Optional[object]) -> None:
        if not node:
            self._set_label_display("—", "No move selected", "")
            return
        novelty = is_novelty_node(node)
        diag = self.move_labels.get(node.uid)
        if novelty and not diag:
            self._set_label_display("Novelty", "Novelty", "PGN novelty")
            return
        if not diag:
            self._set_label_display("—", "No label", "")
            return
        reasons = []
        if novelty:
            reasons.append("PGN novelty")
        flag_reason = self._reason_from_flags(diag.flags)
        if flag_reason:
            reasons.append(flag_reason)
        if getattr(diag, "tags", None):
            reasons.extend(diag.tags)
        badge = "Novelty" if novelty else diag.label
        main_text = diag.label if not novelty else f"Novelty + {diag.label}"
        self._set_label_display(badge, main_text, "; ".join(reasons))
        self._update_accuracy_display()

    def _reason_from_flags(self, flags: Dict[str, bool]) -> str:
        reasons = []
        if flags.get("brilliant"):
            reasons.append("Sacrifice maintains advantage")
        if flags.get("miss"):
            reasons.append("Missed winning line")
        if flags.get("only_move"):
            reasons.append("Only move available")
        if flags.get("swing"):
            reasons.append("Changed evaluation")
        if flags.get("sacrifice"):
            reasons.append("Sacrifice")
        return "; ".join(dict.fromkeys(reasons)) or ""

    def _set_label_display(self, badge_text: str, main_text: str, reason: str) -> None:
        color_map = {
        "Brilliant": "#3b82f6",
        "Best": "#16a34a",
        "Excellent": "#22c55e",
        "Good": "#84cc16",
        "Book": "#0ea5e9",
        "Novelty": "#06b6d4",
            "Inaccuracy": "#f59e0b",
            "Mistake": "#f97316",
            "Miss": "#eab308",
            "Blunder": "#ef4444",
            "OK": "#9ca3af",
            "—": "#9ca3af",
        }
        color = color_map.get(badge_text, "#9ca3af")
        self.label_badge.setText(badge_text)
        self.label_badge.setStyleSheet(f"QLabel {{ padding:4px 8px; border-radius:10px; background:{color}; color:white; font-weight:bold; }}")
        self.label_text.setText(main_text)
        self.label_reason.setText(reason or "")

    def _ensure_label_for_node(self, node: Optional[object]) -> None:
        if not node or not getattr(node, "move", None):
            return
        if node.uid in self.move_labels:
            return
        parent = getattr(node, "parent", None)
        if parent is None or not getattr(parent, "board_fen", None):
            return
        if self._scrubbing and self.label_thread and self.label_thread.isRunning():
            self.pending_label = (parent.board_fen, node.move, node.uid)
            return
        pre_board = chess.Board(parent.board_fen)
        self._start_move_label_with_uid(pre_board, node.move, node.uid)

    def _update_accuracy_display(self) -> None:
        # Require full labeling to avoid drifting accuracy while moves are still being analyzed.
        missing = [
            node
            for idx, node in enumerate(self.game_model.mainline)
            if idx > 0 and node.move and node.uid not in self.move_labels
        ]
        if missing:
            return  # keep previous display until all mainline moves are labeled

        white_scores: List[float] = []
        black_scores: List[float] = []
        white_labels: List[str] = []
        black_labels: List[str] = []
        for idx, node in enumerate(self.game_model.mainline):
            if idx == 0 or not node.move:
                continue
            diag = self.move_labels.get(node.uid)
            if not diag:
                continue
            novelty = is_novelty_node(node)
            try:
                parent_fen = node.parent.board_fen if hasattr(node, "parent") else None
                mover_color = chess.Board(parent_fen).turn if parent_fen else None
            except Exception:
                mover_color = None
            if mover_color is None:
                continue
            try:
                score_val = float(diag.move_accuracy)
                label_val = "Novelty" if novelty else str(diag.label)
            except Exception:
                continue
            if mover_color == chess.WHITE:
                white_scores.append(score_val)
                white_labels.append(label_val)
            else:
                black_scores.append(score_val)
                black_labels.append(label_val)

        if not white_scores and not black_scores:
            self.white_accuracy = 0.0
            self.black_accuracy = 0.0
            self.game_accuracy_overall = 0.0
            self.acc_white.setText("--")
            self.acc_black.setText("--")
            return

        # Compute accuracies using label-based weighting
        white_val = compute_player_game_accuracy_label_based(white_scores, white_labels, debug=self.accuracy_debug, label="White") if white_scores else None
        black_val = compute_player_game_accuracy_label_based(black_scores, black_labels, debug=self.accuracy_debug, label="Black") if black_scores else None
        available = [v for v in (white_val, black_val) if v is not None]
        overall_val = sum(available) / len(available) if available else 0.0

        self.white_accuracy = white_val if white_val is not None else 0.0
        self.black_accuracy = black_val if black_val is not None else 0.0
        self.game_accuracy_overall = overall_val if overall_val is not None else 0.0

        self.acc_white.setText("--" if white_val is None else f"{white_val:.1f}")
        self.acc_black.setText("--" if black_val is None else f"{black_val:.1f}")

    def _start_analysis(self) -> None:
        if not self.analysis_enabled or not self.current_state:
            return
        # Favor low-latency responses; limited_time is short, so fast=True by default.
        fast = True if self.engine_settings.analysis_mode == AnalysisMode.LIMITED else self._scrubbing
        self.engine_manager.request(self.current_state.board, fast=fast)

    def _refresh_controls(self) -> None:
        self._on_tree_changed(self.game_model.root)
        self._on_position_changed(
            PositionState(self.game_model.current_board(), None, self.game_model.mainline_index, PositionSource.MAINLINE, self.game_model.root)
        )

    def _set_board_view(
        self,
        state: PositionState,
        current_best: Optional[chess.Move],
        prev_best_override: Optional[chess.Move] = None,
    ) -> None:
        """Always show the current position; arrow points to best move from the previous position."""
        # If user is exploring a variation/novelty (off mainline), show the best move for the current position instead.
        if not state.current_node.is_mainline or state.current_source == PositionSource.VARIATION:
            self.board_widget.set_position(
                state.board,
                None,
                current_best,
                preserve_selection=True,
            )
            return

        # Decide whether to show previous-best or current best.
        show_prev = False
        if state.current_node.parent:
            try:
                parent_turn = chess.Board(state.current_node.parent.board_fen).turn
                # Only show previous-best if it's the same side to move (avoid showing for the side that just moved).
                show_prev = parent_turn == state.board.turn
            except Exception:
                show_prev = False

        if show_prev:
            prev_best = prev_best_override
            if prev_best is None:
                prev_best = self._prev_best_move_for_current()
            # If still missing, try a quick parent probe so the arrow appears promptly.
            if prev_best is None and state.current_node.parent:
                try:
                    engine_path = self.engine_settings.engine_path
                    if engine_path and Path(engine_path).exists():
                        import chess.engine as _ce  # local import to avoid top-level cost
                        parent_board = chess.Board(state.current_node.parent.board_fen)
                        with _ce.SimpleEngine.popen_uci(engine_path) as eng:
                            info = eng.analyse(parent_board, limit=_ce.Limit(time=max(0.15, self.engine_settings.limited_time)))
                            pv = info.get("pv") if isinstance(info, dict) else None
                            if pv:
                                prev_best = pv[0]
                                self.best_move_cache[parent_board.fen()] = prev_best
                except Exception:
                    prev_best = None
            self.board_widget.set_position(
                state.board,
                None,
                prev_best,
                preserve_selection=True,
            )
        else:
            # Show best move for the side to move (current position)
            self.board_widget.set_position(
                state.board,
                None,
                current_best,
                preserve_selection=True,
            )

    def closeEvent(self, event) -> None:
        try:
            if self.label_thread and self.label_thread.isRunning():
                self.label_thread.quit()
                self.label_thread.wait(500)
            if self.preload_thread and self.preload_thread.isRunning():
                self.preload_thread.quit()
                self.preload_thread.wait(500)
            self.engine_manager.shutdown()
            _shutdown_label_engine()
        finally:
            super().closeEvent(event)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    app = QApplication(sys.argv)
    app.setApplicationName("Lichess Analysis")
    window = MainWindow()
    window.resize(1200, 720)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    # Demo: run app; to demo LLM reviewer on a single FEN, uncomment below.
    # reviewer = LLMReviewer()
    # sample_fen = chess.STARTING_FEN
    # print(reviewer.explain_position(sample_fen, [], {}, None))
    def _demo_activity_and_llm():
        engine_path = _default_stockfish_path()
        if not engine_path:
            print("No Stockfish found; skipping demo.")
            return
        eng = chess.engine.SimpleEngine.popen_uci(engine_path)
        wrapper = StockfishEngineWrapper(eng)
        sample_fen = chess.STARTING_FEN
        ctx = build_position_context(sample_fen, wrapper, played_move_uci=None, time_limit_s=0.3, multipv=5)
        print("Activity evidence:")
        print(json.dumps(ctx.get("activity_evidence", {}), indent=2))
        print("Trade context:")
        print(json.dumps(ctx.get("trade_context", {}), indent=2))
        reviewer = LLMReviewer()
        exp = reviewer.explain_from_context(ctx)
        print("LLM JSON:")
        print(json.dumps(exp, indent=2))
        eng.quit()

    def _dev_ep_test():
        """Quick sanity check for EP labels and POV correctness."""
        engine_path = _default_stockfish_path()
        if not engine_path:
            print("No Stockfish found; skipping EP test.")
            return
        fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
        played_move = chess.Move.from_uci("f1c4")
        board = chess.Board(fen)
        with chess.engine.SimpleEngine.popen_uci(engine_path) as eng:
            diag, best_move = compute_move_ep_diagnostics(eng, board, played_move, chess.engine.Limit(time=LABEL_ANALYSIS_TIME))
        raw_loss = diag.ep_before - diag.ep_after
        print("[DevTest] FEN:", fen)
        print("[DevTest] Played:", played_move.uci(), "Best:", best_move.uci() if best_move else "N/A")
        print("[DevTest] EP before:", diag.ep_before, "after:", diag.ep_after, "loss:", diag.ep_loss)
        assert raw_loss >= -1e-6, "EP loss should not be negative when using mover POV"
        print("[DevTest] Label:", diag.label, "Tags:", diag.tags)

    def _dev_positional_tests():
        engine_path = _default_stockfish_path()
        if not engine_path:
            print("No Stockfish found; skipping positional tests.")
            return
        fens = [
            chess.STARTING_FEN,  # quiet
            "rnbqkbnr/pp3ppp/4p3/2pp4/3P4/2N1PN2/PPP2PPP/R1BQKB1R w KQkq - 0 4",  # pawn break idea
            "r1bq1rk1/pp1n1pbp/2pp1np1/2k1p3/2BPP3/2N2N2/PPPQ1PPP/R3K2R w KQ - 2 9",  # potential queen trade
        ]
        reviewer = LLMReviewer()
        with chess.engine.SimpleEngine.popen_uci(engine_path) as eng:
            for fen in fens:
                board = chess.Board(fen)
                info = eng.analyse(board, limit=chess.engine.Limit(time=0.3), multipv=3)
                lines = []
                if isinstance(info, list):
                    for idx, inf in enumerate(info):
                        pv = [mv.uci() for mv in inf.get("pv", [])]
                        score = inf.get("score")
                        cp = score.pov(chess.WHITE).score() if score else None
                        lines.append({"rank": inf.get("multipv", idx + 1), "eval": format_score(score), "evalCp": cp, "pv": pv})
                elif isinstance(info, dict):
                    pv = [mv.uci() for mv in info.get("pv", [])]
                    score = info.get("score")
                    cp = score.pov(chess.WHITE).score() if score else None
                    lines.append({"rank": 1, "eval": format_score(score), "evalCp": cp, "pv": pv})
                pos_ctx = build_positional_context(fen, lines, None)
                exp = reviewer.explain_deep(lines, pos_ctx, None)
                print("FEN:", fen)
                print("PV1:", lines[0].get("pv") if lines else [])
                print("PositionalContext:", json.dumps(pos_ctx, indent=2))
                print("Explanation:", json.dumps(exp, indent=2))

    # Uncomment to run the quick regression demo instead of the GUI
    # _demo_activity_and_llm()
    # _dev_ep_test()
    main()
