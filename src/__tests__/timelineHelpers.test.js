import {
  alignTimelineItemToPlayhead,
  canEditTimelineItem,
  fitTimelineDuration,
  formatTimelineTime,
  getTimelineDuration,
  getTimelineSnapValue,
  moveTimelineItemTrack,
  normalizeTimelineCuePoints,
  resetTimelineDuration,
  syncTimelineWithObjects,
} from '../logic/timeline';

describe('timeline helpers', () => {
  test('normalizes cue points by clamping, sorting and numbering', () => {
    const cues = normalizeTimelineCuePoints(
      [
        { id: 'late', time: 9, label: 'Cue 9' },
        { id: 'early', time: -2, label: '' },
        { id: 'named', time: 2.25, label: 'Intro' },
      ],
      6
    );

    expect(cues.map((cue) => [cue.id, cue.time, cue.label])).toEqual([
      ['early', 0, 'Cue 1'],
      ['named', 2.25, 'Intro'],
      ['late', 6, 'Cue 3'],
    ]);
  });

  test('uses manual duration only when it is not shorter than content', () => {
    const activity = {
      timelineDuration: 20,
      objects: [{ id: 'a', type: 'text', label: 'A' }],
      timeline: [{ id: 'ta', objectId: 'a', start: 4, duration: 3 }],
    };

    expect(getTimelineDuration(activity)).toBe(20);
    expect(getTimelineDuration({ ...activity, timelineDuration: 5 })).toBe(7);
    expect(fitTimelineDuration(activity).timelineDuration).toBe(7);
    expect(resetTimelineDuration({ objects: [], timeline: [], timelineDuration: 80 }).timelineDuration).toBe(5);
  });

  test('syncs timeline rows to existing objects and drops deleted object rows', () => {
    const timeline = syncTimelineWithObjects({
      objects: [
        { id: 'a', type: 'text', label: 'A' },
        { id: 'b', type: 'image', label: 'B' },
      ],
      timeline: [
        { id: 'ta', objectId: 'a', start: 1, duration: 2 },
        { id: 'deleted', objectId: 'gone', start: 0, duration: 9 },
      ],
    });

    expect(timeline.map((item) => item.objectId)).toEqual(['a', 'b']);
    expect(timeline[0]).toMatchObject({ id: 'ta', start: 1, duration: 2 });
  });

  test('snaps to nearby cue points before grid step', () => {
    expect(getTimelineSnapValue(2.04, { cuePoints: [{ time: 2 }], duration: 5, enabled: true })).toBe(2);
    expect(getTimelineSnapValue(2.14, { cuePoints: [{ time: 2 }], duration: 5, enabled: true })).toBe(2.1);
    expect(getTimelineSnapValue(2.14, { cuePoints: [{ time: 2 }], duration: 5, enabled: false })).toBe(2.14);
  });

  test('aligns and reorders timeline items without mutating input', () => {
    const source = [
      { id: 'a', start: 0, duration: 2 },
      { id: 'b', start: 4, duration: 3 },
    ];

    expect(alignTimelineItemToPlayhead(source, 'b', 8, 'end')[1].start).toBe(5);
    expect(moveTimelineItemTrack(source, 'b', -1).map((item) => item.id)).toEqual(['b', 'a']);
    expect(source.map((item) => item.id)).toEqual(['a', 'b']);
  });

  test('guards locked objects and formats timeline clock labels', () => {
    expect(canEditTimelineItem({ objectId: 'a' }, [{ id: 'a', locked: true }])).toBe(false);
    expect(canEditTimelineItem({ objectId: 'a' }, [{ id: 'a', locked: false }])).toBe(true);
    expect(formatTimelineTime(62.347)).toBe('01:02.35');
  });
});
