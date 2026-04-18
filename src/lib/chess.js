/*
 * Chess.js - Chess Logic Engine (MIT License)
 * Adapted for KnightVision Chess Analyzer
 */

const Chess = (function() {
  var BLACK = 'b', WHITE = 'w';
  var EMPTY = -1;
  var PAWN='p',KNIGHT='n',BISHOP='b',ROOK='r',QUEEN='q',KING='k';
  var SYMBOLS = 'pnbrqkPNBRQK';
  var DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var POSSIBLE_RESULTS = ['1-0','0-1','1/2-1/2','*'];
  var PAWN_OFFSETS = {b:[16,32,17,15],w:[-16,-32,-17,-15]};
  var PIECE_OFFSETS = {n:[-18,-33,-31,-14,18,33,31,14],b:[-17,-15,17,15],r:[-16,1,16,-1],q:[-17,-16,-15,1,17,16,15,-1],k:[-17,-16,-15,1,17,16,15,-1]};
  var ATTACKS = [20,0,0,0,0,0,0,24,0,0,0,0,0,0,20,0,0,20,0,0,0,0,0,24,0,0,0,0,0,20,0,0,0,0,20,0,0,0,0,24,0,0,0,0,20,0,0,0,0,0,0,20,0,0,0,24,0,0,0,20,0,0,0,0,0,0,0,0,20,0,0,24,0,0,20,0,0,0,0,0,0,0,0,0,0,20,0,24,0,20,0,0,0,0,0,0,0,0,0,0,0,0,20,24,20,0,0,0,0,0,0,0,0,0,0,0,0,0,24,0,0,0,0,0,0,0,0,20,24,20,0,0,0,0,0,0,0,0,0,0,0,0,20,24,20,0,0,0,0,0,0,0,0,0,0,0,20,0,24,0,20,0,0,0,0,0,0,0,0,0,0,20,0,0,24,0,0,20,0,0,0,0,0,0,0,0,20,0,0,0,24,0,0,0,20,0,0,0,0,0,0,0,20,0,0,0,0,24,0,0,0,0,20,0,0,0,0,0,20,0,0,0,0,0,24,0,0,0,0,0,0,20];
  var RAYS = [17,0,0,0,0,0,0,16,0,0,0,0,0,0,15,0,0,17,0,0,0,0,0,16,0,0,0,0,0,15,0,0,0,0,17,0,0,0,0,16,0,0,0,0,15,0,0,0,0,0,0,17,0,0,0,16,0,0,0,15,0,0,0,0,0,0,0,0,17,0,0,16,0,0,15,0,0,0,0,0,0,0,0,0,0,17,0,16,0,15,0,0,0,0,0,0,0,0,0,0,0,0,17,16,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-15,-16,-17,0,0,0,0,0,0,0,0,0,0,0,0,-15,0,-16,0,-17,0,0,0,0,0,0,0,0,0,0,-15,0,0,-16,0,0,-17,0,0,0,0,0,0,0,-15,0,0,0,-16,0,0,0,-17,0,0,0,0,-15,0,0,0,0,-16,0,0,0,0,-17,0,0,-15,0,0,0,0,0,-16,0,0,0,0,0,-17];
  var SHIFTS = {p:0,n:1,b:2,r:3,q:4,k:5};
  var FLAGS = {NORMAL:'n',CAPTURE:'c',BIG_PAWN:'b',EP_CAPTURE:'e',PROMOTION:'p',KSIDE_CASTLE:'k',QSIDE_CASTLE:'q'};
  var BITS = {NORMAL:1,CAPTURE:2,BIG_PAWN:4,EP_CAPTURE:8,PROMOTION:16,KSIDE_CASTLE:32,QSIDE_CASTLE:64};
  var RANK_1=7,RANK_2=6,RANK_3=5,RANK_4=4,RANK_5=3,RANK_6=2,RANK_7=1,RANK_8=0;
  var SQUARES = {a8:0,b8:1,c8:2,d8:3,e8:4,f8:5,g8:6,h8:7,a7:16,b7:17,c7:18,d7:19,e7:20,f7:21,g7:22,h7:23,a6:32,b6:33,c6:34,d6:35,e6:36,f6:37,g6:38,h6:39,a5:48,b5:49,c5:50,d5:51,e5:52,f5:53,g5:54,h5:55,a4:64,b4:65,c4:66,d4:67,e4:68,f4:69,g4:70,h4:71,a3:80,b3:81,c3:82,d3:83,e3:84,f3:85,g3:86,h3:87,a2:96,b2:97,c2:98,d2:99,e2:100,f2:101,g2:102,h2:103,a1:112,b1:113,c1:114,d1:115,e1:116,f1:117,g1:118,h1:119};
  var ROOKS = {w:[{square:SQUARES.a1,flag:BITS.QSIDE_CASTLE},{square:SQUARES.h1,flag:BITS.KSIDE_CASTLE}],b:[{square:SQUARES.a8,flag:BITS.QSIDE_CASTLE},{square:SQUARES.h8,flag:BITS.KSIDE_CASTLE}]};
  var board=[], kings={w:EMPTY,b:EMPTY}, turn=WHITE, castling={w:0,b:0}, ep_square=EMPTY, half_moves=0, move_number=1, history=[], header={};

  function rank(i){return i>>4;}
  function file(i){return i&15;}
  function algebraic(i){var f=file(i),r=rank(i);return 'abcdefgh'.substring(f,f+1)+'87654321'.substring(r,r+1);}
  function swap_color(c){return c===WHITE?BLACK:WHITE;}
  function is_digit(c){return '0123456789'.indexOf(c)!==-1;}
  function mask_rank(r){return 0xff<<((7-r)*16);}
  function mask_file(f){var m=0;for(var r=RANK_8;r<=RANK_1;r++){m|=1<<(r*16+f);}return m;}

  function clone(obj){
    var newObj={};
    for(var key in obj){if(obj.hasOwnProperty(key)){newObj[key]=obj[key];}}
    return newObj;
  }

  function init(){
    board=new Array(128);
    kings={w:EMPTY,b:EMPTY};
    turn=WHITE;
    castling={w:0,b:0};
    ep_square=EMPTY;
    half_moves=0;
    move_number=1;
    history=[];
    header={};
    load(DEFAULT_POSITION);
  }

  function load(fen){
    var tokens=fen.split(/\s+/),position=tokens[0],square=0;
    clear();
    for(var i=0;i<position.length;i++){
      var piece=position.charAt(i);
      if(piece==='/'){square+=8;}
      else if(is_digit(piece)){square+=parseInt(piece,10);}
      else{
        var color=piece<'a'?WHITE:BLACK;
        put({type:piece.toLowerCase(),color:color},algebraic(square));
        square++;
      }
    }
    turn=tokens[1];
    if(tokens[2].indexOf('K')>-1){castling.w|=BITS.KSIDE_CASTLE;}
    if(tokens[2].indexOf('Q')>-1){castling.w|=BITS.QSIDE_CASTLE;}
    if(tokens[2].indexOf('k')>-1){castling.b|=BITS.KSIDE_CASTLE;}
    if(tokens[2].indexOf('q')>-1){castling.b|=BITS.QSIDE_CASTLE;}
    ep_square=tokens[3]==='_'||tokens[3]==='-'?EMPTY:SQUARES[tokens[3]];
    half_moves=parseInt(tokens[4],10);
    move_number=parseInt(tokens[5],10);
    return true;
  }

  function clear(){
    board=new Array(128);
    kings={w:EMPTY,b:EMPTY};
    turn=WHITE;
    castling={w:0,b:0};
    ep_square=EMPTY;
    half_moves=0;
    move_number=1;
    history=[];
    header={};
  }

  function generate_fen(){
    var empty=0,fen='';
    for(var i=SQUARES.a8;i<=SQUARES.h1;i++){
      if(board[i]==null){empty++;}
      else{
        if(empty>0){fen+=empty;empty=0;}
        var color=board[i].color,piece=board[i].type;
        fen+=color===WHITE?piece.toUpperCase():piece.toLowerCase();
      }
      if((i+1)&0x88){
        if(empty>0){fen+=empty;}
        if(i!==SQUARES.h1){fen+='/';}
        empty=0;i+=8;
      }
    }
    var cflags='';
    if(castling[WHITE]&BITS.KSIDE_CASTLE){cflags+='K';}
    if(castling[WHITE]&BITS.QSIDE_CASTLE){cflags+='Q';}
    if(castling[BLACK]&BITS.KSIDE_CASTLE){cflags+='k';}
    if(castling[BLACK]&BITS.QSIDE_CASTLE){cflags+='q';}
    cflags=cflags||'-';
    var epflags=ep_square===EMPTY?'-':algebraic(ep_square);
    return [fen,turn,cflags,epflags,half_moves,move_number].join(' ');
  }

  function get(square){return board[SQUARES[square]]?clone(board[SQUARES[square]]):null;}

  function put(piece,square){
    if(!piece||!square)return false;
    if(SYMBOLS.indexOf(piece.type)===-1)return false;
    if(!(square in SQUARES))return false;
    var sq=SQUARES[square];
    board[sq]={type:piece.type,color:piece.color};
    if(piece.type===KING){kings[piece.color]=sq;}
    return true;
  }

  function remove(square){
    var piece=get(square);
    board[SQUARES[square]]=null;
    if(piece&&piece.type===KING){kings[piece.color]=EMPTY;}
    return piece;
  }

  function attacked(color,square){
    for(var i=SQUARES.a8;i<=SQUARES.h1;i++){
      if(i&0x88){i+=7;continue;}
      if(board[i]==null||board[i].color!==color)continue;
      var piece=board[i],diff=i-square,index=diff+119;
      if(ATTACKS[index]&(1<<SHIFTS[piece.type])){
        if(piece.type===PAWN){
          if(diff>0){if(piece.color===WHITE)return true;}
          else{if(piece.color===BLACK)return true;}
          continue;
        }
        if(piece.type==='n'||piece.type==='k')return true;
        var offset=RAYS[index],j=i+offset;
        var blocked=false;
        while(j!==square){if(board[j]!=null){blocked=true;break;}j+=offset;}
        if(!blocked)return true;
      }
    }
    return false;
  }

  function king_attacked(color){return attacked(swap_color(color),kings[color]);}
  function in_check(){return king_attacked(turn);}

  function generate_moves(options){
    function add_move(b,ms,from,to,flags){
      if((flags&BITS.PROMOTION)&&b[from]&&b[from].type===PAWN&&(rank(to)===RANK_8||rank(to)===RANK_1)){
        var pieces=[QUEEN,ROOK,BISHOP,KNIGHT];
        for(var i=0;i<pieces.length;i++){ms.push(build_move(b,from,to,flags,pieces[i]));}
      } else {ms.push(build_move(b,from,to,flags));}
    }
    var moves=[],us=turn,them=swap_color(us),second_rank={b:RANK_7,w:RANK_2};
    var first_sq=SQUARES.a8,last_sq=SQUARES.h1,single_square=false;
    if(options&&'square' in options){
      if(options.square in SQUARES){first_sq=last_sq=SQUARES[options.square];single_square=true;}
      else{return [];}
    }
    for(var i=first_sq;i<=last_sq;i++){
      if(i&0x88){i+=7;continue;}
      var piece=board[i];
      if(piece==null||piece.color!==us)continue;
      if(piece.type===PAWN){
        var sq=i+PAWN_OFFSETS[us][0];
        if(board[sq]==null){
          add_move(board,moves,i,sq,BITS.NORMAL);
          sq=i+PAWN_OFFSETS[us][1];
          if(second_rank[us]===rank(i)&&board[sq]==null){add_move(board,moves,i,sq,BITS.BIG_PAWN);}
        }
        for(var j=2;j<4;j++){
          sq=i+PAWN_OFFSETS[us][j];
          if(sq&0x88)continue;
          if(board[sq]!=null&&board[sq].color===them){add_move(board,moves,i,sq,BITS.CAPTURE);}
          else if(sq===ep_square){add_move(board,moves,i,sq,BITS.EP_CAPTURE);}
        }
      } else {
        var offsets=PIECE_OFFSETS[piece.type];
        for(var k=0;k<offsets.length;k++){
          var offset=offsets[k];sq=i;
          while(true){
            sq+=offset;
            if(sq&0x88)break;
            if(board[sq]==null){add_move(board,moves,i,sq,BITS.NORMAL);}
            else{
              if(board[sq].color===us)break;
              add_move(board,moves,i,sq,BITS.CAPTURE);break;
            }
            if(piece.type==='n'||piece.type==='k')break;
          }
        }
      }
    }
    if((!single_square)||(last_sq===kings[us])){
      if(castling[us]&BITS.KSIDE_CASTLE){
        var castling_from=kings[us],castling_to=castling_from+2;
        if(board[castling_from+1]==null&&board[castling_to]==null&&!attacked(them,kings[us])&&!attacked(them,castling_from+1)&&!attacked(them,castling_to)){
          add_move(board,moves,kings[us],castling_to,BITS.KSIDE_CASTLE);
        }
      }
      if(castling[us]&BITS.QSIDE_CASTLE){
        var castling_from2=kings[us],castling_to2=castling_from2-2;
        if(board[castling_from2-1]==null&&board[castling_to2]==null&&board[castling_from2-3]==null&&!attacked(them,kings[us])&&!attacked(them,castling_from2-1)&&!attacked(them,castling_to2)){
          add_move(board,moves,kings[us],castling_to2,BITS.QSIDE_CASTLE);
        }
      }
    }
    var legal=[],move;
    for(var m=0;m<moves.length;m++){
      make_move(moves[m]);
      if(!king_attacked(us)){legal.push(moves[m]);}
      undo_move();
    }
    return legal;
  }

  function build_move(b,from,to,flags,promotion){
    var m={color:turn,from:from,to:to,flags:flags,piece:b[from].type};
    if(promotion){m.flags|=BITS.PROMOTION;m.promotion=promotion;}
    if(b[to]){m.captured=b[to].type;}
    else if(flags&BITS.EP_CAPTURE){m.captured=PAWN;}
    return m;
  }

  function make_move(move){
    var us=turn,them=swap_color(us),hist={move:clone(move),kings:clone(kings),turn:turn,castling:{w:castling.w,b:castling.b},ep_square:ep_square,half_moves:half_moves,move_number:move_number};
    history.push(hist);
    kings[us]=move.flags&BITS.KSIDE_CASTLE||move.flags&BITS.QSIDE_CASTLE?move.to:kings[us];
    if(move.flags&BITS.EP_CAPTURE){board[move.to+(us===BLACK?16:-16)]=null;}
    if(move.flags&(BITS.KSIDE_CASTLE|BITS.QSIDE_CASTLE)){
      var castling_to,castling_from;
      if(move.flags&BITS.KSIDE_CASTLE){castling_to=move.to-1;castling_from=move.to+1;}
      else{castling_to=move.to+1;castling_from=move.to-2;}
      board[castling_to]=board[castling_from];
      board[castling_from]=null;
    }
    if(board[move.from]){kings[us]=board[move.from].type===KING?move.to:kings[us];}
    board[move.to]=board[move.from];
    board[move.from]=null;
    if(move.flags&BITS.PROMOTION){board[move.to]={type:move.promotion,color:us};}
    if(board[move.to]&&board[move.to].type===PAWN){
      if(move.flags&BITS.BIG_PAWN){ep_square=(move.to+(us===BLACK?-16:16));}
      else{ep_square=EMPTY;}
    } else {ep_square=EMPTY;}
    if(move.flags&BITS.CAPTURE||board[move.to]&&board[move.to].type===PAWN){half_moves=0;}
    else{half_moves++;}
    if(us===BLACK){move_number++;}
    turn=them;
  }

  function undo_move(){
    var old=history.pop();
    if(!old)return null;
    var move=old.move;
    kings=old.kings;turn=old.turn;castling=old.castling;ep_square=old.ep_square;half_moves=old.half_moves;move_number=old.move_number;
    var us=turn,them=swap_color(us);
    board[move.from]=board[move.to];
    board[move.from].type=move.piece;
    board[move.to]=null;
    if(move.flags&BITS.CAPTURE){board[move.to]={type:move.captured,color:them};}
    else if(move.flags&BITS.EP_CAPTURE){var index=move.to+(us===BLACK?16:-16);board[index]={type:PAWN,color:them};}
    if(move.flags&(BITS.KSIDE_CASTLE|BITS.QSIDE_CASTLE)){
      var castling_to,castling_from;
      if(move.flags&BITS.KSIDE_CASTLE){castling_to=move.to+1;castling_from=move.to-1;}
      else{castling_to=move.to-2;castling_from=move.to+1;}
      board[castling_to]=board[castling_from];
      board[castling_from]=null;
    }
    return move;
  }

  function san_to_move(san,moves){
    function disambiguation(m){
      var s='',a=generate_moves();
      for(var i=0;i<a.length;i++){if(a[i].from!==m.from&&a[i].to===m.to&&a[i].piece===m.piece){var amb=a[i];if(file(amb.from)!==file(m.from)){s+=algebraic(m.from).charAt(0);}else if(rank(amb.from)!==rank(m.from)){s+=algebraic(m.from).charAt(1);}else{s+=algebraic(m.from);}break;}}
      return s;
    }
    function strip(s){return s.replace(/=/,'').replace(/[+#?!]*/g,'').trim();}
    var clean=strip(san);
    var overmoves=moves||generate_moves();
    for(var i=0;i<overmoves.length;i++){
      if(clean===strip(move_to_san(overmoves[i],false))){return overmoves[i];}
    }
    return null;
  }

  function move_to_san(move,sloppy){
    var output='';
    if(move.flags&BITS.KSIDE_CASTLE){output='O-O';}
    else if(move.flags&BITS.QSIDE_CASTLE){output='O-O-O';}
    else{
      var disambiguator=get_disambiguator(move,sloppy);
      if(move.piece!==PAWN){output+=move.piece.toUpperCase()+disambiguator;}
      if(move.flags&(BITS.CAPTURE|BITS.EP_CAPTURE)){
        if(move.piece===PAWN){output+=algebraic(move.from).charAt(0);}
        output+='x';
      }
      output+=algebraic(move.to);
      if(move.flags&BITS.PROMOTION){output+='='+move.promotion.toUpperCase();}
    }
    make_move(move);
    if(in_check()){
      if(generate_moves().length===0){output+='#';}
      else{output+='+';}
    }
    undo_move();
    return output;
  }

  function get_disambiguator(move,sloppy){
    var moves=generate_moves(),same_rank=false,same_file_d=false,ambiguities=0;
    if(sloppy)return '';
    for(var i=0;i<moves.length;i++){
      var ambig=moves[i];
      if(move.piece===ambig.piece&&move.from!==ambig.from&&move.to===ambig.to){
        ambiguities++;
        if(rank(move.from)===rank(ambig.from))same_rank=true;
        if(file(move.from)===file(ambig.from))same_file_d=true;
      }
    }
    if(ambiguities>0){
      if(same_rank&&same_file_d){return algebraic(move.from);}
      else if(same_file_d){return algebraic(move.from).charAt(1);}
      else{return algebraic(move.from).charAt(0);}
    }
    return '';
  }

  function ascii(){
    var s=' +------------------------+\n',i;
    for(i=SQUARES.a8;i<=SQUARES.h1;i++){
      if(file(i)===0){s+=' '+(8-rank(i))+'|';}
      if(board[i]==null){s+=' . ';}
      else{var p=board[i];s+=' '+(p.color===WHITE?p.type.toUpperCase():p.type)+' ';}
      if((i+1)&0x88){s+='|\n';i+=8;}
    }
    s+=' +------------------------+\n   a  b  c  d  e  f  g  h\n';
    return s;
  }

  function perft(depth){
    var moves=generate_moves(),nodes=0;
    for(var i=0;i<moves.length;i++){
      make_move(moves[i]);
      if(depth-1>0){nodes+=perft(depth-1);}
      else{nodes++;}
      undo_move();
    }
    return nodes;
  }

  var chess={
    WHITE:WHITE, BLACK:BLACK,
    PAWN:PAWN, KNIGHT:KNIGHT, BISHOP:BISHOP, ROOK:ROOK, QUEEN:QUEEN, KING:KING,
    SQUARES:SQUARES, FLAGS:FLAGS,
    load:load,
    reset:function(){return init();},
    moves:function(options){
      var ugly_moves=generate_moves(options),moves=[];
      for(var i=0;i<ugly_moves.length;i++){
        if(options&&'verbose' in options&&options.verbose){moves.push(make_pretty(ugly_moves[i]));}
        else{moves.push(move_to_san(ugly_moves[i],false));}
      }
      return moves;
    },
    in_check:function(){return in_check();},
    in_checkmate:function(){return in_check()&&generate_moves().length===0;},
    in_stalemate:function(){return !in_check()&&generate_moves().length===0;},
    in_draw:function(){return half_moves>=100||(in_stalemate()||insufficient_material()||in_threefold_repetition());},
    insufficient_material:function(){return insufficient_material();},
    in_threefold_repetition:function(){return in_threefold_repetition();},
    game_over:function(){return half_moves>=100||this.in_checkmate()||this.in_stalemate()||this.insufficient_material();},
    validate_fen:function(fen){return validate_fen(fen);},
    fen:function(){return generate_fen();},
    pgn:function(options){return generate_pgn(options);},
    load_pgn:function(pgn,options){return load_pgn(pgn,options);},
    header:function(){return set_header(arguments);},
    ascii:function(){return ascii();},
    turn:function(){return turn;},
    move:function(move){
      var move_obj=null,moves=generate_moves();
      if(typeof move==='string'){move_obj=san_to_move(move,moves);}
      else if(typeof move==='object'){
        var from=algebraic(SQUARES[move.from]||move.from),to=algebraic(SQUARES[move.to]||move.to);
        for(var i=0;i<moves.length;i++){
          if(from===algebraic(moves[i].from)&&to===algebraic(moves[i].to)&&(!('promotion' in moves[i])||move.promotion===moves[i].promotion)){
            move_obj=moves[i];break;
          }
        }
      }
      if(!move_obj)return null;
      var pretty_move=make_pretty(move_obj);
      make_move(move_obj);
      return pretty_move;
    },
    undo:function(){var move=undo_move();return move?make_pretty(move):null;},
    clear:function(){return clear();},
    put:function(piece,square){return put(piece,square);},
    get:function(square){return get(square);},
    remove:function(square){return remove(square);},
    perft:function(depth){return perft(depth);},
    square_color:function(square){if(square in SQUARES){var sq=SQUARES[square];return (rank(sq)+file(sq))%2===0?'light':'dark';}return null;},
    history:function(options){
      var reversed_history=[],move_history=[],verbose=(options&&'verbose' in options&&options.verbose)?true:false;
      while(history.length>0){reversed_history.push(undo_move());}
      while(reversed_history.length>0){var move=reversed_history.pop();if(verbose){move_history.push(make_pretty(move));}else{move_history.push(move_to_san(move,false));}make_move(move);}
      return move_history;
    }
  };

  function make_pretty(ugly_move){
    var move=clone(ugly_move);
    move.san=move_to_san(move,false);
    move.to=algebraic(move.to);
    move.from=algebraic(move.from);
    var flags='';
    for(var flag in BITS){if(BITS[flag]&move.flags){flags+=FLAGS[flag];}}
    move.flags=flags;
    return move;
  }

  function insufficient_material(){
    var pieces={},num_pieces=0,sq_color=0,bishops=[];
    for(var i=SQUARES.a8;i<=SQUARES.h1;i++){
      sq_color=(sq_color+1)%2;
      if(i&0x88){i+=7;continue;}
      var piece=board[i];
      if(piece){
        pieces[piece.type]=piece.type in pieces?pieces[piece.type]+1:1;
        if(piece.type===BISHOP){bishops.push(sq_color);}
        num_pieces++;
      }
    }
    if(num_pieces===2){return true;}
    else if(num_pieces===3&&(pieces[BISHOP]===1||pieces[KNIGHT]===1)){return true;}
    else if(num_pieces===pieces[BISHOP]+2){
      var sum=0;for(var i2=0;i2<bishops.length;i2++){sum+=bishops[i2];}
      if(sum===0||sum===bishops.length){return true;}
    }
    return false;
  }

  function in_threefold_repetition(){
    var moves=[],positions={},repetition=false;
    while(true){
      var move=undo_move();
      if(!move)break;
      moves.push(move);
    }
    while(true){
      var fen=generate_fen().split(' ').slice(0,4).join(' ');
      positions[fen]=fen in positions?positions[fen]+1:1;
      if(positions[fen]>=3){repetition=true;}
      var move2=moves.pop();
      if(!move2)break;
      make_move(move2);
    }
    return repetition;
  }

  function validate_fen(fen){
    var errors={0:'No errors.',1:'FEN string must contain six space-delimited fields.',2:'6th field (move number) must be a positive integer.',3:'5th field (half move counter) must be a non-negative integer.',4:'4th field (en-passant square) is invalid.',5:'3rd field (castling availability) is invalid.',6:'2nd field (side to move) is invalid.',7:'1st field (piece positions) does not contain 8 \'/\'-delimited rows.',8:'1st field (piece positions) is invalid [consecutive numbers].',9:'1st field (piece positions) is invalid [invalid piece].',10:'1st field (piece positions) is invalid [row too large].',11:'Illegal en-passant square'};
    var tokens=fen.split(/\s+/);
    if(tokens.length!==6){return {valid:false,error_number:1,error:errors[1]};}
    if(isNaN(tokens[5])||parseInt(tokens[5],10)<=0){return {valid:false,error_number:2,error:errors[2]};}
    if(isNaN(tokens[4])||parseInt(tokens[4],10)<0){return {valid:false,error_number:3,error:errors[3]};}
    if(!/^(-|[abcdefgh][36])$/.test(tokens[3])){return {valid:false,error_number:4,error:errors[4]};}
    if(!/^(KQ?k?q?|Qk?q?|kq?|q|-)$/.test(tokens[2])){return {valid:false,error_number:5,error:errors[5]};}
    if(!/^(w|b)$/.test(tokens[1])){return {valid:false,error_number:6,error:errors[6]};}
    var rows=tokens[0].split('/');
    if(rows.length!==8){return {valid:false,error_number:7,error:errors[7]};}
    for(var i=0;i<rows.length;i++){
      var sum_fields=0,previous_was_number=false;
      for(var k=0;k<rows[i].length;k++){
        if(is_digit(rows[i][k])){if(previous_was_number){return {valid:false,error_number:8,error:errors[8]};}sum_fields+=parseInt(rows[i][k],10);previous_was_number=true;}
        else{if(!/^[prnbqkPRNBQK]$/.test(rows[i][k])){return {valid:false,error_number:9,error:errors[9]};}sum_fields+=1;previous_was_number=false;}
      }
      if(sum_fields!==8){return {valid:false,error_number:10,error:errors[10]};}
    }
    if((tokens[3][1]==='3'&&tokens[1]==='w')||(tokens[3][1]==='6'&&tokens[1]==='b')){return {valid:false,error_number:11,error:errors[11]};}
    return {valid:true,error_number:0,error:errors[0]};
  }

  function generate_pgn(options){
    var newline=(options&&typeof options.newline_char!=='undefined')?options.newline_char:'\n',max_width=(options&&typeof options.max_width!=='undefined')?options.max_width:0,result=[],header_exists=false;
    for(var i in header){result.push('['+i+' "'+header[i]+'"'+newline);header_exists=true;}
    if(header_exists&&history.length){result.push(newline);}
    var moves=[],moves_string='',move_number2=1,append_header=true;
    var reversed_history2=[];
    while(history.length>0){reversed_history2.push(undo_move());}
    var current_width=0;
    while(reversed_history2.length>0){
      if(append_header){if(turn===WHITE){moves_string+=move_number2+'.';}else{moves_string+=move_number2+'...';}append_header=false;move_number2++;}
      var move2=reversed_history2.pop();
      moves.push(move_to_san(move2,false));
      make_move(move2);
      append_header=turn===WHITE;
    }
    for(var j=0;j<moves.length;j++){
      var line=j===0?'':moves_string+' ';
      moves_string=line+moves[j];
    }
    if(moves.length){result.push(moves_string);}
    return result.join('');
  }

  function load_pgn(pgn,options){
    function mask(str){return str.replace(/\\/g,'\\');}
    function has_keys(object){for(var key in object){if(object.hasOwnProperty(key)){return true;}}return false;}
    function parse_pgn_header(header_string,options){
      var newline_char=(options&&typeof options.newline_char!=='undefined')?options.newline_char:'\r?\n',header_obj={},headers=header_string.split(new RegExp(mask(newline_char))),i,key,value;
      for(i=0;i<headers.length;i++){key=headers[i].replace(/^\[([A-Z][A-Za-z]*)\s.*\]$/,'$1');value=headers[i].replace(/^\[[A-Za-z]+\s"(.*)"\]$/,'$1');if(key.trim().length>0){header_obj[key]=value;}}
      return header_obj;
    }
    var newline_char=(options&&typeof options.newline_char!=='undefined')?options.newline_char:'\r?\n',regex=new RegExp('^(\\[(.|'+mask(newline_char)+')*\\])'+('('+mask(newline_char)+'){2}')+'(([PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[PNBRQK])?|[PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[pnbrqk])?|O-O(-O)?)[+#]?(\\s*[\\!\\?][\\!\\?]?)?|1-0|0-1|1\\/2-1\\/2|\\*)');
    var header_string=pgn.match(/^\s*((\[.*\]\s*)+)/)?pgn.match(/^\s*((\[.*\]\s*)+)/)[1]:pgn;
    var moves_string=pgn.replace(header_string,'');
    var parsed_header=parse_pgn_header(header_string,options);
    if(has_keys(parsed_header)){set_header(parsed_header);}
    moves_string=moves_string.replace(/(\{[^}]+\})+?/g,'');
    moves_string=moves_string.replace(/\$\d+/g,'');
    moves_string=moves_string.trim();
    if(POSSIBLE_RESULTS.indexOf(moves_string.slice(-3))!==-1){moves_string=moves_string.slice(0,-3);}
    else if(POSSIBLE_RESULTS.indexOf(moves_string.slice(-7))!==-1){moves_string=moves_string.slice(0,-7);}
    var tokens=moves_string.split(/\s+/).join(' ').split(' ');
    var found=true;
    for(var half_move=0;half_move<tokens.length;half_move++){
      found=true;
      var token=tokens[half_move].trim();
      if(!token.length){continue;}
      if(/^\d+\./.test(token)){continue;}
      if(POSSIBLE_RESULTS.indexOf(token)!==-1){break;}
      var move=chess.move(token);
      if(move===null){found=false;break;}
    }
    return found;
  }

  function set_header(args){
    if(typeof args[0]==='object'){for(var k in args[0]){header[k]=args[0][k];}return header;}
    for(var i=0;i<args.length;i+=2){if(typeof args[i]==='string'&&typeof args[i+1]==='string'){header[args[i]]=args[i+1];}}
    return header;
  }

  init();
  return chess;
});

export default Chess;
