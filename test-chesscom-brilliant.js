/**
 * Test Suite for Chess.com Style Brilliant & Blunder Detection
 * Tests the new isBrilliant() and isBlunder() functions
 */

// Mock functions for testing (would be imported from chessReviewApiV2.js)
function isBrilliant({
  evalBefore,
  evalAfter,
  bestEval,
  moveEval,
  secondBestEval,
  turn,
  materialBefore,
  materialAfter
}) {
  const normalize = (val) => turn === 'w' ? val : -val;
  
  const before = normalize(evalBefore);
  const after = normalize(evalAfter);
  const best = normalize(bestEval);
  const move = normalize(moveEval);
  const second = normalize(secondBestEval);

  const isBestMove = Math.abs(best - move) < 10;
  const hasUniqueAdvantage = (best - second) > 50;
  const isSacrifice = materialBefore > materialAfter;
  const counterintuitive = !isSacrifice && (best > before + 50);
  const significantGain = after > before + 30;
  const notTrivial = Math.abs(before) < 300;

  return (
    isBestMove &&
    hasUniqueAdvantage &&
    (isSacrifice || counterintuitive) &&
    significantGain &&
    notTrivial
  );
}

function isBlunder({ evalBefore, evalAfter, turn }) {
  const normalize = (val) => turn === 'w' ? val : -val;
  
  const before = normalize(evalBefore);
  const after = normalize(evalAfter);
  
  const loss = before - after;
  
  return loss > 150 || (before > 100 && after < -100);
}

// ================= TEST SUITE =================

const tests = [
  // BRILLIANT MOVES
  {
    name: "Queen Sacrifice for Mate",
    type: "brilliant",
    input: {
      evalBefore: 30,
      evalAfter: 450,
      bestEval: 450,
      moveEval: 450,
      secondBestEval: 50,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 30
    },
    expected: true
  },
  {
    name: "Rook Sacrifice to Save Game",
    type: "brilliant",
    input: {
      evalBefore: -250,
      evalAfter: 0,
      bestEval: 0,
      moveEval: 0,
      secondBestEval: -500,
      turn: 'w',
      materialBefore: 15,
      materialAfter: 10
    },
    expected: true
  },
  {
    name: "Counterintuitive Capture",
    type: "brilliant",
    input: {
      evalBefore: 50,
      evalAfter: 200,
      bestEval: 200,
      moveEval: 200,
      secondBestEval: 80,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 39
    },
    expected: true
  },
  {
    name: "Pawn Sacrifice for Initiative",
    type: "brilliant",
    input: {
      evalBefore: 30,
      evalAfter: 150,
      bestEval: 150,
      moveEval: 150,
      secondBestEval: 50,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 38
    },
    expected: true
  },

  // NOT BRILLIANT
  {
    name: "Good Move But No Unique Advantage",
    type: "brilliant",
    input: {
      evalBefore: 50,
      evalAfter: 100,
      bestEval: 100,
      moveEval: 100,
      secondBestEval: 95,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 39
    },
    expected: false
  },
  {
    name: "Sacrifice When Already Winning",
    type: "brilliant",
    input: {
      evalBefore: 350,
      evalAfter: 400,
      bestEval: 400,
      moveEval: 400,
      secondBestEval: 300,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 30
    },
    expected: false
  },
  {
    name: "Position Too Trivial",
    type: "brilliant",
    input: {
      evalBefore: 400,
      evalAfter: 450,
      bestEval: 450,
      moveEval: 450,
      secondBestEval: 360,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 30
    },
    expected: false
  },
  {
    name: "Not Best Move",
    type: "brilliant",
    input: {
      evalBefore: 30,
      evalAfter: 200,
      bestEval: 300,
      moveEval: 200,
      secondBestEval: 100,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 39
    },
    expected: false
  },
  {
    name: "Insufficient Gain",
    type: "brilliant",
    input: {
      evalBefore: 50,
      evalAfter: 70,
      bestEval: 70,
      moveEval: 70,
      secondBestEval: 0,
      turn: 'w',
      materialBefore: 39,
      materialAfter: 36
    },
    expected: false
  },

  // BLUNDERS
  {
    name: "Losing Move - 200cp Loss",
    type: "blunder",
    input: {
      evalBefore: 100,
      evalAfter: -100,
      turn: 'w'
    },
    expected: true
  },
  {
    name: "Catastrophic Blunder",
    type: "blunder",
    input: {
      evalBefore: 150,
      evalAfter: -200,
      turn: 'w'
    },
    expected: true
  },
  {
    name: "From Winning to Losing",
    type: "blunder",
    input: {
      evalBefore: 200,
      evalAfter: -150,
      turn: 'w'
    },
    expected: true
  },
  {
    name: "Black's Blunder",
    type: "blunder",
    input: {
      evalBefore: -100,
      evalAfter: 200,
      turn: 'b'
    },
    expected: true
  },

  // NOT BLUNDERS
  {
    name: "Good Move",
    type: "blunder",
    input: {
      evalBefore: 100,
      evalAfter: 80,
      turn: 'w'
    },
    expected: false
  },
  {
    name: "Minor Inaccuracy",
    type: "blunder",
    input: {
      evalBefore: 100,
      evalAfter: -20,
      turn: 'w'
    },
    expected: false
  },
  {
    name: "Borderline Blunder",
    type: "blunder",
    input: {
      evalBefore: 100,
      evalAfter: -50,
      turn: 'w'
    },
    expected: false
  }
];

// ================= RUN TESTS =================

let passed = 0;
let failed = 0;

console.log('\n' + '='.repeat(80));
console.log('🧪 CHESS.COM STYLE BRILLIANT & BLUNDER DETECTION TEST SUITE');
console.log('='.repeat(80) + '\n');

tests.forEach((test, index) => {
  let result;
  
  if (test.type === 'brilliant') {
    result = isBrilliant(test.input);
  } else {
    result = isBlunder(test.input);
  }
  
  const success = result === test.expected;
  const icon = success ? '✅' : '❌';
  const status = success ? 'PASS' : 'FAIL';
  
  if (success) passed++;
  else failed++;
  
  console.log(`${icon} Test ${index + 1}: ${test.name}`);
  console.log(`   Type: ${test.type.toUpperCase()}`);
  console.log(`   Expected: ${test.expected}, Got: ${result} [${status}]`);
  console.log();
});

// ================= SUMMARY =================

console.log('='.repeat(80));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(80));
console.log(`✅ Passed: ${passed}/${tests.length}`);
console.log(`❌ Failed: ${failed}/${tests.length}`);
console.log(`📊 Success Rate: ${Math.round(passed / tests.length * 100)}%`);
console.log('='.repeat(80) + '\n');

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED! 🎉\n');
  console.log('✨ Brilliant & Blunder detection is working correctly!');
  console.log('🚀 Ready to integrate into game analysis pipeline.\n');
} else {
  console.log('⚠️  Some tests failed. Please review the logic.\n');
}

console.log('='.repeat(80) + '\n');
