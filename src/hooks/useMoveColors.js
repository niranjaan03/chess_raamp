/**
 * Hook for consistent color management across the app
 * Uses colors from chess.py color_map
 */

export const useMoveColors = () => {
  const colors = {
    brilliant: {
      bg: '#3b82f6',
      border: '#1e40af',
      text: '#ffffff',
      label: 'Brilliant',
      description: 'Best play with sacrifice/risk'
    },
    great: {
      bg: '#06b6d4',
      border: '#0369a1',
      text: '#ffffff',
      label: 'Great',
      description: 'Excellent within small margin'
    },
    book: {
      bg: '#0ea5e9',
      border: '#0369a1',
      text: '#ffffff',
      label: 'Book',
      description: 'Opening theory move'
    },
    best: {
      bg: '#16a34a',
      border: '#15803d',
      text: '#ffffff',
      label: 'Best',
      description: 'Perfect move'
    },
    excellent: {
      bg: '#22c55e',
      border: '#16a34a',
      text: '#ffffff',
      label: 'Excellent',
      description: 'Near-perfect move'
    },
    good: {
      bg: '#84cc16',
      border: '#65a30d',
      text: '#ffffff',
      label: 'Good',
      description: 'Solid move'
    },
    novelty: {
      bg: '#06b6d4',
      border: '#0369a1',
      text: '#ffffff',
      label: 'Novelty',
      description: 'Rare or new move'
    },
    inaccuracy: {
      bg: '#f59e0b',
      border: '#d97706',
      text: '#ffffff',
      label: 'Inaccuracy',
      description: 'Minor error'
    },
    mistake: {
      bg: '#f97316',
      border: '#ea580c',
      text: '#ffffff',
      label: 'Mistake',
      description: 'Significant error'
    },
    miss: {
      bg: '#eab308',
      border: '#ca8a04',
      text: '#ffffff',
      label: 'Miss',
      description: 'Missed opportunity'
    },
    blunder: {
      bg: '#ef4444',
      border: '#dc2626',
      text: '#ffffff',
      label: 'Blunder',
      description: 'Major error'
    },
  };

  /**
   * Get color scheme for a move type
   * @param {string} moveType - Move type (e.g., 'brilliant', 'best', 'blunder')
   * @returns {object} Color object with bg, border, text, label, description
   */
  const getColorScheme = (moveType) => {
    if (!moveType) return colors.best;
    
    const normalized = moveType.toLowerCase().trim();
    return colors[normalized] || colors.best;
  };

  /**
   * Get background color for a move type
   * @param {string} moveType - Move type
   * @returns {string} Hex color code
   */
  const getBgColor = (moveType) => {
    return getColorScheme(moveType).bg;
  };

  /**
   * Get border color for a move type
   * @param {string} moveType - Move type
   * @returns {string} Hex color code
   */
  const getBorderColor = (moveType) => {
    return getColorScheme(moveType).border;
  };

  /**
   * Get text color for a move type
   * @param {string} moveType - Move type
   * @returns {string} Hex color code
   */
  const getTextColor = (moveType) => {
    return getColorScheme(moveType).text;
  };

  /**
   * Get styled className for move badge (Tailwind)
   * @param {string} moveType - Move type
   * @returns {string} Tailwind className
   */
  const getBadgeClass = (moveType) => {
    const typeMap = {
      'brilliant': 'move-badge brilliant',
      'great': 'move-badge great',
      'book': 'move-badge book',
      'best': 'move-badge best',
      'excellent': 'move-badge excellent',
      'good': 'move-badge good',
      'novelty': 'move-badge novelty',
      'inaccuracy': 'move-badge inaccuracy',
      'mistake': 'move-badge mistake',
      'miss': 'move-badge miss',
      'blunder': 'move-badge blunder',
    };
    
    const normalized = moveType?.toLowerCase().trim();
    return typeMap[normalized] || 'move-badge';
  };

  /**
   * Get inline styles for move badge
   * @param {string} moveType - Move type
   * @returns {object} React inline style object
   */
  const getBadgeStyle = (moveType) => {
    const scheme = getColorScheme(moveType);
    return {
      backgroundColor: scheme.bg,
      borderColor: scheme.border,
      color: scheme.text,
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      borderWidth: '2px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    };
  };

  /**
   * Get inline styles for move card
   * @param {string} moveType - Move type
   * @returns {object} React inline style object
   */
  const getCardStyle = (moveType) => {
    const scheme = getColorScheme(moveType);
    return {
      borderLeftColor: scheme.bg,
      borderLeftWidth: '4px',
      padding: '1rem',
      borderRadius: '0.5rem',
      backgroundColor: `${scheme.bg}10`, // 10% opacity
      transition: 'all 0.3s ease',
    };
  };

  /**
   * Get accuracy color based on percentage
   * @param {number} accuracy - Accuracy percentage (0-100)
   * @returns {string} Hex color code
   */
  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 95) return colors.excellent.bg;
    if (accuracy >= 85) return colors.good.bg;
    if (accuracy >= 70) return colors.inaccuracy.bg;
    if (accuracy >= 50) return colors.mistake.bg;
    return colors.blunder.bg;
  };

  /**
   * Get all colors for legend/display
   * @returns {array} Array of color objects
   */
  const getAllColors = () => {
    return [
      { type: 'brilliant', ...colors.brilliant },
      { type: 'great', ...colors.great },
      { type: 'book', ...colors.book },
      { type: 'best', ...colors.best },
      { type: 'excellent', ...colors.excellent },
      { type: 'good', ...colors.good },
      { type: 'inaccuracy', ...colors.inaccuracy },
      { type: 'mistake', ...colors.mistake },
      { type: 'miss', ...colors.miss },
      { type: 'blunder', ...colors.blunder },
    ];
  };

  return {
    colors,
    getColorScheme,
    getBgColor,
    getBorderColor,
    getTextColor,
    getBadgeClass,
    getBadgeStyle,
    getCardStyle,
    getAccuracyColor,
    getAllColors,
  };
};

export default useMoveColors;
