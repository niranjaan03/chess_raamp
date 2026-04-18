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
  var boardSize = 640;
  var squareSize;
  var flipped = false;
  var selectedSquare = null;
  var possibleMoves = [];
  var lastMove = null;
  var arrows = [];
  var markers = [];
  var showArrows = true;
  var showCoordinates = true;
  var highlightLast = true;
  var lastMoveMode = 'both';
  var interactionColor = '';
  var allowedMoves = [];
  var onMoveCallback = null;
  var dragging = false;
  var dragPiece = null;
  var dragFrom = null;
  var dragX = 0, dragY = 0;
  var animating = false;
  var currentPieceStyle = 'classic';
  var contextMenuHandler = null;
  var pieceImagesLoaded = false;

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
    red:    { light: '#f8d0c0', dark: '#c0503a', highlight: 'rgba(255,255,100,0.5)', lastmove: 'rgba(210,150,100,0.4)', selected: 'rgba(50,200,50,0.5)', possible: 'rgba(0,0,0,0.15)' }
  };
  var currentTheme = THEMES.blue;

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

    canvas = document.getElementById(canvasId);
    overlay = document.getElementById(overlayId);
    if (!canvas || !overlay) return;
    ctx = canvas.getContext('2d');
    onMoveCallback = onMove;
    boundCanvas = canvas;
    preloadPieceImages();
    
    // Set up responsive canvas
    resize();
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, {passive:false});
    canvas.addEventListener('touchmove', onTouchMove, {passive:false});
    canvas.addEventListener('touchend', onTouchEnd, {passive:false});
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
    var maxSize = Math.min(container.offsetWidth || 640, 640);
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

  var currentPosition = null;
  var currentChess = null;

  function setPosition(chess) {
    currentChess = chess;
    currentPosition = fenToBoard(chess.fen());
    drawBoard(currentPosition);
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
        
        // Selected square
        if (selectedSquare === sq) {
          ctx.fillStyle = currentTheme.selected;
          ctx.fillRect(x, y, squareSize, squareSize);
        }
        
        // Possible moves
        if (possibleMoves.indexOf(sq) !== -1) {
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
    var key = piece.color + piece.type.toUpperCase();
    var img = pieceImageCache[key];
    if (!img || !img.complete || !img.naturalWidth) return false;

    var perTypeScale = style.typeScale && style.typeScale[piece.type] ? style.typeScale[piece.type] : 1;
    var baseDrawSize = squareSize * (style.pieceScale || 1) * perTypeScale * PIECE_SIZE_MULTIPLIER;
    var drawSize = Math.min(baseDrawSize, squareSize * 2.1);
    var offsetX = (squareSize - drawSize) / 2;
    var offsetY = (squareSize - drawSize) / 2 + ((style.yOffset || 0) * squareSize);

    ctx.save();
    ctx.shadowColor = style.shadowColor || 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = style.shadowBlur || 0;
    ctx.shadowOffsetX = style.shadowX || 0;
    ctx.shadowOffsetY = style.shadowY || 0;
    ctx.drawImage(img, x + offsetX, y + offsetY, drawSize, drawSize);
    ctx.restore();
    return true;
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

    var svgArrows = activeArrows.map(function(arrow, i) {
      var from = squareToXY(arrow.from);
      var to = squareToXY(arrow.to);
      if (!from || !to) return '';
      
      var fromX = from.x + squareSize/2;
      var fromY = from.y + squareSize/2;
      var toX = to.x + squareSize/2;
      var toY = to.y + squareSize/2;
      
      // Shorten arrow to not cover piece
      var dx = toX - fromX, dy = toY - fromY;
      var len = Math.sqrt(dx*dx + dy*dy);
      var nx = dx/len, ny = dy/len;
      var endX = toX - nx * squareSize * 0.3;
      var endY = toY - ny * squareSize * 0.3;
      
      var color = arrow.color || 'rgba(200,80,80,0.75)';
      var width = squareSize * 0.15;
      
      return `<line x1="${fromX}" y1="${fromY}" x2="${endX}" y2="${endY}" 
              stroke="${color}" stroke-width="${width}" stroke-linecap="round"
              marker-end="url(#ah${i})"/>`;
    });
    
    var defs = activeArrows.map(function(arrow, i) {
      var color = arrow.color || 'rgba(200,80,80,0.75)';
      return `<marker id="ah${i}" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
        <path d="M 0 0 L 4 2 L 0 4 Z" fill="${color}"/>
      </marker>`;
    }).join('');

    return `<svg class="arrow-svg" viewBox="0 0 ${boardSize} ${boardSize}">
      <defs>${defs}</defs>
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

  function renderOverlay() {
    if (!overlay) return;
    var html = buildArrowSvg() + buildMarkerHtml();
    overlay.innerHTML = html;
  }

  function clearArrows() {
    arrows = [];
    renderOverlay();
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

  // Mouse event handling
  var mouseDownSquare = null;
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
    
    mouseDownSquare = sq;
  }

  function onMouseMove(e) {
    if (!dragging) return;
    var pos = getMousePos(e);
    dragX = pos.x;
    dragY = pos.y;
    drawBoard(currentPosition);
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
    
    if (toSq && dragFrom && toSq !== dragFrom) {
      attemptMove(dragFrom, toSq);
    } else {
      drawBoard(currentPosition);
    }
    
    dragFrom = null;
    dragPiece = null;
  }

  function handleSquareClick(sq) {
    if (!sq || !currentChess) return;
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
    if (!currentChess) return;
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
    
    // Check for promotion
    var piece = currentChess.get(from);
    var promo = null;
    if (piece && piece.type === 'p') {
      var toRank = parseInt(to[1]);
      if ((piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1)) {
        promo = 'q'; // Auto-queen for simplicity
      }
    }
    
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
    setTheme: function(name) { currentTheme = THEMES[name] || THEMES.green; if (currentPosition) drawBoard(currentPosition); },
    setPieceStyle: function(name) { currentPieceStyle = PIECE_STYLES[name] ? name : 'classic'; if (currentPosition) drawBoard(currentPosition); },
    flip: function() { flipped = !flipped; if (currentPosition) drawBoard(currentPosition); },
    setFlipped: function(f) { flipped = f; if (currentPosition) drawBoard(currentPosition); },
    setArrows: setArrows,
    clearArrows: clearArrows,
    setMarkers: setMarkers,
    clearMarkers: clearMarkers,
    setLastMove: function(from, to) { lastMove = from ? {from:from, to:to} : null; if (currentPosition) drawBoard(currentPosition); },
    setOptions: function(opts) {
      if ('showArrows' in opts) showArrows = opts.showArrows;
      if ('showCoordinates' in opts) showCoordinates = opts.showCoordinates;
      if ('highlightLast' in opts) highlightLast = opts.highlightLast;
      if ('lastMoveMode' in opts) lastMoveMode = opts.lastMoveMode || 'both';
      if ('interactionColor' in opts) interactionColor = opts.interactionColor || '';
      if ('allowedMoves' in opts) allowedMoves = Array.isArray(opts.allowedMoves) ? opts.allowedMoves : [];
      if (currentPosition) drawBoard(currentPosition);
    },
    redraw: function() { if (currentPosition) drawBoard(currentPosition); },
    getFlipped: function() { return flipped; }
  };
})();

export default ChessBoard;
