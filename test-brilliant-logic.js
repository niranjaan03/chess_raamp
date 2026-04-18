#!/usr/bin/env node

// 🧪 BRILLIANT MOVE DETECTION - TEST SUITE
// This file demonstrates the enhanced brilliant move logic

// ================= BRILLIANT MOVE DETECTION FUNCTION =================

function isBrilliantMove({
  evalBefore,
  evalAfter,
  bestEval,
  secondBestEval,
  materialBefore,
  materialAfter
}) {
  // 1. Must be best (or extremely close)
  const isBestMove = Math.abs(evalAfter - bestEval) < 0.01;

  // 2. Must sacrifice material
  const materialDrop = materialBefore - materialAfter;
  const isSacrifice = materialDrop >= 1; // at least pawn

  // 3. Not already completely winning (avoid fake brilliants)
  const notTrivial = Math.abs(evalBefore) < 3.0;

  // 4. Move must still be strong (sound sacrifice)
  const stillGood = evalAfter >= evalBefore - 0.3;

  // 5. Hard to find (gap between best and second best)
  const hardToFind =
    secondBestEval !== undefined &&
    Math.abs(bestEval - secondBestEval) > 1.0;

  return (
    isBestMove &&
    isSacrifice &&
    notTrivial &&
    stillGood &&
    hardToFind
  );
}

// ================= TEST CASES =================

const testCases = [
  {
    name: "Queen Sacrifice for Mate",
    move: {
      evalBefore: 0.3,
      evalAfter: 4.5,
      bestEval: 4.5,
      secondBestEval: -0.2,
      materialBefore: 39,
      materialAfter: 30
    },
    expected: true,
    explanation: "Queen (9 pts) sacrificed for forced mate - clear brilliant"
  },

  {
    name: "Rook Sacrifice to Save Game",
    move: {
      evalBefore: -1.5,
      evalAfter: 0.2,
      bestEval: 0.2,
      secondBestEval: -2.0,
      materialBefore: 38,
      materialAfter: 33
    },
    expected: true,
    explanation: "Rook sacrifice turns losing into drawn position"
  },

  {
    name: "Pawn Sacrifice for Initiative",
    move: {
      evalBefore: 0.0,
      evalAfter: 0.8,
      bestEval: 0.8,
      secondBestEval: -0.5,
      materialBefore: 39,
      materialAfter: 38
    },
    expected: true,
    explanation: "Pawn sacrifice gains winning initiative"
  },

  {
    name: "Good Move But No Sacrifice",
    move: {
      evalBefore: 0.5,
      evalAfter: 1.0,
      bestEval: 1.0,
      secondBestEval: 0.8,
      materialBefore: 39,
      materialAfter: 39
    },
    expected: false,
    explanation: "Best move but no material lost - not brilliant"
  },

  {
    name: "Sacrifice When Already Winning",
    move: {
      evalBefore: 5.0,
      evalAfter: 4.5,
      bestEval: 4.5,
      secondBestEval: 3.8,
      materialBefore: 42,
      materialAfter: 41
    },
    expected: false,
    explanation: "Position already completely winning - not brilliant"
  },

  {
    name: "Unsound Sacrifice (Loses Too Much)",
    move: {
      evalBefore: 0.5,
      evalAfter: -1.0,
      bestEval: -1.0,
      secondBestEval: 0.3,
      materialBefore: 39,
      materialAfter: 36
    },
    expected: false,
    explanation: "Bishop sacrifice loses too much evaluation"
  },

  {
    name: "Sacrifice Not Hard to Find",
    move: {
      evalBefore: 0.5,
      evalAfter: 1.0,
      bestEval: 1.0,
      secondBestEval: 0.95,
      materialBefore: 39,
      materialAfter: 36
    },
    expected: false,
    explanation: "Sacrifice exists but second-best almost as good"
  },

  {
    name: "Position Already Completely Losing",
    move: {
      evalBefore: -5.0,
      evalAfter: -4.5,
      bestEval: -4.5,
      secondBestEval: -6.0,
      materialBefore: 39,
      materialAfter: 38
    },
    expected: false,
    explanation: "Position already completely losing - not brilliant"
  },

  {
    name: "Not Best Move",
    move: {
      evalBefore: 0.5,
      evalAfter: 0.8,
      bestEval: 1.2,
      secondBestEval: -0.5,
      materialBefore: 39,
      materialAfter: 36
    },
    expected: false,
    explanation: "Sacrifice exists but move not best (0.8 vs 1.2)"
  },

  {
    name: "Bishop Sacrifice for Perpetual Check",
    move: {
      evalBefore: 0.0,
      evalAfter: 0.5,
      bestEval: 0.5,
      secondBestEval: -1.5,
      materialBefore: 39,
      materialAfter: 36
    },
    expected: true,
    explanation: "Bishop sacrifice achieves perpetual check advantage"
  }
];

// ================= TEST RUNNER =================

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║          🧪 BRILLIANT MOVE DETECTION TEST SUITE                   ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = isBrilliantMove(testCase.move);
  const isCorrect = result === testCase.expected;

  if (isCorrect) {
    passed++;
  } else {
    failed++;
  }

  const status = isCorrect ? '✅' : '❌';
  const verdict = result ? '💎 BRILLIANT' : '⭕ NOT BRILLIANT';

  console.log(`${status} Test ${index + 1}: ${testCase.name}`);
  console.log(`   Result: ${verdict}`);
  console.log(`   Expected: ${testCase.expected ? '💎 BRILLIANT' : '⭕ NOT BRILLIANT'}`);
  console.log(`   Details: ${testCase.explanation}\n`);
});

// ================= SUMMARY =================

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║                        TEST SUMMARY                               ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

console.log(`✅ Passed: ${passed}/${testCases.length}`);
console.log(`❌ Failed: ${failed}/${testCases.length}`);
console.log(`📊 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED! Brilliant move detection is working correctly.\n');
} else {
  console.log('⚠️  Some tests failed. Review the logic above.\n');
}

// ================= DETAILED BREAKDOWN OF CRITERIA =================

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║                   CRITERIA EXPLANATION                            ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

console.log('A move is BRILLIANT when ALL 5 criteria are met:\n');

console.log('1. ✅ BEST MOVE');
console.log('   - Played move must match engine\'s best within 0.01 eval');
console.log('   - Example: bestEval=0.5, evalAfter=0.5 ✓');
console.log('   - Example: bestEval=0.5, evalAfter=0.7 ✗\n');

console.log('2. ✅ MATERIAL SACRIFICE');
console.log('   - Must sacrifice ≥1 pawn value (1 point)');
console.log('   - Pawn=1, Knight/Bishop=3, Rook=5, Queen=9');
console.log('   - Example: materialBefore=39, materialAfter=36 ✓ (3 pts)');
console.log('   - Example: materialBefore=39, materialAfter=39 ✗ (0 pts)\n');

console.log('3. ✅ NOT TRIVIAL POSITION');
console.log('   - Position must be roughly equal: |evalBefore| < 3.0');
console.log('   - Prevents "brilliant" sacrifices when already up material');
console.log('   - Example: evalBefore=+0.5 ✓ (equal)');
console.log('   - Example: evalBefore=+5.0 ✗ (already winning)\n');

console.log('4. ✅ SOUND SACRIFICE');
console.log('   - Eval drop must be ≤ 0.3 after sacrifice');
console.log('   - Ensures compensation exists for material loss');
console.log('   - Example: evalBefore=0.5, evalAfter=0.3 ✓ (lost 0.2)');
console.log('   - Example: evalBefore=0.5, evalAfter=-0.5 ✗ (lost 1.0)\n');

console.log('5. ✅ HARD TO FIND');
console.log('   - Gap between best and 2nd best must be > 1.0 eval');
console.log('   - Ensures move is uniquely hard to find');
console.log('   - Example: bestEval=0.5, 2nd=−0.6, gap=1.1 ✓');
console.log('   - Example: bestEval=0.5, 2nd=0.4, gap=0.1 ✗\n');

console.log('════════════════════════════════════════════════════════════════════\n');
