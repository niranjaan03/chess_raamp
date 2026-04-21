#!/usr/bin/env node

/**
 * Generate premium chess move sounds
 * This script creates high-quality sound files for:
 * - Premium Chime: A elegant, classy chime sound
 * - Glass Bell: A crystal-clear bell sound
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple WAV file writer
function writeWavFile(filename, audioData, sampleRate = 44100) {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  
  const subChunk1Size = 16; // PCM
  const subChunk2Size = audioData.length * 2;
  const chunkSize = 36 + subChunk2Size;

  const buffer = Buffer.alloc(44 + audioData.length * 2);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(chunkSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt subchunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(subChunk1Size, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM
  buffer.writeUInt16LE(channels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data subchunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(subChunk2Size, offset); offset += 4;

  // Write audio samples
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i])); // Clamp
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    buffer.writeInt16LE(int16, offset);
    offset += 2;
  }

  fs.writeFileSync(filename, buffer);
  console.log(`✓ Created ${filename}`);
}

// Generate premium chime sound (elegant, sophisticated)
function generatePremiumChime() {
  const sampleRate = 44100;
  const duration = 0.6; // 600ms
  const samples = sampleRate * duration;
  const audioData = new Float32Array(samples);

  // Create a rich, premium chime sound with multiple harmonics
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    
    // Main frequency (A5 = 880 Hz) - elegant and high-pitched
    const freq1 = 880;
    // Harmonics for richness
    const freq2 = 880 * 1.5; // Perfect fifth
    const freq3 = 880 * 2;   // Octave
    
    // Amplitude envelope (smooth decay)
    const envelope = Math.exp(-4 * t);
    
    // Mix harmonics with slight detuning for warmth
    const wave = (
      0.5 * Math.sin(2 * Math.PI * freq1 * t) +
      0.3 * Math.sin(2 * Math.PI * freq2 * t + 0.1) +
      0.2 * Math.sin(2 * Math.PI * freq3 * t + 0.2)
    ) / 1.0;
    
    audioData[i] = wave * envelope * 0.8;
  }

  const outputPath = path.join(__dirname, 'public', 'sounds', 'premium-chime.wav');
  writeWavFile(outputPath, audioData);
}

// Generate glass bell sound (crystalline, resonant)
function generateGlassBell() {
  const sampleRate = 44100;
  const duration = 0.8; // 800ms
  const samples = sampleRate * duration;
  const audioData = new Float32Array(samples);

  // Create a glass bell sound with metallic quality
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    
    // Main frequency (G5 = 784 Hz) - slightly lower for bell
    const freq1 = 784;
    // Complex harmonics for that crystalline bell tone
    const freq2 = 784 * 1.2;
    const freq3 = 784 * 1.9;
    const freq4 = 784 * 2.5;
    
    // Two-stage envelope: attack then decay
    const envelope = t < 0.05 
      ? t / 0.05 // Attack
      : Math.exp(-3.5 * (t - 0.05)); // Decay
    
    // Add slight phase modulation for bell-like quality
    const phaseModulation = 0.3 * Math.sin(2 * Math.PI * 3 * t);
    
    const wave = (
      0.4 * Math.sin(2 * Math.PI * freq1 * t + phaseModulation) +
      0.3 * Math.sin(2 * Math.PI * freq2 * t + 0.3 + phaseModulation * 0.5) +
      0.2 * Math.sin(2 * Math.PI * freq3 * t + 0.6) +
      0.1 * Math.sin(2 * Math.PI * freq4 * t + 0.9)
    ) / 1.0;
    
    audioData[i] = wave * envelope * 0.85;
  }

  const outputPath = path.join(__dirname, 'public', 'sounds', 'glass-bell.wav');
  writeWavFile(outputPath, audioData);
}

// Main
try {
  console.log('🎵 Generating premium chess move sounds...\n');
  
  // Ensure sounds directory exists
  const soundsDir = path.join(__dirname, 'public', 'sounds');
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
    console.log(`✓ Created ${soundsDir}`);
  }

  generatePremiumChime();
  generateGlassBell();
  
  console.log('\n✅ Sound generation complete!');
} catch (error) {
  console.error('❌ Error generating sounds:', error.message);
  process.exit(1);
}
