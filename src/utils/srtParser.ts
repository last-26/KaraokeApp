export interface LyricLine {
  id: string; // ID is string to support custom IDs like "break-1"
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
  text: string;
  isInstrumental?: boolean; // Indicates if this line represents an instrumental break
}

/**
 * Parses an SRT string into an array of LyricLine objects.
 * Handles standard SRT format and automatically inserts instrumental breaks
 * for gaps longer than the defined threshold.
 * 
 * @param srtContent The raw SRT file content string
 * @returns Array of parsed LyricLine objects
 */
export const parseSRT = (srtContent: string): LyricLine[] => {
  const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');
  const lyrics: LyricLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // It's an ID
    const id = line; // Keep ID as string

    // Next line is time
    const timeLine = lines[++i]?.trim();
    if (!timeLine) break;

    const [startStr, endStr] = timeLine.split(' --> ');
    if (!startStr || !endStr) continue;

    const startTime = parseTime(startStr);
    const endTime = parseTime(endStr);

    // Next lines are text until empty line
    let text = '';
    while (i + 1 < lines.length && lines[i + 1].trim() !== '') {
      text += (text ? '\n' : '') + lines[++i].trim();
    }

    lyrics.push({ id, startTime, endTime, text, isInstrumental: false });
  }

  // --- GAP FILLING LOGIC ---
  const lyricsWithBreaks: LyricLine[] = [];
  const GAP_THRESHOLD = 10000; // Fill gaps longer than 10 seconds

  for (let i = 0; i < lyrics.length; i++) {
    lyricsWithBreaks.push(lyrics[i]);

    // If not the last line, check the gap to the next line
    if (i < lyrics.length - 1) {
      const currentEnd = lyrics[i].endTime;
      const nextStart = lyrics[i + 1].startTime;
      const gap = nextStart - currentEnd;

      if (gap > GAP_THRESHOLD) {
        lyricsWithBreaks.push({
          id: `break-${i}`, // Unique ID for the break
          startTime: currentEnd,
          endTime: nextStart,
          text: '🎵', // Icon/text to display during break
          isInstrumental: true
        });
      }
    }
  }

  return lyricsWithBreaks;
};

/**
 * Converts an SRT timestamp string (00:00:00,000) to milliseconds.
 * 
 * @param timeStr Timestamp string in format HH:MM:SS,mmm
 * @returns Time in milliseconds
 */
const parseTime = (timeStr: string): number => {
  // Format: 00:00:31,384
  if (!timeStr) return 0;
  const parts = timeStr.split(',');
  const hms = parts[0];
  const ms = parts[1] ? parseInt(parts[1]) : 0;

  const [h, m, s] = hms.split(':').map(Number);
  return (h * 3600 + m * 60 + s) * 1000 + ms;
};