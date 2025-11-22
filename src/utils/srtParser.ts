export interface LyricLine {
  id: number;
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
  text: string;
}

export const parseSRT = (srtContent: string): LyricLine[] => {
  const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');
  const lyrics: LyricLine[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // It's an ID
    const id = parseInt(line);
    if (isNaN(id)) continue;
    
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
    
    lyrics.push({ id, startTime, endTime, text });
  }
  
  return lyrics;
};

const parseTime = (timeStr: string): number => {
  // Format: 00:00:31,384
  if (!timeStr) return 0;
  const parts = timeStr.split(',');
  const hms = parts[0];
  const ms = parts[1] ? parseInt(parts[1]) : 0;
  
  const [h, m, s] = hms.split(':').map(Number);
  return (h * 3600 + m * 60 + s) * 1000 + ms;
};

