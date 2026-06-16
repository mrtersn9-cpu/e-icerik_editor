import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getReadyButtonTextStylePatch } from '../../logic/buttonStyling';
import { evaluateStorylineRuntimePuzzle } from '../../utils/storylineRuntimeEngine';

const TURKISH_KEYBOARD = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç']
];

function previewPuzzleButtonTextStyle(activity) {
  return {
    ...getReadyButtonTextStylePatch(activity),
    whiteSpace: 'nowrap',
  };
}

function previewPuzzleActionButtonStyle(activity, variant = 'primary', extra = {}) {
  const primary = variant === 'primary';
  return {
    padding: '8px 18px',
    borderRadius: 8,
    border: primary ? 'none' : '1px solid #cbd5e1',
    background: primary ? '#3b82f6' : '#fff',
    color: primary ? '#fff' : '#334155',
    cursor: 'pointer',
    fontWeight: primary ? 800 : 700,
    ...extra,
    ...previewPuzzleButtonTextStyle(activity),
  };
}

function CrosswordGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = useMemo(() => grid?.cells || [], [grid?.cells]);
  const placed = useMemo(() => activity.puzzlePlaced || [], [activity.puzzlePlaced]);
  const settings = activity.puzzleSettings || {};
  const rows = grid?.rows || 10;
  const cols = grid?.cols || 10;
  const [userGrid, setUserGrid] = useState({});
  const [activeCell, setActiveCell] = useState(null);

  // Modal State'leri
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [modalInput, setModalInput] = useState([]);
  const [modalActiveCharIndex, setModalActiveCharIndex] = useState(0);
  const [questionStatus, setQuestionStatus] = useState({});
  const [attempts, setAttempts] = useState({});
  const [modalFeedback, setModalFeedback] = useState(null); // { type: 'success' | 'error' | 'revealed', text: string }

  const triggerRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Focus Restore Effect
  useEffect(() => {
    if (!activeQuestion) {
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    }
  }, [activeQuestion]);

  // Focus Trap and Escape key Effect
  useEffect(() => {
    if (!activeQuestion) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveQuestion(null);
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab') {
        const container = modalContainerRef.current;
        if (!container) return;
        const focusable = container.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus first button inside the modal
    const timer = setTimeout(() => {
      const container = modalContainerRef.current;
      if (container) {
        const focusable = container.querySelectorAll('button');
        if (focusable.length > 0) focusable[0].focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [activeQuestion]);

  const cellSize = Math.min(28, 320 / cols);
  const totalWidth = cols * cellSize;
  const totalHeight = rows * cellSize;

  useEffect(() => {
    const initial = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r]?.[c];
        if (cell?.letter) {
          initial[`${r},${c}`] = '';
        }
      }
    }
    setUserGrid(initial);
  }, [cells, rows, cols]);

  const handleSelectQuestion = (q) => {
    triggerRef.current = document.activeElement;
    setActiveQuestion(q);
    setModalFeedback(null);
    const len = q.answer?.length || 0;
    const initialInput = Array.from({ length: len }, (_, i) => {
      const r = q.direction === 'across' ? (q.startRow ?? q.row) : (q.startRow ?? q.row) + i;
      const c = q.direction === 'across' ? (q.startCol ?? q.col) + i : (q.startCol ?? q.col);
      return userGrid[`${r},${c}`] || '';
    });
    setModalInput(initialInput);
    setModalActiveCharIndex(0);
  };

  const handleCharInput = useCallback((char) => {
    if (!activeQuestion) return;

    // Lock Kontrolü: Hücre başka tamamlanmış (correct/revealed) kelimeden gelen ortak harf ise kilitli/salt okunur
    const r = activeQuestion.direction === 'across' ? (activeQuestion.startRow ?? activeQuestion.row) : (activeQuestion.startRow ?? activeQuestion.row) + modalActiveCharIndex;
    const c = activeQuestion.direction === 'across' ? (activeQuestion.startCol ?? activeQuestion.col) + modalActiveCharIndex : (activeQuestion.startCol ?? activeQuestion.col);

    let isLocked = false;
    const otherCompleted = placed.filter(other => 
      other.id !== activeQuestion.id && (questionStatus[other.id] === 'correct' || questionStatus[other.id] === 'revealed')
    );
    otherCompleted.forEach(other => {
      const len = other.answer ? other.answer.length : 0;
      for (let j = 0; j < len; j++) {
        const or = other.direction === 'across' ? (other.startRow ?? other.row) : (other.startRow ?? other.row) + j;
        const oc = other.direction === 'across' ? (other.startCol ?? other.col) + j : (other.startCol ?? other.col);
        if (or === r && oc === c) {
          isLocked = true;
        }
      }
    });

    if (isLocked) return;

    const len = activeQuestion.answer?.length || 0;
    const nextInput = [...modalInput];
    nextInput[modalActiveCharIndex] = char.toUpperCase();
    setModalInput(nextInput);

    // Find next unlocked slot
    let nextIndex = modalActiveCharIndex + 1;
    while (nextIndex < len) {
      const nr = activeQuestion.direction === 'across' ? (activeQuestion.startRow ?? activeQuestion.row) : (activeQuestion.startRow ?? activeQuestion.row) + nextIndex;
      const nc = activeQuestion.direction === 'across' ? (activeQuestion.startCol ?? activeQuestion.col) + nextIndex : (activeQuestion.startCol ?? activeQuestion.col);
      
      let nLocked = false;
      otherCompleted.forEach(other => {
        const olen = other.answer ? other.answer.length : 0;
        for (let j = 0; j < olen; j++) {
          const or = other.direction === 'across' ? (other.startRow ?? other.row) : (other.startRow ?? other.row) + j;
          const oc = other.direction === 'across' ? (other.startCol ?? other.col) + j : (other.startCol ?? other.col);
          if (or === nr && oc === nc) nLocked = true;
        }
      });
      if (!nLocked) break;
      nextIndex++;
    }
    if (nextIndex < len) {
      setModalActiveCharIndex(nextIndex);
    }
  }, [activeQuestion, modalInput, modalActiveCharIndex, placed, questionStatus]);

  const handleBackspace = useCallback(() => {
    if (!activeQuestion) return;

    // Lock Kontrolü
    const r = activeQuestion.direction === 'across' ? (activeQuestion.startRow ?? activeQuestion.row) : (activeQuestion.startRow ?? activeQuestion.row) + modalActiveCharIndex;
    const c = activeQuestion.direction === 'across' ? (activeQuestion.startCol ?? activeQuestion.col) + modalActiveCharIndex : (activeQuestion.startCol ?? activeQuestion.col);

    let isLocked = false;
    const otherCompleted = placed.filter(other => 
      other.id !== activeQuestion.id && (questionStatus[other.id] === 'correct' || questionStatus[other.id] === 'revealed')
    );
    otherCompleted.forEach(other => {
      const len = other.answer ? other.answer.length : 0;
      for (let j = 0; j < len; j++) {
        const or = other.direction === 'across' ? (other.startRow ?? other.row) : (other.startRow ?? other.row) + j;
        const oc = other.direction === 'across' ? (other.startCol ?? other.col) + j : (other.startCol ?? other.col);
        if (or === r && oc === c) {
          isLocked = true;
        }
      }
    });

    if (isLocked) return;

    const nextInput = [...modalInput];
    nextInput[modalActiveCharIndex] = '';
    setModalInput(nextInput);

    // Find previous unlocked slot
    let prevIndex = modalActiveCharIndex - 1;
    while (prevIndex >= 0) {
      const pr = activeQuestion.direction === 'across' ? (activeQuestion.startRow ?? activeQuestion.row) : (activeQuestion.startRow ?? activeQuestion.row) + prevIndex;
      const pc = activeQuestion.direction === 'across' ? (activeQuestion.startCol ?? activeQuestion.col) + prevIndex : (activeQuestion.startCol ?? activeQuestion.col);
      
      let pLocked = false;
      otherCompleted.forEach(other => {
        const olen = other.answer ? other.answer.length : 0;
        for (let j = 0; j < olen; j++) {
          const or = other.direction === 'across' ? (other.startRow ?? other.row) : (other.startRow ?? other.row) + j;
          const oc = other.direction === 'across' ? (other.startCol ?? other.col) + j : (other.startCol ?? other.col);
          if (or === pr && oc === pc) pLocked = true;
        }
      });
      if (!pLocked) break;
      prevIndex--;
    }
    if (prevIndex >= 0) {
      setModalActiveCharIndex(prevIndex);
    }
  }, [activeQuestion, modalInput, modalActiveCharIndex, placed, questionStatus]);

  const handleModalCheck = useCallback(() => {
    if (!activeQuestion) return;
    const qId = activeQuestion.id;
    const currentStatus = questionStatus[qId];
    if (currentStatus === 'correct' || currentStatus === 'revealed') return;

    const answer = activeQuestion.answer || '';
    const userInput = modalInput.join('');
    const isCorrect = userInput.toUpperCase() === answer.toUpperCase();

    const currentAttempts = (attempts[qId] || 0) + 1;
    setAttempts((prev) => ({ ...prev, [qId]: currentAttempts }));

    if (isCorrect) {
      const nextStatus = { ...questionStatus, [qId]: 'correct' };
      setQuestionStatus(nextStatus);
      setModalFeedback({ type: 'success', text: '✓ Tebrikler, doğru cevap!' });

      setUserGrid((prev) => {
        const next = { ...prev };
        for (let i = 0; i < answer.length; i++) {
          const r = activeQuestion.direction === 'across' ? (activeQuestion.startRow ?? activeQuestion.row) : (activeQuestion.startRow ?? activeQuestion.row) + i;
          const c = activeQuestion.direction === 'across' ? (activeQuestion.startCol ?? activeQuestion.col) + i : (activeQuestion.startCol ?? activeQuestion.col);
          next[`${r},${c}`] = answer[i];
        }
        return next;
      });

      // 1.2 saniye sonra otomatik kapat
      setTimeout(() => {
        setActiveQuestion(null);
      }, 1200);
    } else {
      const nextStatus = { ...questionStatus, [qId]: 'incorrect' };
      setQuestionStatus(nextStatus);
      setModalFeedback({ type: 'error', text: `× Hatalı cevap! Tekrar deneyebilirsiniz.` });
    }
  }, [activeQuestion, modalInput, questionStatus, attempts]);

  const handleRevealSolution = useCallback(() => {
    if (!activeQuestion) return;
    const qId = activeQuestion.id;
    const currentStatus = questionStatus[qId];
    if (currentStatus === 'correct' || currentStatus === 'revealed') return;

    const answer = activeQuestion.answer || '';

    setModalInput(answer.split(''));
    const nextStatus = { ...questionStatus, [qId]: 'revealed' };
    setQuestionStatus(nextStatus);
    setModalFeedback({ type: 'revealed', text: '✎ Çözüm gösterildi.' });

    setUserGrid((prev) => {
      const next = { ...prev };
      for (let i = 0; i < answer.length; i++) {
        const r = activeQuestion.direction === 'across' ? (activeQuestion.startRow ?? activeQuestion.row) : (activeQuestion.startRow ?? activeQuestion.row) + i;
        const c = activeQuestion.direction === 'across' ? (activeQuestion.startCol ?? activeQuestion.col) + i : (activeQuestion.startCol ?? activeQuestion.col);
        next[`${r},${c}`] = answer[i];
      }
      return next;
    });

    // 1.5 saniye sonra kapat
    setTimeout(() => {
      setActiveQuestion(null);
    }, 1500);
  }, [activeQuestion, questionStatus]);

  // Fiziksel klavye dinleyicisi
  useEffect(() => {
    if (!activeQuestion) return;
    const handler = (e) => {
      const key = e.key.toUpperCase();
      if (key === 'BACKSPACE') {
        handleBackspace();
        e.preventDefault();
      } else if (key === 'ENTER') {
        handleModalCheck();
        e.preventDefault();
      } else if (key === 'ESCAPE') {
        setActiveQuestion(null);
        e.preventDefault();
      } else if (key.length === 1 && /[A-ZÇĞİÖŞÜ]/.test(key)) {
        handleCharInput(key);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeQuestion, modalInput, modalActiveCharIndex, handleBackspace, handleCharInput, handleModalCheck]);

  const handleGridCellClick = (r, c) => {
    const cell = cells[r]?.[c];
    if (!cell?.letter) return;
    // Bu hücreye sahip bir placed sorusunu buluyoruz
    const foundQuestion = placed.find((q) => {
      const len = q.answer?.length || 0;
      for (let i = 0; i < len; i++) {
        const qr = q.direction === 'across' ? (q.startRow ?? q.row) : (q.startRow ?? q.row) + i;
        const qc = q.direction === 'across' ? (q.startCol ?? q.col) + i : (q.startCol ?? q.col);
        if (qr === r && qc === c) return true;
      }
      return false;
    });
    if (foundQuestion) {
      handleSelectQuestion(foundQuestion);
    }
  };

  const handleKeyDown = (r, c, e) => {
    const key = e.key.toUpperCase();
    if (key === 'ARROWRIGHT') {
      if (c + 1 < cols && cells[r]?.[c + 1]?.letter) {
        setActiveCell([r, c + 1]);
      }
      e.preventDefault();
      return;
    }
    if (key === 'ARROWLEFT') {
      if (c - 1 >= 0 && cells[r]?.[c - 1]?.letter) {
        setActiveCell([r, c - 1]);
      }
      e.preventDefault();
      return;
    }
    if (key === 'ARROWUP') {
      if (r - 1 >= 0 && cells[r - 1]?.[c]?.letter) {
        setActiveCell([r - 1, c]);
      }
      e.preventDefault();
      return;
    }
    if (key === 'ARROWDOWN') {
      if (r + 1 < rows && cells[r + 1]?.[c]?.letter) {
        setActiveCell([r + 1, c]);
      }
      e.preventDefault();
      return;
    }
    if (key === ' ' || key === 'ENTER' || (key.length === 1 && /[A-ZÇĞİÖŞÜ]/.test(key))) {
      const foundQuestion = placed.find((q) => {
        const len = q.answer?.length || 0;
        for (let i = 0; i < len; i++) {
          const qr = q.direction === 'across' ? (q.startRow ?? q.row) : (q.startRow ?? q.row) + i;
          const qc = q.direction === 'across' ? (q.startCol ?? q.col) + i : (q.startCol ?? q.col);
          if (qr === r && qc === c) return true;
        }
        return false;
      });
      if (foundQuestion) {
        handleSelectQuestion(foundQuestion);
      }
      e.preventDefault();
    }
  };

  const checkAnswer = () => {
    const puzzleGridState = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r]?.[c];
        if (cell?.letter) {
          puzzleGridState[`${r},${c}`] = userGrid[`${r},${c}`] || '';
        }
      }
    }
    const evalResult = evaluateStorylineRuntimePuzzle({
      activity,
      state: { 
        puzzleGrid: puzzleGridState,
        puzzleQuestionStatus: questionStatus,
        puzzleAttempts: attempts
      }
    });
    onAnswer?.(evalResult);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, overflow: 'auto', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gap: 1,
            background: '#cbd5e1',
            border: '1px solid #94a3b8',
            width: totalWidth + cols - 1,
            height: totalHeight + rows - 1,
          }}
        >
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const cell = cells[r]?.[c];
              const isActive = activeCell && activeCell[0] === r && activeCell[1] === c;
              const hasLetter = cell?.letter;
              return (
                <div
                  key={`${r}-${c}`}
                  tabIndex={hasLetter ? 0 : -1}
                  onClick={() => handleGridCellClick(r, c)}
                  onKeyDown={(e) => handleKeyDown(r, c, e)}
                  style={{
                    background: hasLetter ? (isActive ? '#3b82f6' : '#fff') : '#1e293b',
                    color: isActive ? '#fff' : '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: cellSize * 0.55,
                    fontWeight: 700,
                    position: 'relative',
                    cursor: hasLetter ? 'pointer' : 'default',
                    outline: isActive ? '2px solid #2563eb' : 'none',
                    outlineOffset: '-1px',
                  }}
                >
                  {cell?.number && (
                    <span style={{ position: 'absolute', top: 1, left: 2, fontSize: cellSize * 0.28, fontWeight: 600, color: '#64748b' }}>
                      {cell.number}
                    </span>
                  )}
                  {userGrid[`${r},${c}`] || ''}
                </div>
              );
            })
          )}
        </div>
        {settings.showClues !== false && (
          <div style={{ minWidth: 200, flex: 1, fontSize: 13, maxHeight: totalHeight, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, color: '#1e293b', borderBottom: '2px solid #e2e8f0', pb: 2, mb: 4 }}>YATAY SORULAR</div>
              {placed.filter((p) => p.direction === 'across').map((p) => {
                const status = questionStatus[p.id];
                const isCorrect = status === 'correct';
                const isIncorrect = status === 'incorrect';
                const isRevealed = status === 'revealed';

                let color = '#475569';
                let bg = 'transparent';
                let icon = '';

                if (isCorrect) {
                  color = '#166534';
                  bg = '#dcfce7';
                  icon = ' ✓';
                } else if (isIncorrect) {
                  color = '#991b1b';
                  bg = '#fee2e2';
                  icon = ' ×';
                } else if (isRevealed) {
                  color = '#5b21b6';
                  bg = '#f3e8ff';
                  icon = ' ✎';
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectQuestion(p)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 6,
                      marginBottom: 2,
                      color,
                      background: bg,
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'background 0.2s',
                    }}
                  >
                    <strong>{p.number}</strong>. {p.question || p.clue} {icon}
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#1e293b', borderBottom: '2px solid #e2e8f0', pb: 2, mb: 4 }}>DİKEY SORULAR</div>
              {placed.filter((p) => p.direction === 'down').map((p) => {
                const status = questionStatus[p.id];
                const isCorrect = status === 'correct';
                const isIncorrect = status === 'incorrect';
                const isRevealed = status === 'revealed';

                let color = '#475569';
                let bg = 'transparent';
                let icon = '';

                if (isCorrect) {
                  color = '#166534';
                  bg = '#dcfce7';
                  icon = ' ✓';
                } else if (isIncorrect) {
                  color = '#991b1b';
                  bg = '#fee2e2';
                  icon = ' ×';
                } else if (isRevealed) {
                  color = '#5b21b6';
                  bg = '#f3e8ff';
                  icon = ' ✎';
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectQuestion(p)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 6,
                      marginBottom: 2,
                      color,
                      background: bg,
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'background 0.2s',
                    }}
                  >
                    <strong>{p.number}</strong>. {p.question || p.clue} {icon}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button onClick={checkAnswer} style={previewPuzzleActionButtonStyle(activity, 'primary')}>
        Kontrol Et
      </button>

      {/* Soru Cevaplama Modalı */}
      {activeQuestion && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: settings.backdropBlur === false ? 'none' : 'blur(4px)',
          }}
        >
          <div
            ref={modalContainerRef}
            style={{
              width: 'min(540px, 100%)',
              borderRadius: 20,
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Soru {activeQuestion.number} ({activeQuestion.direction === 'across' ? 'Yatay' : 'Dikey'})
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
                Deneme Sayısı: {attempts[activeQuestion.id] || 0}
              </div>
            </div>
            
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', lineHeight: 1.5 }}>
              {activeQuestion.question || activeQuestion.clue}
            </div>

            {/* Geri Bildirim Alanı */}
            {modalFeedback && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  background: modalFeedback.type === 'success' ? '#dcfce7' : modalFeedback.type === 'error' ? '#fee2e2' : '#f3e8ff',
                  color: modalFeedback.type === 'success' ? '#15803d' : modalFeedback.type === 'error' ? '#b91c1c' : '#6d28d9',
                  border: `1px solid ${modalFeedback.type === 'success' ? '#bbf7d0' : modalFeedback.type === 'error' ? '#fecaca' : '#e9d5ff'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {modalFeedback.text}
              </div>
            )}

            {/* Harf Kutuları */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', my: 8 }}>
              {modalInput.map((char, index) => {
                const isActive = modalActiveCharIndex === index;
                return (
                  <div
                    key={index}
                    onClick={() => setModalActiveCharIndex(index)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: `2px solid ${isActive ? '#4f46e5' : '#cbd5e1'}`,
                      background: isActive ? '#f5f3ff' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#1e293b',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 0 0 3px #c7d2fe' : 'none',
                    }}
                  >
                    {char}
                  </div>
                );
              })}
            </div>

            {/* Türkçe Sanal Klavye */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              {TURKISH_KEYBOARD.map((row, rIdx) => (
                <div key={rIdx} style={{ display: 'flex', gap: 4 }}>
                  {row.map((char) => (
                    <button
                      key={char}
                      onClick={() => handleCharInput(char)}
                      style={{
                        minWidth: 30,
                        height: 32,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        padding: '0 8px',
                      }}
                    >
                      {char}
                    </button>
                  ))}
                  {rIdx === 2 && (
                    <button
                      onClick={handleBackspace}
                      style={{
                        height: 32,
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0 10px',
                      }}
                    >
                      ← Sil
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Aksiyonlar */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                onClick={handleModalCheck}
                disabled={questionStatus[activeQuestion.id] === 'correct' || questionStatus[activeQuestion.id] === 'revealed' || modalFeedback?.type === 'revealed'}
                style={previewPuzzleActionButtonStyle(activity, 'primary', {
                  flex: '2 1 140px',
                  height: 38,
                  borderRadius: 10,
                  background: '#4f46e5',
                  cursor: (questionStatus[activeQuestion.id] === 'correct' || questionStatus[activeQuestion.id] === 'revealed' || modalFeedback?.type === 'revealed') ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  opacity: (questionStatus[activeQuestion.id] === 'correct' || questionStatus[activeQuestion.id] === 'revealed' || modalFeedback?.type === 'revealed') ? 0.5 : 1
                })}
              >
                ✓ Kontrol Et
              </button>
              {settings.allowHints !== false && (
                <button
                  onClick={handleRevealSolution}
                  disabled={questionStatus[activeQuestion.id] === 'correct' || questionStatus[activeQuestion.id] === 'revealed' || modalFeedback?.type === 'revealed'}
                  style={previewPuzzleActionButtonStyle(activity, 'secondary', {
                    flex: '1 1 110px',
                    height: 38,
                    borderRadius: 10,
                    border: '1px solid #d97706',
                    background: '#fef3c7',
                    color: '#b45309',
                    cursor: (questionStatus[activeQuestion.id] === 'correct' || questionStatus[activeQuestion.id] === 'revealed' || modalFeedback?.type === 'revealed') ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    opacity: (questionStatus[activeQuestion.id] === 'correct' || questionStatus[activeQuestion.id] === 'revealed' || modalFeedback?.type === 'revealed') ? 0.5 : 1
                  })}
                >
                  ✎ Çözümü Göster
                </button>
              )}
              <button
                onClick={() => setActiveQuestion(null)}
                style={previewPuzzleActionButtonStyle(activity, 'secondary', {
                  flex: '1 1 70px',
                  height: 38,
                  borderRadius: 10,
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: 12,
                })}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WordSearchGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = grid?.cells || [];
  const rows = grid?.rows || 10;
  const cols = grid?.cols || 10;
  const [selectedCells, setSelectedCells] = useState([]);
  const [foundWords, setFoundWords] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const cellSize = Math.min(28, 320 / cols);
  const placed = activity.puzzlePlaced || [];

  const handleMouseDown = (r, c) => {
    setIsDragging(true);
    setSelectedCells([[r, c]]);
  };

  const handleMouseEnter = (r, c) => {
    if (!isDragging) return;
    if (selectedCells.length === 0) return;
    const start = selectedCells[0];
    const dr = r - start[0];
    const dc = c - start[1];
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) {
      setSelectedCells([start]);
      return;
    }
    const stepR = dr / steps;
    const stepC = dc / steps;
    if (stepR !== Math.floor(stepR) || stepC !== Math.floor(stepC)) return;
    const newCells = [];
    for (let i = 0; i <= steps; i++) {
      newCells.push([start[0] + stepR * i, start[1] + stepC * i]);
    }
    setSelectedCells(newCells);
  };

  const completeSelection = (selection = selectedCells) => {
    setIsDragging(false);
    const word = selection.map(([r, c]) => cells[r]?.[c]?.letter).join('');
    const reverseWord = word.split('').reverse().join('');
    const found = placed.find((p) => !foundWords.includes(p.id) && (p.answer === word || p.answer === reverseWord));
    if (found) {
      const nextFound = [...foundWords, found.id];
      setFoundWords(nextFound);
      const evalResult = evaluateStorylineRuntimePuzzle({
        activity,
        state: { puzzleFoundWords: nextFound }
      });
      onAnswer?.(evalResult);
    }
    setSelectedCells([]);
  };

  const handleMouseUp = () => completeSelection();

  const handleCellKeyDown = (event, r, c) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!selectedCells.length) {
      setSelectedCells([[r, c]]);
      return;
    }
    const start = selectedCells[0];
    const dr = r - start[0];
    const dc = c - start[1];
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (!steps) {
      completeSelection([start]);
      return;
    }
    const stepR = dr / steps;
    const stepC = dc / steps;
    if (!Number.isInteger(stepR) || !Number.isInteger(stepC)) return;
    const selection = Array.from({ length: steps + 1 }, (_, index) => [
      start[0] + stepR * index,
      start[1] + stepC * index,
    ]);
    completeSelection(selection);
  };

  const isSelected = (r, c) => selectedCells.some(([sr, sc]) => sr === r && sc === c);
  const isFound = (r, c) => {
    return placed.some((p) => {
      if (!foundWords.includes(p.id)) return false;
      // Korumasız erişim eksik/bozuk veride (direction/answer yok) tüm ızgarayı çökertiyordu.
      if (typeof p.direction !== 'string' || !p.answer) return false;
      const [dr, dc] = p.direction.split(',').map(Number);
      if (!Number.isFinite(dr) || !Number.isFinite(dc)) return false;
      for (let i = 0; i < p.answer.length; i++) {
        if ((p.startRow ?? p.row) + dr * i === r && (p.startCol ?? p.col) + dc * i === c) return true;
      }
      return false;
    });
  };

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gap: 1,
          background: '#e2e8f0',
          border: '1px solid #cbd5e1',
          width: cols * cellSize + cols - 1,
          height: rows * cellSize + rows - 1,
          userSelect: 'none',
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const sel = isSelected(r, c);
            const found = isFound(r, c);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-label={`${r + 1}. satır ${c + 1}. sütun: ${cells[r]?.[c]?.letter || ''}`}
                onMouseDown={() => handleMouseDown(r, c)}
                onMouseEnter={() => handleMouseEnter(r, c)}
                onKeyDown={(event) => handleCellKeyDown(event, r, c)}
                style={{
                  background: found ? '#22c55e' : sel ? '#3b82f6' : '#fff',
                  color: found ? '#fff' : '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cellSize * 0.55,
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                {cells[r]?.[c]?.letter}
              </button>
            );
          })
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
        Bulunan: {foundWords.length} / {placed.length}
      </div>
      {foundWords.length === placed.length && placed.length > 0 && (
        <div style={{ color: '#22c55e', fontWeight: 700, marginTop: 4 }}>Tüm kelimeleri buldunuz!</div>
      )}
    </div>
  );
}

function SudokuGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = useMemo(() => grid?.cells || [], [grid?.cells]);
  const [userGrid, setUserGrid] = useState({});

  useEffect(() => {
    const initial = {};
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = cells[r]?.[c]?.letter;
        if (cells[r]?.[c]?.isFixed) {
          initial[`${r},${c}`] = val;
        }
      }
    }
    setUserGrid(initial);
  }, [cells]);

  const handleChange = (r, c, value) => {
    if (cells[r]?.[c]?.isFixed) return;
    const num = value === '' ? '' : Math.max(1, Math.min(9, Number(value) || ''));
    setUserGrid((prev) => ({ ...prev, [`${r},${c}`]: num }));
  };

  const checkAnswer = () => {
    const puzzleGridState = {};
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        puzzleGridState[`${r},${c}`] = userGrid[`${r},${c}`] || '';
      }
    }
    const evalResult = evaluateStorylineRuntimePuzzle({
      activity,
      state: { puzzleGrid: puzzleGridState }
    });
    onAnswer?.(evalResult);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 32px)', gap: 1, background: '#1e293b', padding: 2, width: 'fit-content' }}>
        {Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 9 }, (_, c) => {
            const isFixed = cells[r]?.[c]?.isFixed;
            const isThickRight = (c + 1) % 3 === 0 && c < 8;
            const isThickBottom = (r + 1) % 3 === 0 && r < 8;
            return (
              <input
                key={`${r}-${c}`}
                type="text"
                maxLength={1}
                value={userGrid[`${r},${c}`] || ''}
                readOnly={isFixed}
                onChange={(e) => handleChange(r, c, e.target.value)}
                style={{
                  width: 32,
                  height: 32,
                  textAlign: 'center',
                  fontSize: 16,
                  fontWeight: 700,
                  border: 'none',
                  outline: 'none',
                  background: isFixed ? '#e2e8f0' : '#fff',
                  color: isFixed ? '#1e293b' : '#2563eb',
                  marginRight: isThickRight ? 2 : 0,
                  marginBottom: isThickBottom ? 2 : 0,
                }}
              />
            );
          })
        )}
      </div>
      <button onClick={checkAnswer} style={previewPuzzleActionButtonStyle(activity, 'primary', { marginTop: 8, padding: '6px 16px', borderRadius: 6 })}>
        Kontrol Et
      </button>
    </div>
  );
}

function MazeGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = useMemo(() => grid?.cells || [], [grid?.cells]);
  const rows = grid?.rows || 15;
  const cols = grid?.cols || 15;
  const [playerPos, setPlayerPos] = useState({ r: 1, c: 1 });

  const cellSize = Math.min(20, 300 / cols);

  const move = useCallback(
    (dr, dc) => {
      const nr = playerPos.r + dr;
      const nc = playerPos.c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
      if (cells[nr]?.[nc]?.isBlock) return;
      const newPos = { r: nr, c: nc };
      setPlayerPos(newPos);
      if (cells[nr]?.[nc]?.isEnd) {
        const evalResult = evaluateStorylineRuntimePuzzle({
          activity,
          state: { puzzleMazeReachedEnd: true }
        });
        onAnswer?.(evalResult);
      }
    },
    [activity, cells, cols, onAnswer, playerPos, rows]
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp') move(-1, 0);
      if (e.key === 'ArrowDown') move(1, 0);
      if (e.key === 'ArrowLeft') move(0, -1);
      if (e.key === 'ArrowRight') move(0, 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [move]);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gap: 0,
          background: '#1e293b',
          border: '2px solid #1e293b',
          width: cols * cellSize,
          height: rows * cellSize,
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const isBlock = cells[r]?.[c]?.isBlock;
            const isStart = cells[r]?.[c]?.isStart;
            const isEnd = cells[r]?.[c]?.isEnd;
            const isPlayer = playerPos.r === r && playerPos.c === c;
            return (
              <div
                key={`${r}-${c}`}
                style={{
                  background: isBlock ? '#1e293b' : isPlayer ? '#3b82f6' : isStart ? '#22c55e' : isEnd ? '#ef4444' : '#fff',
                  width: cellSize,
                  height: cellSize,
                }}
              />
            );
          })
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>Ok tuşları ile hareket edin. Kırmızı kareye ulaşın.</div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { label: 'Yukarı', dr: -1, dc: 0 },
          { label: 'Sol', dr: 0, dc: -1 },
          { label: 'Sağ', dr: 0, dc: 1 },
          { label: 'Aşağı', dr: 1, dc: 0 },
        ].map((control) => (
          <button
            key={control.label}
            type="button"
            onClick={() => move(control.dr, control.dc)}
            style={previewPuzzleActionButtonStyle(activity, 'secondary', {
              minWidth: 66,
              height: 32,
              borderRadius: 6,
            })}
          >
            {control.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MemoryGrid({ activity, onAnswer }) {
  const cards = activity.puzzlePlaced || [];
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]); // matched pairIds
  const [moves, setMoves] = useState(0);

  const handleFlip = (index) => {
    if (flipped.length >= 2 || flipped.includes(index) || matched.some(pid => cards[index]?.pairId === pid)) return;
    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);
    setMoves((m) => m + 1);
    if (newFlipped.length === 2) {
      const c1 = cards[newFlipped[0]];
      const c2 = cards[newFlipped[1]];
      if (c1.pairId === c2.pairId && newFlipped[0] !== newFlipped[1]) {
        setTimeout(() => {
          const nextMatched = [...matched, c1.pairId];
          setMatched(nextMatched);
          setFlipped([]);
          const evalResult = evaluateStorylineRuntimePuzzle({
            activity,
            state: { puzzleMemoryMatched: nextMatched }
          });
          onAnswer?.(evalResult);
        }, 600);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  const isCardMatched = (card) => matched.includes(card?.pairId);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 72px)', gap: 8 }}>
        {cards.map((card, index) => {
          const isFlipped = flipped.includes(index);
          const isMatched = isCardMatched(card);
          return (
            <button
              key={card.id}
              type="button"
              aria-label={isFlipped || isMatched ? card.text : 'Kartı çevir'}
              onClick={() => handleFlip(index)}
              style={{
                width: 72,
                height: 72,
                background: isMatched ? '#22c55e' : isFlipped ? '#3b82f6' : '#64748b',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 8,
                cursor: isMatched ? 'default' : 'pointer',
                textAlign: 'center',
                padding: 4,
                transition: 'background 0.3s',
                border: 'none',
              }}
            >
              {isFlipped || isMatched ? card.text : '?'}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>Hamle: {moves}</div>
    </div>
  );
}

export default function PreviewPuzzleFlow({ activity, onAnswer }) {
  const puzzleType = activity.puzzleType || 'crossword';

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
        {puzzleType === 'crossword' && 'Kare Bulmaca'}
        {puzzleType === 'wordsearch' && 'Kelime Avı'}
        {puzzleType === 'sudoku' && 'Sudoku'}
        {puzzleType === 'maze' && 'Labirent'}
        {puzzleType === 'memory' && 'Hafıza Kartları'}
      </div>
      {puzzleType === 'crossword' && <CrosswordGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'wordsearch' && <WordSearchGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'sudoku' && <SudokuGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'maze' && <MazeGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'memory' && <MemoryGrid activity={activity} onAnswer={onAnswer} />}
    </div>
  );
}
