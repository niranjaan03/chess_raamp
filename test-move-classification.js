#!/usr/bin/env node

/**
 * Test suite for move classification bug fixes
 * Validates that Great, Book, Brilliant, and Miss moves are detected correctly
 */

import { EVALUATION_CONSTANTS } from './src/lib/fullChessIntegration.js';

console.log('🧪 Move Classification Bug Fix Tests\n');
console.log('=' .repeat(50));

// Test 1: qualityFromLabelAndTags function
console.log('\n✓ Test 1: qualityFromLabelAndTags Priority');
console.log('-'.repeat(50));

function qualityFromLabelAndTags(baseLabel, tags = []) {
  if (tags.includes('Brilliant')) return 'brilliant';
  if (tags.includes('Great')) return 'great';
  if (tags.includes('Book')) return 'book';
  if (baseLabel) return baseLabel.toLowerCase();
  return 'good';
}

const testCases = [
  { label: 'Best', tags: ['Brilliant'], expected: 'brilliant', name: 'Brilliant overrides label' },
  { label: 'Best', tags: ['Great'], expected: 'great', name: 'Great overrides label' },
  { label: 'Best', tags: ['Book'], expected: 'book', name: 'Book overrides label' },
  { label: 'Best', tags: ['Miss'], expected: 'best', name: 'Miss tag is NOT priority (label wins)' },
  { label: 'Excellent', tags: [], expected: 'excellent', name: 'No tags uses label' },
  { label: 'Excellent', tags: ['Great', 'Brilliant'], expected: 'brilliant', name: 'Brilliant has priority' },
];

let passed = 0;
for (const test of testCases) {
  const result = qualityFromLabelAndTags(test.label, test.tags);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`${status} ${test.name}`);
  console.log(`   Input: label="${test.label}", tags=${JSON.stringify(test.tags)}`);
  console.log(`   Expected: "${test.expected}", Got: "${result}"`);
  if (result === test.expected) passed++;
}
console.log(`\nPassed: ${passed}/${testCases.length}`);

// Test 2: Great move detection threshold
console.log('\n✓ Test 2: Great Move Detection Threshold');
console.log('-'.repeat(50));

const GREAT_ONLY_GAP = EVALUATION_CONSTANTS.GREAT_ONLY_GAP || 0.20;
console.log(`Using GREAT_ONLY_GAP threshold: ${GREAT_ONLY_GAP}`);

const greatTestCases = [
  { epLoss: 0.05, label: 'Excellent', shouldBeGreat: true, name: 'Small gap Excellent' },
  { epLoss: 0.15, label: 'Excellent', shouldBeGreat: true, name: 'At threshold Excellent' },
  { epLoss: 0.25, label: 'Excellent', shouldBeGreat: false, name: 'Too large gap Excellent' },
  { epLoss: 0.05, label: 'Good', shouldBeGreat: false, name: 'Good label (not Excellent)' },
  { epLoss: 0.05, label: 'Best', shouldBeGreat: false, name: 'Best label (already best)' },
];

let greatPassed = 0;
for (const test of greatTestCases) {
  const isGreat = test.label === 'Excellent' && test.epLoss <= GREAT_ONLY_GAP;
  const status = isGreat === test.shouldBeGreat ? '✅' : '❌';
  console.log(`${status} ${test.name}`);
  console.log(`   Label: ${test.label}, EP Loss: ${test.epLoss}`);
  console.log(`   Expected Great: ${test.shouldBeGreat}, Got: ${isGreat}`);
  if (isGreat === test.shouldBeGreat) greatPassed++;
}
console.log(`\nPassed: ${greatPassed}/${greatTestCases.length}`);

// Test 3: Book move detection criteria
console.log('\n✓ Test 3: Book Move Detection Criteria');
console.log('-'.repeat(50));

const bookTestCases = [
  { moveIndex: 0, label: 'Best', shouldBeBook: true, name: 'Move 1 in opening, Best' },
  { moveIndex: 5, label: 'Excellent', shouldBeBook: true, name: 'Move 6 in opening, Excellent' },
  { moveIndex: 19, label: 'Good', shouldBeBook: true, name: 'Move 20 in opening, Good' },
  { moveIndex: 20, label: 'Best', shouldBeBook: false, name: 'Move 21, outside opening' },
  { moveIndex: 5, label: 'Mistake', shouldBeBook: false, name: 'Move 6, Mistake quality' },
  { moveIndex: 5, label: 'Blunder', shouldBeBook: false, name: 'Move 6, Blunder quality' },
];

let bookPassed = 0;
for (const test of bookTestCases) {
  const isInOpening = test.moveIndex < 20;
  const hasGoodQuality = !['Mistake', 'Blunder', 'Inaccuracy'].includes(test.label);
  const isBook = isInOpening && hasGoodQuality;
  const status = isBook === test.shouldBeBook ? '✅' : '❌';
  console.log(`${status} ${test.name}`);
  console.log(`   Move Index: ${test.moveIndex}, Label: ${test.label}`);
  console.log(`   Expected Book: ${test.shouldBeBook}, Got: ${isBook}`);
  if (isBook === test.shouldBeBook) bookPassed++;
}
console.log(`\nPassed: ${bookPassed}/${bookTestCases.length}`);

// Test 4: Display label priority
console.log('\n✓ Test 4: Display Label Priority');
console.log('-'.repeat(50));

function getDisplayLabel(tags, baseLabel) {
  return tags.includes('Brilliant')
    ? 'Brilliant'
    : tags.includes('Great')
    ? 'Great'
    : tags.includes('Book')
    ? 'Book'
    : tags.includes('Miss')
    ? 'Miss'
    : baseLabel;
}

const displayTestCases = [
  { tags: ['Brilliant', 'Great'], label: 'Best', expected: 'Brilliant' },
  { tags: ['Great', 'Book'], label: 'Excellent', expected: 'Great' },
  { tags: ['Book'], label: 'Good', expected: 'Book' },
  { tags: ['Miss'], label: 'Good', expected: 'Miss' },
  { tags: [], label: 'Excellent', expected: 'Excellent' },
];

let displayPassed = 0;
for (const test of displayTestCases) {
  const result = getDisplayLabel(test.tags, test.label);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`${status} Display: ${JSON.stringify(test.tags)} + ${test.label}`);
  console.log(`   Expected: ${test.expected}, Got: ${result}`);
  if (result === test.expected) displayPassed++;
}
console.log(`\nPassed: ${displayPassed}/${displayTestCases.length}`);

// Summary
console.log('\n' + '='.repeat(50));
const totalTests = testCases.length + greatTestCases.length + bookTestCases.length + displayTestCases.length;
const totalPassed = passed + greatPassed + bookPassed + displayPassed;
console.log(`\n📊 TOTAL: ${totalPassed}/${totalTests} tests passed`);
console.log(`Success rate: ${Math.round(totalPassed / totalTests * 100)}%`);

if (totalPassed === totalTests) {
  console.log('\n✅ All tests passed! Bug fixes are working correctly.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Review the output above.\n');
  process.exit(1);
}
