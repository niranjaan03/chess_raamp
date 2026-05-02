/**
 * KnightVision - Chess Board Renderer
 * Canvas-based chess board with full interaction
 */

const RAW_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL
  : '';
const CLEAN_BASE_URL = (!RAW_BASE_URL || RAW_BASE_URL === '/') ? '' : RAW_BASE_URL.replace(/\/$/, '');
const PIECE_SIZE_MULTIPLIER = 1.0125;

const ChessBoard = (function() {
  var canvas, ctx, overlay;
  var boundCanvas = null;
  var boundOverlay = null;
  var boardSize = 640;
  var squareSize;
  var flipped = false;
  var selectedSquare = null;
  var possibleMoves = [];
  var lastMove = null;
  var arrows = [];
  var markers = [];
  var reviewQualityLayer = null;
  var reviewQualityAnimationFrame = null;
  var showArrows = true;
  var showCoordinates = true;
  var highlightLast = true;
  var lastMoveMode = 'to';
  var interactionColor = '';
  var allowedMoves = [];
  var interactive = true;
  var showLegalMoves = true;
  var onMoveCallback = null;
  var dragging = false;
  var dragPiece = null;
  var dragFrom = null;
  var dragX = 0, dragY = 0;
  var dragRafId = 0;
  var currentPieceStyle = 'classic';
  var contextMenuHandler = null;
  var pieceImagesLoaded = false;
  var promotionPicker = null;

  var PIECE_ASSET_PATHS = {
    wP: 'Chess_plt45.svg',
    wN: 'Chess_nlt45.svg',
    wB: 'Chess_blt45.svg',
    wR: 'Chess_rlt45.svg',
    wQ: 'Chess_qlt45.svg',
    wK: 'Chess_klt45.svg',
    bP: 'Chess_pdt45.svg',
    bN: 'Chess_ndt45.svg',
    bB: 'Chess_bdt45.svg',
    bR: 'Chess_rdt45.svg',
    bQ: 'Chess_qdt45.svg',
    bK: 'Chess_kdt45.svg'
  };
  var pieceImageCache = {};

  // Board themes
  var THEMES = {
    green:  { light: '#edead0', dark: '#8aa35f', highlight: 'rgba(246, 231, 135, 0.45)', lastmove: 'rgba(244, 220, 92, 0.58)', selected: 'rgba(97, 141, 71, 0.48)', possible: 'rgba(54, 58, 32, 0.22)' },
    brown:  { light: '#f0d9b5', dark: '#b58863', highlight: 'rgba(255,255,100,0.5)', lastmove: 'rgba(205,170,100,0.4)', selected: 'rgba(20,160,20,0.5)', possible: 'rgba(0,0,0,0.15)' },
    blue:   { light: '#d9dbe4', dark: '#4b5570', highlight: 'rgba(255, 231, 134, 0.46)', lastmove: 'rgba(247, 197, 68, 0.34)', selected: 'rgba(98, 209, 214, 0.36)', possible: 'rgba(18, 21, 31, 0.18)' },
    purple: { light: '#2d2b41', dark: '#1a1830', highlight: 'rgba(200,150,255,0.4)', lastmove: 'rgba(150,100,220,0.3)', selected: 'rgba(150,100,255,0.5)', possible: 'rgba(255,255,255,0.1)' },
    dark:   { light: '#4a4a47', dark: '#252525', highlight: 'rgba(247,197,68,0.38)', lastmove: 'rgba(247,197,68,0.26)', selected: 'rgba(151,210,109,0.35)', possible: 'rgba(255,255,255,0.14)' },
    red:    { light: '#f8d0c0', dark: '#c0503a', highlight: 'rgba(255,255,100,0.5)', lastmove: 'rgba(210,150,100,0.4)', selected: 'rgba(50,200,50,0.5)', possible: 'rgba(0,0,0,0.15)' }
  };
  var currentTheme = THEMES.blue;

  var MOVE_QUALITY_VISUALS = {
    brilliant: {
      label: 'Brilliant',
      icon: 'brilliant',
      badgeColor: '#1fc7d4',
      glow: 'rgba(31, 199, 212, 0.78)',
      squareHighlight: 'rgba(31, 199, 212, 0.34)'
    },
    great: {
      label: 'Great',
      icon: 'bang',
      badgeColor: '#4f8df7',
      glow: 'rgba(79, 141, 247, 0.78)',
      squareHighlight: 'rgba(79, 141, 247, 0.36)'
    },
    best: {
      label: 'Best',
      icon: 'star',
      badgeColor: '#86b957',
      glow: 'rgba(134, 185, 87, 0.76)',
      squareHighlight: 'rgba(134, 185, 87, 0.33)'
    },
    excellent: {
      label: 'Excellent',
      icon: 'thumb',
      badgeColor: '#82b457',
      glow: 'rgba(130, 180, 87, 0.70)',
      squareHighlight: 'rgba(130, 180, 87, 0.30)'
    },
    good: {
      label: 'Good',
      icon: 'check',
      badgeColor: '#93ad68',
      glow: 'rgba(147, 173, 104, 0.62)',
      squareHighlight: 'rgba(147, 173, 104, 0.27)'
    },
    book: {
      label: 'Book',
      icon: 'book',
      badgeColor: '#d79a71',
      glow: 'rgba(215, 154, 113, 0.72)',
      squareHighlight: 'rgba(215, 154, 113, 0.36)'
    },
    inaccuracy: {
      label: 'Inaccuracy',
      icon: 'inaccuracy',
      badgeColor: '#f4bf2f',
      glow: 'rgba(244, 191, 47, 0.76)',
      squareHighlight: 'rgba(244, 191, 47, 0.38)'
    },
    mistake: {
      label: 'Mistake',
      icon: 'question',
      badgeColor: '#ff9854',
      glow: 'rgba(255, 152, 84, 0.80)',
      squareHighlight: 'rgba(255, 152, 84, 0.38)'
    },
    miss: {
      label: 'Miss',
      icon: 'miss',
      badgeColor: 'linear-gradient(135deg, #a855f7 0%, #fb923c 100%)',
      glow: 'rgba(251, 146, 60, 0.78)',
      squareHighlight: 'rgba(168, 85, 247, 0.34)'
    },
    blunder: {
      label: 'Blunder',
      icon: 'blunder',
      badgeColor: '#f14e44',
      glow: 'rgba(241, 78, 68, 0.84)',
      squareHighlight: 'rgba(241, 78, 68, 0.42)'
    },
    forced: {
      label: 'Forced',
      icon: 'forced',
      badgeColor: '#64748b',
      glow: 'rgba(100, 116, 139, 0.50)',
      squareHighlight: 'rgba(100, 116, 139, 0.28)'
    },
    interesting: {
      label: 'Interesting',
      icon: 'sparkle',
      badgeColor: '#4f8df7',
      glow: 'rgba(79, 141, 247, 0.58)',
      squareHighlight: 'rgba(79, 141, 247, 0.30)'
    },
    dubious: {
      label: 'Dubious',
      icon: 'question',
      badgeColor: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.56)',
      squareHighlight: 'rgba(245, 158, 11, 0.34)'
    }
  };

  // Unicode chess pieces
  var PIECE_UNICODE = {
    wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
    bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
  };

  // Piece styles tuned to match Chess.com's board, with board piece sizes set
  // directly so the rendered pieces are 25% smaller than the original presets.
  var PIECE_STYLES = {
    classic: {
      renderMode: 'svg',
      pieceScale: 1.05,
      yOffset: 0.032,
      shadowBlur: 1.5,
      shadowX: 0,
      shadowY: 1,
      shadowColor: 'rgba(0,0,0,0.22)',
      typeScale: { p: 0.88, n: 1.02, b: 0.99, r: 0.98, q: 1.03, k: 1.05 },
      fontScale: 0.7275,
      fontWeight: '400',
      fontFamily: '"Times New Roman", Georgia, serif',
      whiteFill: '#cfd8df',
      blackFill: '#a88c53',
      whiteStroke: 'rgba(74, 81, 88, 0.86)',
      blackStroke: 'rgba(65, 49, 23, 0.9)',
      lineWidth: 1.2
    },
    modern: { fontScale: 0.69, yOffset: 0.02, fontWeight: '400', fontFamily: 'system-ui, -apple-system, "Segoe UI Symbol", sans-serif', whiteFill: '#fafafa', blackFill: '#1c1c1e', whiteStroke: 'rgba(0,0,0,0.55)', blackStroke: 'rgba(255,255,255,0.38)', lineWidth: 1.0, shadowBlur: 2, shadowX: 0, shadowY: 1, shadowColor: 'rgba(0,0,0,0.25)' },
    glass: { fontScale: 0.6975, yOffset: 0.02, fontWeight: '400', fontFamily: '"Trebuchet MS", "Segoe UI Symbol", sans-serif', whiteFill: '#f8fafc', blackFill: '#0c0c0e', whiteStroke: 'rgba(255,255,255,0.3)', blackStroke: 'rgba(255,255,255,0.75)', lineWidth: 1.0, shadowBlur: 4, shadowX: 0, shadowY: 1, shadowColor: 'rgba(255,255,255,0.08)', glossy: true },
    minimal: { fontScale: 0.675, yOffset: 0.02, fontWeight: '400', fontFamily: 'system-ui, -apple-system, "Segoe UI Symbol", sans-serif', whiteFill: '#ffffff', blackFill: '#111111', whiteStroke: null, blackStroke: null, lineWidth: 0, shadowBlur: 0, shadowX: 0, shadowY: 0, shadowColor: 'transparent' },
    outline: { fontScale: 0.6975, yOffset: 0.02, fontWeight: '400', fontFamily: '"Georgia", "Segoe UI Symbol", serif', whiteFill: 'rgba(255,255,255,0.14)', blackFill: 'rgba(0,0,0,0.12)', whiteStroke: '#111111', blackStroke: '#f4f4f5', lineWidth: 2.0, shadowBlur: 0, shadowX: 0, shadowY: 0, shadowColor: 'transparent' },
    bold: { fontScale: 0.7125, yOffset: 0.02, fontWeight: '700', fontFamily: '"Arial Black", "Segoe UI Symbol", sans-serif', whiteFill: '#ffffff', blackFill: '#0a0a0a', whiteStroke: 'rgba(0,0,0,0.85)', blackStroke: 'rgba(255,255,255,0.75)', lineWidth: 1.6, shadowBlur: 2, shadowX: 0, shadowY: 1, shadowColor: 'rgba(0,0,0,0.35)' }
  };

  function init(canvasId, overlayId, onMove) {
    if (boundCanvas) {
      boundCanvas.removeEventListener('mousedown', onMouseDown);
      boundCanvas.removeEventListener('mousemove', onMouseMove);
      boundCanvas.removeEventListener('mouseup', onMouseUp);
      boundCanvas.removeEventListener('touchstart', onTouchStart);
      boundCanvas.removeEventListener('touchmove', onTouchMove);
      boundCanvas.removeEventListener('touchend', onTouchEnd);
      if (contextMenuHandler) {
        boundCanvas.removeEventListener('contextmenu', contextMenuHandler);
      }
    }
    if (boundOverlay) {
      boundOverlay.removeEventListener('click', onPromotionPickerClick);
    }

    canvas = document.getElementById(canvasId);
    overlay = document.getElementById(overlayId);
    if (!canvas || !overlay) return;
    ctx = canvas.getContext('2d');
    onMoveCallback = onMove;
    boundCanvas = canvas;
    boundOverlay = overlay;
    interactive = true;
    selectedSquare = null;
    possibleMoves = [];
    dragging = false;
    dragPiece = null;
    dragFrom = null;
    reviewQualityLayer = null;
    promotionPicker = null;
    preloadPieceImages();
    
    // Set up responsive canvas
    resize();
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, {passive:false});
    canvas.addEventListener('touchmove', onTouchMove, {passive:false});
    canvas.addEventListener('touchend', onTouchEnd, {passive:false});
    overlay.addEventListener('click', onPromotionPickerClick);
    contextMenuHandler = function(e) {
      e.preventDefault();
      clearArrows();
      drawBoard(currentPosition);
    };
    canvas.addEventListener('contextmenu', contextMenuHandler);
    
    drawEmpty();
  }

  function resize() {
    var container = canvas.parentElement;
    var maxSize = Math.min(container.offsetWidth || 640, 760);
    boardSize = maxSize;
    canvas.width = boardSize;
    canvas.height = boardSize;
    squareSize = boardSize / 8;
  }

  function getPieceAssetUrl(fileName) {
    return (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/chess-pieces/cburnett/' + fileName;
  }

  function preloadPieceImages() {
    if (pieceImagesLoaded || typeof Image === 'undefined') return;
    pieceImagesLoaded = true;
    Object.keys(PIECE_ASSET_PATHS).forEach(function(key) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function() {
        if (currentPosition) drawBoard(currentPosition);
      };
      img.src = getPieceAssetUrl(PIECE_ASSET_PATHS[key]);
      pieceImageCache[key] = img;
    });
  }

  function getMoveQualityVisual(quality) {
    var key = String(quality || '').toLowerCase();
    return MOVE_QUALITY_VISUALS[key] || null;
  }

  function easeOutCubic(t) {
    var x = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - x, 3);
  }

  function getReviewLayerProgress() {
    if (!reviewQualityLayer || !reviewQualityLayer.startedAt || typeof performance === 'undefined') return 1;
    var elapsed = performance.now() - reviewQualityLayer.startedAt;
    return easeOutCubic(elapsed / 230);
  }

  function scheduleReviewQualityAnimation() {
    if (!reviewQualityLayer || reviewQualityAnimationFrame || typeof requestAnimationFrame !== 'function') return;
    reviewQualityAnimationFrame = requestAnimationFrame(function tick() {
      reviewQualityAnimationFrame = null;
      if (!reviewQualityLayer || !currentPosition) return;
      drawBoard(currentPosition);
      if (getReviewLayerProgress() < 1) {
        scheduleReviewQualityAnimation();
      }
    });
  }

  function normalizeReviewQualityLayer(layer) {
    if (!layer || !layer.square) return null;
    var quality = String(layer.quality || '').toLowerCase();
    var visual = getMoveQualityVisual(quality);
    if (!visual) return null;
    return {
      square: layer.square,
      from: layer.from || '',
      to: layer.to || layer.square,
      quality: quality,
      label: layer.label || visual.label,
      visual: visual,
      startedAt: typeof performance !== 'undefined' ? performance.now() : 0
    };
  }

  var currentPosition = null;
  var currentChess = null;

  function setPosition(chess) {
    cancelMoveAnimation();
    promotionPicker = null;
    currentChess = chess;
    currentPosition = fenToBoard(chess.fen());
    drawBoard(currentPosition);
  }

  var moveAnimRafId = 0;
  var MOVE_ANIM_DURATION_MS = 140;

  function cancelMoveAnimation() {
    if (moveAnimRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(moveAnimRafId);
    }
    moveAnimRafId = 0;
    if (dragging && !dragPiece) return; // real pointer drag, leave alone
    if (dragging && dragPiece && dragFrom && !dragX && !dragY) return;
    // If a move animation was in flight (dragging set by us, no real pointer
    // drag), clear the synthetic drag state.
    if (dragging && dragFromIsAnimated) {
      dragging = false;
      dragFrom = null;
      dragPiece = null;
      dragFromIsAnimated = false;
    }
  }

  // Distinguishes synthetic animation drags from real pointer drags so
  // cancelMoveAnimation doesn't kill a user's in-progress drag.
  var dragFromIsAnimated = false;

  function setPositionAnimated(chess, fromSq, toSq) {
    if (!fromSq || !toSq || !currentPosition || dragging) {
      setPosition(chess);
      return;
    }
    var movingPiece = currentPosition[fromSq];
    var startXY = squareToXY(fromSq);
    var endXY = squareToXY(toSq);
    if (!movingPiece || !startXY || !endXY || typeof requestAnimationFrame !== 'function') {
      setPosition(chess);
      return;
    }
    cancelMoveAnimation();

    var nextChess = chess;
    var nextPosition = fenToBoard(chess.fen());
    var startTs = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    // Synthetic drag: drawBoard already skips the piece at dragFrom and draws
    // the dragged piece at dragX/dragY, so we just animate those values.
    dragging = true;
    dragFromIsAnimated = true;
    dragFrom = fromSq;
    dragPiece = movingPiece;
    dragX = startXY.x + squareSize / 2;
    dragY = startXY.y + squareSize / 2;

    function tick(now) {
      var t = Math.min(1, (now - startTs) / MOVE_ANIM_DURATION_MS);
      // ease-out cubic
      var eased = 1 - Math.pow(1 - t, 3);
      dragX = startXY.x + (endXY.x - startXY.x) * eased + squareSize / 2;
      dragY = startXY.y + (endXY.y - startXY.y) * eased + squareSize / 2;
      drawBoard(currentPosition);
      if (t < 1) {
        moveAnimRafId = requestAnimationFrame(tick);
      } else {
        moveAnimRafId = 0;
        dragging = false;
        dragFromIsAnimated = false;
        dragFrom = null;
        dragPiece = null;
        currentChess = nextChess;
        currentPosition = nextPosition;
        drawBoard(currentPosition);
      }
    }
    moveAnimRafId = requestAnimationFrame(tick);
  }

  function fenToBoard(fen) {
    var board = {};
    var rows = fen.split(' ')[0].split('/');
    var ranks = '87654321';
    var files = 'abcdefgh';
    
    for (var r = 0; r < 8; r++) {
      var col = 0;
      for (var c = 0; c < rows[r].length; c++) {
        var ch = rows[r][c];
        if (!isNaN(ch)) {
          col += parseInt(ch);
        } else {
          var sq = files[col] + ranks[r];
          var color = ch === ch.toUpperCase() ? 'w' : 'b';
          board[sq] = { color: color, type: ch.toLowerCase() };
          col++;
        }
      }
    }
    return board;
  }

  function drawEmpty() {
    drawBoard({});
  }

  function drawBoard(position) {
    if (!ctx) return;
    ctx.clearRect(0, 0, boardSize, boardSize);
    
    var files = 'abcdefgh';
    var ranks = '87654321';
    
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var displayRow = flipped ? 7 - row : row;
        var displayCol = flipped ? 7 - col : col;
        
        var sq = files[col] + ranks[row];
        var x = displayCol * squareSize;
        var y = displayRow * squareSize;
        
        // Square color
        var isLight = (row + col) % 2 === 0;
        ctx.fillStyle = isLight ? currentTheme.light : currentTheme.dark;
        ctx.fillRect(x, y, squareSize, squareSize);
        
        // Last move highlight
        var shouldHighlightLastMove = false;
        if (highlightLast && lastMove) {
          if (lastMoveMode === 'to') shouldHighlightLastMove = sq === lastMove.to;
          else if (lastMoveMode === 'from') shouldHighlightLastMove = sq === lastMove.from;
          else shouldHighlightLastMove = (sq === lastMove.from || sq === lastMove.to);
        }
        if (shouldHighlightLastMove) {
          ctx.fillStyle = currentTheme.lastmove;
          ctx.fillRect(x, y, squareSize, squareSize);
        }

        if (reviewQualityLayer && reviewQualityLayer.square === sq) {
          drawReviewQualitySquare(x, y, reviewQualityLayer.visual, getReviewLayerProgress());
        }
        
        // Selected square
        if (selectedSquare === sq) {
          ctx.fillStyle = currentTheme.selected;
          ctx.fillRect(x, y, squareSize, squareSize);
        }
        
        // Possible moves
        if (showLegalMoves && possibleMoves.indexOf(sq) !== -1) {
          if (position[sq]) {
            // Capture - ring
            ctx.strokeStyle = currentTheme.possible;
            ctx.lineWidth = squareSize * 0.08;
            ctx.strokeRect(x + 2, y + 2, squareSize - 4, squareSize - 4);
          } else {
            // Move - dot
            ctx.fillStyle = currentTheme.possible;
            ctx.beginPath();
            ctx.arc(x + squareSize/2, y + squareSize/2, squareSize * 0.15, 0, Math.PI*2);
            ctx.fill();
          }
        }
        
        // Coordinates
        if (showCoordinates) {
          ctx.font = 'bold ' + (squareSize * 0.16) + 'px "IBM Plex Mono"';
          ctx.fillStyle = isLight ? currentTheme.dark : currentTheme.light;
          ctx.globalAlpha = 0.7;
          if (displayCol === 0) {
            ctx.fillText(ranks[row], x + 3, y + squareSize * 0.22);
          }
          if (displayRow === 7) {
            ctx.textAlign = 'right';
            ctx.fillText(files[col], x + squareSize - 3, y + squareSize - 3);
            ctx.textAlign = 'left';
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    // Draw pieces (skip dragged piece)
    for (var square in position) {
      if (square === dragFrom && dragging) continue;
      var piece = position[square];
      if (piece) {
        drawPiece(piece, square);
      }
    }
    
    // Do not darken or color the chess piece when a move square is highlighted;
    // highlight the square only, never the piece.
    drawReviewMoveArrow();

    // Draw dragged piece at mouse position
    if (dragging && dragPiece) {
      drawPieceAtXY(dragPiece, dragX - squareSize/2, dragY - squareSize/2);
    }

    renderOverlay();
  }

  function drawPiece(piece, square) {
    var pos = squareToXY(square);
    if (!pos) return;
    drawPieceAtXY(piece, pos.x, pos.y);
  }

  function drawPieceAtXY(piece, x, y) {
    var style = PIECE_STYLES[currentPieceStyle] || PIECE_STYLES.classic;
    if (style.renderMode === 'svg' && drawPieceImage(piece, style, x, y)) {
      return;
    }

    var key = piece.color + piece.type.toUpperCase();
    var unicode = PIECE_UNICODE[key] || PIECE_UNICODE[piece.color + piece.type.toUpperCase()];

    if (!unicode) return;

    var centerX = x + squareSize / 2;
    // Chess.com-style offset: pieces sit slightly lower in the square
    var yOff = (style.yOffset || 0) * squareSize;
    var centerY = y + squareSize / 2 + yOff;
    var fontSize = squareSize * style.fontScale * PIECE_SIZE_MULTIPLIER;
    var stroke = piece.color === 'w' ? style.whiteStroke : style.blackStroke;

    ctx.save();
    ctx.font = style.fontWeight + ' ' + fontSize + 'px ' + style.fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur;
    ctx.shadowOffsetX = style.shadowX;
    ctx.shadowOffsetY = style.shadowY;

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = style.lineWidth;
      ctx.strokeText(unicode, centerX, centerY);
    }

    ctx.fillStyle = getPieceFillStyle(piece, style, x, y);
    ctx.fillText(unicode, centerX, centerY);
    ctx.restore();
  }

  function drawPieceImage(piece, style, x, y) {
    var metrics = getPieceImageMetrics(piece, style, x, y);
    if (!metrics) return false;

    ctx.save();
    ctx.shadowColor = style.shadowColor || 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = style.shadowBlur || 0;
    ctx.shadowOffsetX = style.shadowX || 0;
    ctx.shadowOffsetY = style.shadowY || 0;
    ctx.drawImage(metrics.img, metrics.x, metrics.y, metrics.size, metrics.size);
    ctx.restore();
    return true;
  }

  function getPieceImageMetrics(piece, style, x, y) {
    var key = piece.color + piece.type.toUpperCase();
    var img = pieceImageCache[key];
    if (!img || !img.complete || !img.naturalWidth) return null;

    var perTypeScale = style.typeScale && style.typeScale[piece.type] ? style.typeScale[piece.type] : 1;
    var baseDrawSize = squareSize * (style.pieceScale || 1) * perTypeScale * PIECE_SIZE_MULTIPLIER;
    var drawSize = Math.min(baseDrawSize, squareSize * 2.1);
    var offsetX = (squareSize - drawSize) / 2;
    var offsetY = (squareSize - drawSize) / 2 + ((style.yOffset || 0) * squareSize);

    return {
      img: img,
      x: x + offsetX,
      y: y + offsetY,
      size: drawSize
    };
  }

  function drawReviewQualitySquare(x, y, visual, progress) {
    if (!visual) return;
    var alpha = Math.max(0, Math.min(1, progress || 1));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = visual.squareHighlight;
    ctx.fillRect(x, y, squareSize, squareSize);

    var gradient = ctx.createRadialGradient(
      x + squareSize * 0.62,
      y + squareSize * 0.42,
      squareSize * 0.06,
      x + squareSize * 0.5,
      y + squareSize * 0.5,
      squareSize * 0.72
    );
    gradient.addColorStop(0, visual.glow);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, squareSize, squareSize);

    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = visual.glow;
    ctx.lineWidth = Math.max(1.5, squareSize * 0.018);
    ctx.strokeRect(x + 1, y + 1, squareSize - 2, squareSize - 2);
    ctx.restore();
  }

  function drawReviewMoveArrow() {
    if (!reviewQualityLayer || !reviewQualityLayer.from || !reviewQualityLayer.to || reviewQualityLayer.from === reviewQualityLayer.to) return;
    var from = squareToXY(reviewQualityLayer.from);
    var to = squareToXY(reviewQualityLayer.to);
    var visual = reviewQualityLayer.visual;
    if (!from || !to || !visual) return;

    var progress = getReviewLayerProgress();
    var startX = from.x + squareSize / 2;
    var startY = from.y + squareSize / 2;
    var endX = to.x + squareSize / 2;
    var endY = to.y + squareSize / 2;
    var dx = endX - startX;
    var dy = endY - startY;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return;

    var nx = dx / len;
    var ny = dy / len;
    var shortenedEndX = endX - nx * squareSize * 0.24;
    var shortenedEndY = endY - ny * squareSize * 0.24;
    var arrowWidth = Math.max(10, squareSize * 0.16);
    var headLen = Math.max(22, squareSize * 0.34);
    var headWidth = Math.max(26, squareSize * 0.42);
    var baseX = shortenedEndX - nx * headLen;
    var baseY = shortenedEndY - ny * headLen;
    var px = -ny;
    var py = nx;

    ctx.save();
    ctx.globalAlpha = 0.85 * progress;
    ctx.strokeStyle = visual.glow;
    ctx.lineWidth = arrowWidth;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(baseX, baseY);
    ctx.stroke();

    ctx.fillStyle = visual.glow;
    ctx.beginPath();
    ctx.moveTo(shortenedEndX, shortenedEndY);
    ctx.lineTo(baseX + px * headWidth / 2, baseY + py * headWidth / 2);
    ctx.lineTo(baseX - px * headWidth / 2, baseY - py * headWidth / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function getPieceFillStyle(piece, style, x, y) {
    var baseFill = piece.color === 'w' ? style.whiteFill : style.blackFill;
    if (!style.glossy) return baseFill;

    var gradient = ctx.createLinearGradient(x, y, x + squareSize, y + squareSize);
    if (piece.color === 'w') {
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.45, '#e4e4e7');
      gradient.addColorStop(1, '#a1a1aa');
    } else {
      gradient.addColorStop(0, '#71717a');
      gradient.addColorStop(0.45, '#18181b');
      gradient.addColorStop(1, '#000000');
    }
    return gradient;
  }

  function squareToXY(square) {
    if (!square || square.length < 2) return null;
    var files = 'abcdefgh';
    var col = files.indexOf(square[0]);
    var row = 8 - parseInt(square[1]);
    
    if (col === -1 || isNaN(row)) return null;
    
    var displayCol = flipped ? 7 - col : col;
    var displayRow = flipped ? 7 - row : row;
    
    return { x: displayCol * squareSize, y: displayRow * squareSize };
  }

  function xyToSquare(x, y) {
    var files = 'abcdefgh';
    var col = Math.floor(x / squareSize);
    var row = Math.floor(y / squareSize);
    
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    
    var boardCol = flipped ? 7 - col : col;
    var boardRow = flipped ? 7 - row : row;
    
    return files[boardCol] + (8 - boardRow);
  }

  function buildArrowSvg() {
    var activeArrows = showArrows ? arrows : [];
    if (!activeArrows.length) return '';

    var shaftWidth = squareSize * 0.18;
    var headLen = squareSize * 0.36;
    var headWidth = squareSize * 0.46;
    var tipInset = squareSize * 0.16;

    var svgArrows = activeArrows.map(function(arrow) {
      var from = squareToXY(arrow.from);
      var to = squareToXY(arrow.to);
      if (!from || !to) return '';

      var fromX = from.x + squareSize / 2;
      var fromY = from.y + squareSize / 2;
      var toX = to.x + squareSize / 2;
      var toY = to.y + squareSize / 2;

      var dx = toX - fromX;
      var dy = toY - fromY;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (!len) return '';

      var nx = dx / len;
      var ny = dy / len;
      var px = -ny;
      var py = nx;

      var tipX = toX - nx * tipInset;
      var tipY = toY - ny * tipInset;
      var baseX = tipX - nx * headLen;
      var baseY = tipY - ny * headLen;

      var color = arrow.color || 'rgba(200,80,80,0.75)';

      var line = `<line x1="${fromX}" y1="${fromY}" x2="${baseX}" y2="${baseY}"
              stroke="${color}" stroke-width="${shaftWidth}" stroke-linecap="butt"/>`;

      var headP1X = tipX;
      var headP1Y = tipY;
      var headP2X = baseX + px * headWidth / 2;
      var headP2Y = baseY + py * headWidth / 2;
      var headP3X = baseX - px * headWidth / 2;
      var headP3Y = baseY - py * headWidth / 2;

      var head = `<polygon points="${headP1X},${headP1Y} ${headP2X},${headP2Y} ${headP3X},${headP3Y}" fill="${color}"/>`;

      return line + head;
    });

    return `<svg class="arrow-svg" viewBox="0 0 ${boardSize} ${boardSize}">
      ${svgArrows.join('')}
    </svg>`;
  }

  function buildMarkerHtml() {
    if (!markers.length) return '';
    return markers.map(function(marker) {
      var pos = squareToXY(marker.square);
      if (!pos) return '';
      var left = pos.x + (squareSize / 2);
      var top = pos.y + (squareSize * 0.16);
      var title = marker.title ? String(marker.title).replace(/"/g, '&quot;') : '';
      return `<div class="board-marker" style="left:${left}px;top:${top}px;"${title ? ` title="${title}"` : ''}>
        <span class="${marker.className || 'qi qi-best'}">${marker.text || ''}</span>
      </div>`;
    }).join('');
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function getPieceAssetFor(color, type) {
    return getPieceAssetUrl(PIECE_ASSET_PATHS[color + String(type || '').toUpperCase()] || '');
  }

  function buildPromotionPickerHtml() {
    if (!promotionPicker || !promotionPicker.to || !promotionPicker.color) return '';
    var pos = squareToXY(promotionPicker.to);
    if (!pos) return '';

    var choices = promotionPicker.color === 'w' ? ['q', 'r', 'b', 'n'] : ['n', 'b', 'r', 'q'];
    var pickerWidth = squareSize * 0.92;
    var top = promotionPicker.color === 'w' ? pos.y : pos.y - (squareSize * 3);
    top = Math.max(0, Math.min(boardSize - squareSize * 4, top));
    var left = Math.max(0, Math.min(boardSize - pickerWidth, pos.x + (squareSize - pickerWidth) / 2));

    var leftPct = (left / boardSize) * 100;
    var topPct = (top / boardSize) * 100;
    var widthPct = (pickerWidth / boardSize) * 100;
    var squarePct = (squareSize / boardSize) * 100;
    var color = promotionPicker.color;

    var buttons = choices.map(function(type) {
      var key = color + type.toUpperCase();
      var label = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[type] || 'Queen';
      var imgSrc = getPieceAssetFor(color, type);
      var fallback = PIECE_UNICODE[key] || label.charAt(0);
      return '<button type="button" class="board-promotion-choice" data-promotion="' + type + '" aria-label="Promote to ' + label + '">' +
        (imgSrc
          ? '<img class="board-promotion-piece" src="' + escapeAttr(imgSrc) + '" alt="" aria-hidden="true">'
          : '<span class="board-promotion-piece-text" aria-hidden="true">' + fallback + '</span>') +
        '</button>';
    }).join('');

    return '<div class="board-promotion-backdrop" aria-hidden="true"></div>' +
      '<div class="board-promotion-picker" role="dialog" aria-label="Choose promotion piece"' +
      ' style="left:' + leftPct.toFixed(3) + '%;top:' + topPct.toFixed(3) + '%;' +
      '--promotion-picker-width:' + widthPct.toFixed(3) + '%;' +
      '--promotion-square-size:' + squarePct.toFixed(3) + '%;">' +
      buttons +
      '</div>';
  }

  function buildReviewQualityBadgeHtml() {
    if (!reviewQualityLayer || !reviewQualityLayer.square || !reviewQualityLayer.visual) return '';
    var pos = squareToXY(reviewQualityLayer.square);
    if (!pos) return '';

    var visual = reviewQualityLayer.visual;
    var badgeSize = squareSize * 0.58;
    var left = pos.x + squareSize * 0.73;
    var top = pos.y + squareSize * 0.13;
    var inset = badgeSize * 0.5 + 2;
    left = Math.max(inset, Math.min(boardSize - inset, left));
    top = Math.max(inset, Math.min(boardSize - inset, top));

    var leftPct = (left / boardSize) * 100;
    var topPct = (top / boardSize) * 100;
    var sizePct = (badgeSize / boardSize) * 100;
    var title = escapeAttr(reviewQualityLayer.label || visual.label);
    var quality = escapeAttr(reviewQualityLayer.quality || 'good');
    var icon = buildMoveQualityBadgeIcon(visual.icon);

    return '<div class="review-quality-badge review-quality-badge--' + quality + '"' +
      ' style="left:' + leftPct.toFixed(3) + '%;top:' + topPct.toFixed(3) + '%;' +
      '--mq-badge-size:' + sizePct.toFixed(3) + '%;' +
      '--mq-badge-bg:' + escapeAttr(visual.badgeColor) + ';' +
      '--mq-badge-glow:' + escapeAttr(visual.glow) + ';"' +
      ' title="' + title + '" aria-label="' + title + '">' + icon + '</div>';
  }

  function svgTextIcon(text, size, weight) {
    return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
      '<text x="16" y="21.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" ' +
      'font-size="' + (size || 18) + '" font-weight="' + (weight || 900) + '" fill="currentColor">' +
      escapeAttr(text) + '</text></svg>';
  }

  function buildMoveQualityBadgeIcon(icon) {
    switch (icon) {
      case 'brilliant':
        return svgTextIcon('!!', 14, 950);
      case 'sparkle':
        return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
          '<path d="M16 3.5 18.9 12l8.6 3.1-8.6 3.1L16 26.5l-2.9-8.3-8.6-3.1 8.6-3.1L16 3.5Z" fill="currentColor"/>' +
          '<path d="M25 3.8 26.1 7l3.1 1.1-3.1 1.1L25 12.5 23.9 9.2l-3.1-1.1L23.9 7 25 3.8Z" fill="currentColor" opacity=".72"/>' +
          '</svg>';
      case 'star':
        return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
          '<path d="m16 3.8 3.6 7.3 8.1 1.2-5.8 5.7 1.4 8-7.3-3.8L8.7 26l1.4-8-5.8-5.7 8.1-1.2L16 3.8Z" fill="currentColor"/>' +
          '</svg>';
      case 'thumb':
        return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
          '<path d="M7 14h5v13H7V14Zm7 12h9.5c1.5 0 2.8-1 3.1-2.5l1.6-7.3c.4-1.9-1-3.7-2.9-3.7h-6.1l.8-4.1c.2-1-.1-2-.8-2.7L18 4.5l-5.1 6.2c-.6.7-.9 1.6-.9 2.5V24c0 1.1.9 2 2 2Z" fill="currentColor"/>' +
          '</svg>';
      case 'check':
        return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
          '<path d="M12.8 22.5 6.4 16l2.9-2.8 3.5 3.6 9.9-10 2.9 2.8-12.8 12.9Z" fill="currentColor"/>' +
          '</svg>';
      case 'book':
        return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
          '<path d="M6 7.5c0-1.1.9-2 2-2h6.2c1.1 0 2.1.4 2.8 1.2.7-.8 1.7-1.2 2.8-1.2H26v19h-6.8c-.9 0-1.7.3-2.2.9-.6-.6-1.4-.9-2.2-.9H6v-17Z" fill="currentColor"/>' +
          '<path d="M16 8.6v14.7M9.5 9.2h4.2M20.3 9.2h4.2" stroke="rgba(0,0,0,.28)" stroke-width="1.7" stroke-linecap="round"/>' +
          '</svg>';
      case 'bang':
        return svgTextIcon('!', 24, 950);
      case 'inaccuracy':
        return svgTextIcon('?!', 15, 950);
      case 'question':
        return svgTextIcon('?', 22, 950);
      case 'blunder':
        return svgTextIcon('??', 15, 950);
      case 'miss':
        return svgTextIcon('!', 23, 950);
      case 'forced':
        return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
          '<path d="M7 16h13.5l-5-5L18 8.5 27.5 18 18 27.5 15.5 25l5-5H7v-4Z" fill="currentColor"/>' +
          '</svg>';
      default:
        return svgTextIcon('?', 22, 950);
    }
  }

  function renderOverlay() {
    if (!overlay) return;
    var html = buildArrowSvg() + buildMarkerHtml() + buildReviewQualityBadgeHtml() + buildPromotionPickerHtml();
    overlay.innerHTML = html;
  }

  function clearArrows() {
    arrows = [];
    renderOverlay();
  }

  function clearPromotionPicker() {
    promotionPicker = null;
    renderOverlay();
  }

  function onPromotionPickerClick(event) {
    if (event.target && event.target.classList && event.target.classList.contains('board-promotion-backdrop')) {
      event.preventDefault();
      event.stopPropagation();
      clearPromotionPicker();
      if (currentPosition) drawBoard(currentPosition);
      return;
    }
    var button = event.target && event.target.closest
      ? event.target.closest('.board-promotion-choice')
      : null;
    if (!button || !promotionPicker) return;
    event.preventDefault();
    event.stopPropagation();
    var choice = button.getAttribute('data-promotion') || 'q';
    var pending = promotionPicker;
    promotionPicker = null;
    completeMove(pending.from, pending.to, choice);
  }

  function setArrows(arrowList) {
    arrows = arrowList || [];
    renderOverlay();
  }

  function setMarkers(markerList) {
    markers = markerList || [];
    renderOverlay();
  }

  function clearMarkers() {
    markers = [];
    renderOverlay();
  }

  function setReviewMoveQuality(layer) {
    var next = normalizeReviewQualityLayer(layer);
    // Idempotent: if the incoming layer matches the existing one, keep the
    // current animation timeline. Otherwise the fade-in restarts on every
    // banner refresh and the glow visibly flickers.
    if (next && reviewQualityLayer
      && reviewQualityLayer.square === next.square
      && reviewQualityLayer.from === next.from
      && reviewQualityLayer.to === next.to
      && reviewQualityLayer.quality === next.quality) {
      reviewQualityLayer.label = next.label;
      reviewQualityLayer.visual = next.visual;
      return;
    }
    reviewQualityLayer = next;
    if (currentPosition) drawBoard(currentPosition);
    scheduleReviewQualityAnimation();
  }

  function clearReviewMoveQuality() {
    reviewQualityLayer = null;
    if (reviewQualityAnimationFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(reviewQualityAnimationFrame);
    }
    reviewQualityAnimationFrame = null;
    if (currentPosition) drawBoard(currentPosition);
    else renderOverlay();
  }

  // Mouse event handling
  var rightClickFrom = null;

  function getMousePos(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function onMouseDown(e) {
    if (e.button === 2) {
      rightClickFrom = xyToSquare(getMousePos(e).x, getMousePos(e).y);
      return;
    }

    if (!interactive) {
      selectedSquare = null;
      possibleMoves = [];
      dragging = false;
      drawBoard(currentPosition);
      return;
    }
    
    var pos = getMousePos(e);
    var sq = xyToSquare(pos.x, pos.y);
    if (!sq) return;
    
    clearArrows();
    
    if (currentChess && currentPosition && currentPosition[sq]) {
      var piece = currentPosition[sq];
      var activeColor = interactionColor || currentChess.turn();
      if (currentChess.turn() === activeColor && piece.color === activeColor) {
        // Start drag
        dragging = true;
        dragFrom = sq;
        dragPiece = piece;
        dragX = pos.x;
        dragY = pos.y;
        
        // Compute possible moves
        if (selectedSquare === sq) {
          selectedSquare = null;
          possibleMoves = [];
        } else {
          selectedSquare = sq;
          var moves = currentChess.moves({square: sq, verbose: true});
          possibleMoves = moves
            .map(function(m) { return m.to; })
            .filter(function(target) { return isAllowedMove(sq, target); });
        }
        drawBoard(currentPosition);
      }
    }
    
  }

  function onMouseMove(e) {
    if (!dragging) return;
    var pos = getMousePos(e);
    dragX = pos.x;
    dragY = pos.y;
    // Coalesce multiple pointer-move events into a single canvas redraw per
    // animation frame; eliminates jank on high-refresh-rate displays where
    // pointer events can fire 100+ times per second.
    if (dragRafId || typeof requestAnimationFrame !== 'function') {
      if (typeof requestAnimationFrame !== 'function') drawBoard(currentPosition);
      return;
    }
    dragRafId = requestAnimationFrame(function() {
      dragRafId = 0;
      if (dragging) drawBoard(currentPosition);
    });
  }

  function onMouseUp(e) {
    if (e.button === 2 && rightClickFrom) {
      var pos = getMousePos(e);
      var sq = xyToSquare(pos.x, pos.y);
      if (sq && sq !== rightClickFrom) {
        arrows.push({from: rightClickFrom, to: sq, color: 'rgba(220,60,60,0.8)'});
        drawBoard(currentPosition);
      }
      rightClickFrom = null;
      return;
    }
    
    if (!dragging) {
      // Click handling
      var pos2 = getMousePos(e);
      var sq2 = xyToSquare(pos2.x, pos2.y);
      handleSquareClick(sq2);
      return;
    }
    
    // Drop handling
    var pos3 = getMousePos(e);
    var toSq = xyToSquare(pos3.x, pos3.y);

    dragging = false;
    if (dragRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(dragRafId);
      dragRafId = 0;
    }

    if (toSq && dragFrom && toSq !== dragFrom) {
      attemptMove(dragFrom, toSq);
    } else {
      drawBoard(currentPosition);
    }

    dragFrom = null;
    dragPiece = null;
  }

  function handleSquareClick(sq) {
    if (!interactive || !sq || !currentChess) return;
    var activeColor = interactionColor || currentChess.turn();
    
    if (selectedSquare && possibleMoves.indexOf(sq) !== -1) {
      attemptMove(selectedSquare, sq);
      return;
    }
    
    if (currentPosition && currentPosition[sq]) {
      var piece = currentPosition[sq];
      if (currentChess.turn() === activeColor && piece.color === activeColor) {
        selectedSquare = sq;
        var moves = currentChess.moves({square: sq, verbose: true});
        possibleMoves = moves
          .map(function(m) { return m.to; })
          .filter(function(target) { return isAllowedMove(sq, target); });
        drawBoard(currentPosition);
        return;
      }
    }
    
    selectedSquare = null;
    possibleMoves = [];
    drawBoard(currentPosition);
  }

  function attemptMove(from, to) {
    if (!interactive || !currentChess) return;
    if (interactionColor && currentChess.turn() !== interactionColor) {
      drawBoard(currentPosition);
      return;
    }
    if (possibleMoves.indexOf(to) === -1) {
      selectedSquare = null;
      possibleMoves = [];
      drawBoard(currentPosition);
      return;
    }
    
    selectedSquare = null;
    possibleMoves = [];
    
    var piece = currentChess.get(from);
    if (isPromotionMove(piece, to)) {
      promotionPicker = { from: from, to: to, color: piece.color };
      drawBoard(currentPosition);
      return;
    }

    completeMove(from, to, null);
  }

  function isPromotionMove(piece, to) {
    if (!piece || piece.type !== 'p' || !to) return false;
    var toRank = parseInt(to[1]);
    return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
  }

  function completeMove(from, to, promo) {
    if (!interactive || !currentChess) return;
    var moveObj = {from: from, to: to};
    if (promo) moveObj.promotion = promo;
    
    var result = currentChess.move(moveObj);
    if (result) {
      lastMove = {from: from, to: to};
      currentPosition = fenToBoard(currentChess.fen());
      drawBoard(currentPosition);
      
      if (typeof onMoveCallback === 'function') {
        onMoveCallback(result, currentChess.fen());
      }
    } else {
      drawBoard(currentPosition);
    }
  }

  function isAllowedMove(from, to) {
    if (!allowedMoves || !allowedMoves.length) return true;
    return allowedMoves.some(function(move) {
      return move && move.from === from && move.to === to;
    });
  }

  // Touch events
  function onTouchStart(e) {
    e.preventDefault();
    var touch = e.touches[0];
    onMouseDown({button: 0, clientX: touch.clientX, clientY: touch.clientY});
  }
  function onTouchMove(e) {
    e.preventDefault();
    var touch = e.touches[0];
    onMouseMove({clientX: touch.clientX, clientY: touch.clientY});
  }
  function onTouchEnd(e) {
    e.preventDefault();
    var touch = e.changedTouches[0];
    onMouseUp({button: 0, clientX: touch.clientX, clientY: touch.clientY});
  }

  // Public API
  return {
    init: init,
    setPosition: setPosition,
    setPositionAnimated: setPositionAnimated,
    setTheme: function(name) { currentTheme = THEMES[name] || THEMES.green; if (currentPosition) drawBoard(currentPosition); },
    setPieceStyle: function(name) { currentPieceStyle = PIECE_STYLES[name] ? name : 'classic'; if (currentPosition) drawBoard(currentPosition); },
    flip: function() { flipped = !flipped; if (currentPosition) drawBoard(currentPosition); },
    setFlipped: function(f) { flipped = f; if (currentPosition) drawBoard(currentPosition); },
    setArrows: setArrows,
    clearArrows: clearArrows,
    setMarkers: setMarkers,
    clearMarkers: clearMarkers,
    setReviewMoveQuality: setReviewMoveQuality,
    clearReviewMoveQuality: clearReviewMoveQuality,
    setLastMove: function(from, to) { lastMove = from ? {from:from, to:to} : null; if (currentPosition) drawBoard(currentPosition); },
    setOptions: function(opts) {
      if ('showArrows' in opts) showArrows = opts.showArrows;
      if ('showCoordinates' in opts) showCoordinates = opts.showCoordinates;
      if ('highlightLast' in opts) highlightLast = opts.highlightLast;
      if ('lastMoveMode' in opts) lastMoveMode = opts.lastMoveMode || 'to';
      if ('interactionColor' in opts) interactionColor = opts.interactionColor || '';
      if ('allowedMoves' in opts) allowedMoves = Array.isArray(opts.allowedMoves) ? opts.allowedMoves : [];
      if ('showLegalMoves' in opts) showLegalMoves = opts.showLegalMoves !== false;
      if ('interactive' in opts) {
        interactive = opts.interactive !== false;
        if (!interactive) {
          selectedSquare = null;
          possibleMoves = [];
          dragging = false;
          dragPiece = null;
          dragFrom = null;
        }
      }
      if (currentPosition) drawBoard(currentPosition);
    },
    redraw: function() { if (currentPosition) drawBoard(currentPosition); },
    getFlipped: function() { return flipped; }
  };
})();

export default ChessBoard;
