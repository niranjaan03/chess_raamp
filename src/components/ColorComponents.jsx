import React from 'react';
import { useMoveColors } from '../hooks/useMoveColors';
import '../styles/moveColors.css';

/**
 * Color Legend Component
 * Displays all move types with their corresponding colors
 */
export const ColorLegend = ({ 
  layout = 'grid', // 'grid' | 'horizontal' | 'vertical'
  showDescription = true,
  className = ''
}) => {
  const { getAllColors } = useMoveColors();
  const colors = getAllColors();

  const containerClass = {
    grid: 'color-legend',
    horizontal: 'flex gap-4 flex-wrap',
    vertical: 'flex flex-col gap-3',
  }[layout] || 'color-legend';

  return (
    <div className={`${containerClass} ${className}`}>
      {colors.map((color) => (
        <div key={color.type} className="legend-item">
          <div
            className="legend-color"
            style={{
              backgroundColor: color.bg,
              borderColor: color.border,
            }}
            title={color.label}
          />
          <div>
            <div className="legend-label" style={{ color: color.bg }}>
              {color.label}
            </div>
            {showDescription && (
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {color.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Move Badge Component
 * Displays a move type as a colored badge
 */
export const MoveBadge = ({ 
  moveType, 
  className = '',
  onClick,
  showIcon = true,
}) => {
  const { getColorScheme, getBadgeStyle } = useMoveColors();
  const scheme = getColorScheme(moveType);

  const getMoveIcon = (type) => {
    const icons = {
      brilliant: '✨',
      great: '⭐',
      book: '📚',
      best: '✅',
      excellent: '👌',
      good: '👍',
      novelty: '🎯',
      inaccuracy: '⚠️',
      mistake: '❌',
      miss: '😕',
      blunder: '💥',
    };
    return icons[type?.toLowerCase()] || '♟️';
  };

  return (
    <span
      className={`move-badge ${className}`}
      style={getBadgeStyle(moveType)}
      onClick={onClick}
      role="status"
    >
      {showIcon && <span style={{ marginRight: '0.5rem' }}>
        {getMoveIcon(moveType)}
      </span>}
      {scheme.label}
    </span>
  );
};

/**
 * Move Card Component
 * Displays move analysis in a colored card
 */
export const MoveCard = ({
  moveType,
  san,
  evaluation,
  accuracy,
  children,
  className = '',
  onClick,
}) => {
  const { getCardStyle, getColorScheme } = useMoveColors();
  const scheme = getColorScheme(moveType);

  return (
    <div
      className={`move-card ${className}`}
      style={getCardStyle(moveType)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ 
          fontSize: '1.25rem', 
          fontWeight: '700',
          color: scheme.bg
        }}>
          {san}
        </span>
        <MoveBadge moveType={moveType} showIcon={true} />
      </div>

      {evaluation !== undefined && (
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          Evaluation: <strong>{evaluation}</strong>
        </div>
      )}

      {accuracy !== undefined && (
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          Accuracy: <strong style={{ color: scheme.bg }}>{accuracy}%</strong>
        </div>
      )}

      {children && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Accuracy Indicator Component
 * Shows accuracy with color-coded background
 */
export const AccuracyIndicator = ({
  accuracy,
  size = 'md', // 'sm' | 'md' | 'lg'
  showLabel = true,
  className = '',
}) => {
  const { getAccuracyColor } = useMoveColors();
  const color = getAccuracyColor(accuracy);

  const sizeStyles = {
    sm: { fontSize: '1rem', padding: '0.25rem 0.5rem' },
    md: { fontSize: '1.5rem', padding: '0.5rem 1rem' },
    lg: { fontSize: '2rem', padding: '1rem 1.5rem' },
  };

  let label = 'Unknown';
  if (accuracy >= 95) label = 'Excellent';
  else if (accuracy >= 85) label = 'Good';
  else if (accuracy >= 70) label = 'Acceptable';
  else if (accuracy >= 50) label = 'Poor';
  else label = 'Critical';

  return (
    <div
      className={`accuracy-indicator ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: sizeStyles[size].padding,
        backgroundColor: `${color}15`, // 15% opacity
        borderRadius: '0.5rem',
        border: `2px solid ${color}`,
      }}
    >
      <div style={{
        fontSize: sizeStyles[size].fontSize,
        fontWeight: '700',
        color: color,
      }}>
        {accuracy.toFixed(1)}%
      </div>
      {showLabel && (
        <div style={{
          fontSize: '0.75rem',
          color: color,
          fontWeight: '600',
          marginTop: '0.25rem',
        }}>
          {label}
        </div>
      )}
    </div>
  );
};

/**
 * Stats Bar Component
 * Shows distribution of move types as horizontal bars
 */
export const StatsBar = ({
  data, // { brilliant: 2, best: 10, excellent: 15, ... }
  height = '24px',
  className = '',
}) => {
  const { getColorScheme } = useMoveColors();
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return <div className={className}>No data available</div>;
  }

  return (
    <div
      className={`stats-bar ${className}`}
      style={{
        display: 'flex',
        height: height,
        borderRadius: '0.25rem',
        overflow: 'hidden',
        gap: '1px',
        backgroundColor: '#f3f4f6',
      }}
    >
      {Object.entries(data).map(([type, count]) => {
        if (count === 0) return null;
        
        const percentage = (count / total) * 100;
        const scheme = getColorScheme(type);

        return (
          <div
            key={type}
            style={{
              width: `${percentage}%`,
              backgroundColor: scheme.bg,
              transition: 'all 0.3s ease',
            }}
            title={`${scheme.label}: ${count} (${percentage.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
};

export default ColorLegend;
