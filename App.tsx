import React, { useState, useEffect, useRef } from 'react';
import { GameState, LaneType, Block, Particle, LANE_CONFIG, MAX_ENERGY, GAME_DURATION, INITIAL_ENERGY } from './types';
import { BASE_FALL_SPEED, FAST_FALL_SPEED, HIT_STOP_FRAMES, DANGER_THRESHOLD, LOW_ENERGY_THRESHOLD, LANE_COUNT } from './constants';
import { useAuth } from './contexts/AuthContext';
import { saveScore } from './lib/scores';
import { AuthForm } from './components/AuthForm';
import { Leaderboard } from './components/Leaderboard';
import { ProfileSettings } from './components/ProfileSettings';

// Helper to generate random block value 1-9
const getRandomValue = () => Math.floor(Math.random() * 9) + 1;

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  // -- State (for Rendering) --
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [energy, setEnergy] = useState(INITIAL_ENERGY);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentBlock, setCurrentBlock] = useState<Block | null>(null);
  const [nextBlockValue, setNextBlockValue] = useState<number>(getRandomValue());
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showZeroBonus, setShowZeroBonus] = useState(false);

  const [holdBlock, setHoldBlock] = useState<number | null>(null);
  const [canHold, setCanHold] = useState<boolean>(true);

  // -- Refs (for Logic) --
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const hitStopRef = useRef<number>(0);
  const isFastDropping = useRef<boolean>(false);

  const gameStateRef = useRef<GameState>(GameState.MENU);
  const energyRef = useRef(INITIAL_ENERGY);
  const scoreRef = useRef(0);
  const timeLeftRef = useRef(GAME_DURATION);
  const nextBlockValueRef = useRef(nextBlockValue);
  const currentBlockRef = useRef<Block | null>(null); // The source of truth for logic
  const gameOverReason = useRef<string>('');
  const holdBlockRef = useRef<number | null>(null); // Ref sync for hold
  const canHoldRef = useRef<boolean>(true); // Ref sync for canHold

  const shakeRef = useRef<boolean>(false);
  const flashRef = useRef<boolean>(false);

  const spaceDownTimeRef = useRef<number>(0);
  const holdTimeoutRef = useRef<any>(null);

  // -- Input --
  // Refactor logic into stable functions for both connection approaches
  const getNextValidLane = (current: number, direction: number) => {
    let next = current + direction;
    const val = currentBlockRef.current?.value || 1;

    while (next >= 0 && next < LANE_COUNT) {
      const lane = LANE_CONFIG[next];
      // Check validity
      const isDiv = lane.type === LaneType.DIV;
      const isDivisible = energyRef.current % val === 0;

      if (!isDiv || (isDiv && isDivisible)) {
        return next; // Found valid lane
      }
      next += direction; // Skip and continue
    }
    return current; // No valid lane found, stay
  };

  const moveBlock = (direction: -1 | 1) => {
    if (!currentBlockRef.current || gameStateRef.current === GameState.PAUSED) return;

    currentBlockRef.current = {
      ...currentBlockRef.current,
      laneIndex: getNextValidLane(currentBlockRef.current.laneIndex, direction)
    };
    setCurrentBlock(currentBlockRef.current);
  };

  const hardDrop = () => {
    if (!currentBlockRef.current || gameStateRef.current === GameState.PAUSED) return;

    currentBlockRef.current = {
      ...currentBlockRef.current,
      y: 90 // Instant drop
    };
    setCurrentBlock(currentBlockRef.current);
  };

  const triggerHold = () => {
    if (gameStateRef.current !== GameState.PLAYING) return;
    if (!canHoldRef.current || !currentBlockRef.current) return;

    // Swap
    const currentVal = currentBlockRef.current.value;
    const held = holdBlockRef.current;

    holdBlockRef.current = currentVal;
    setHoldBlock(currentVal);

    if (held === null) {
      spawnBlock(); // Will spawn the next scheduled block
    } else {
      // Spawn value from Hold
      spawnBlock(held);
    }

    // Set canHold to false until next spawn
    canHoldRef.current = false;
    setCanHold(false);
  };


  const lastTapTimeRef = useRef<number>(0);
  const lastTapLaneRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  // SWIPE Logic
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleSwipeTouchMove = (e: React.TouchEvent) => {
    // We can track move, but actual logic in End is simpler for swipe
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartXRef.current;
    const diffY = endY - touchStartYRef.current;

    // Threshold for Swipe
    if (Math.abs(diffX) > 50 && Math.abs(diffY) < 50) {
      triggerHold(); // Left or Right swipe triggers Hold
    }
  };


  const handleLaneTouchStart = (e: React.TouchEvent | React.MouseEvent, targetLaneIndex: number) => {
    // Prevent ghost clicks (mouse events firing immediately after touch)
    const now = Date.now();
    const isTouch = 'touches' in e;

    if (isTouch) {
      lastTouchTimeRef.current = now;
    } else {
      // If we just had a touch event, ignore this mouse event
      if (now - lastTouchTimeRef.current < 500) {
        e.preventDefault();
        return;
      }
    }

    e.stopPropagation(); // Stop propagation to prevent triggering swipe on background
    // e.preventDefault(); // Removed to allow scroll/swipe? No, prevent default is good for game feel.
    // If we preventDefault here, click events on parent might suffer? 
    // Actually standard touch handling.
    if (gameStateRef.current !== GameState.PLAYING) return;
    if (!currentBlockRef.current) return;

    const isDoubleTap =
      lastTapLaneRef.current === targetLaneIndex &&
      (now - lastTapTimeRef.current) < 300;

    if (isDoubleTap) {
      hardDrop();
      lastTapTimeRef.current = 0; // Reset to avoid triple-tap triggering another
      lastTapLaneRef.current = null;
      return;
    }

    lastTapTimeRef.current = now;
    lastTapLaneRef.current = targetLaneIndex;



    // 2. Handle Move (Tap)
    const currentLane = currentBlockRef.current.laneIndex;
    if (currentLane === targetLaneIndex) return;

    const direction = targetLaneIndex > currentLane ? 1 : -1;
    let tempLane = currentLane;

    // Move continuously until target reached or invalid
    const moveStep = () => {
      if (!currentBlockRef.current) return;
      if (currentBlockRef.current.laneIndex === targetLaneIndex) return;

      // Logic check before moving
      const nextLane = getNextValidLane(currentBlockRef.current.laneIndex, direction);

      // If we are stuck (can't move further), stop
      if (nextLane === currentBlockRef.current.laneIndex) return;

      // Update Ref
      currentBlockRef.current = {
        ...currentBlockRef.current,
        laneIndex: nextLane
      };
      setCurrentBlock(currentBlockRef.current);

      // Continue if not there yet
      if (currentBlockRef.current.laneIndex !== targetLaneIndex) {
        if ((direction === 1 && currentBlockRef.current.laneIndex > targetLaneIndex) ||
          (direction === -1 && currentBlockRef.current.laneIndex < targetLaneIndex)) return;

        setTimeout(moveStep, 50); // 50ms delay between steps for "slide" feel
      }
    };

    moveStep();
  };

  const handleLaneTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    // e.preventDefault();
    isFastDropping.current = false;
  };


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow typing in auth forms when game is over
      if (gameStateRef.current === GameState.GAME_OVER) return;

      // Special handling for Pause/Menu shortcuts?
      // Space is now Pause (Tap) OR Hold (Long Press)

      if (e.code === 'Space') {
        if (e.repeat) return; // Ignore auto-repeat

        if (gameStateRef.current === GameState.PLAYING) {
          spaceDownTimeRef.current = Date.now();
          // Schedule Hold
          holdTimeoutRef.current = setTimeout(() => {
            triggerHold();
            spaceDownTimeRef.current = 0; // Mark as consumed
          }, 300);
        } else if (gameStateRef.current === GameState.PAUSED) {
          // Unpause immediately on Press (or Down)
          setGameState(GameState.PLAYING);
          gameStateRef.current = GameState.PLAYING;
          lastTimeRef.current = performance.now();
          requestRef.current = requestAnimationFrame(gameLoop);
        } else {
          // Menu -> Start
          if (!authLoading) startGame();
        }
        return;
      }

      // Enter is Start if not playing
      if (e.code === 'Enter' && gameStateRef.current !== GameState.PLAYING && gameStateRef.current !== GameState.PAUSED && !authLoading) {
        startGame();
        return;
      }


      if (gameStateRef.current === GameState.PAUSED) return;

      if (!currentBlockRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
          moveBlock(-1);
          break;
        case 'ArrowRight':
          moveBlock(1);
          break;
        case 'ArrowDown':
          isFastDropping.current = true;
          break;
        case 'Enter':
          hardDrop();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') isFastDropping.current = false;

      if (e.code === 'Space') {
        if (gameStateRef.current === GameState.PLAYING) {
          // Clear timeout
          if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

          // If spaceDownTimeRef is still set (not 0), it means Hold wasn't triggered
          // So treat as Tap -> Pause
          if (spaceDownTimeRef.current !== 0) {
            setGameState(GameState.PAUSED);
            gameStateRef.current = GameState.PAUSED;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [authLoading]);

  // -- Logic --
  const startGame = () => {
    setGameState(GameState.PLAYING);
    gameStateRef.current = GameState.PLAYING;

    setEnergy(INITIAL_ENERGY);
    energyRef.current = INITIAL_ENERGY;

    setScore(0);
    scoreRef.current = 0;

    setHoldBlock(null);
    holdBlockRef.current = null;
    setCanHold(true);
    canHoldRef.current = true;

    setTimeLeft(GAME_DURATION);
    timeLeftRef.current = GAME_DURATION;

    setParticles([]);
    gameOverReason.current = '';

    setIsScoreSaved(false);
    setSaveMessage('');

    const firstNext = getRandomValue();
    setNextBlockValue(firstNext);
    nextBlockValueRef.current = firstNext;

    spawnBlock();

    lastTimeRef.current = performance.now();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const spawnBlock = (forcedValue?: number) => {
    const val = forcedValue !== undefined ? forcedValue : nextBlockValueRef.current;

    // Find valid start lane
    let laneIndex = Math.floor(Math.random() * LANE_COUNT);
    let attempts = 0;
    while (attempts < 10) {
      const lane = LANE_CONFIG[laneIndex];
      const isInvalidDiv = lane.type === LaneType.DIV && energyRef.current % val !== 0;
      if (!isInvalidDiv) break;
      laneIndex = Math.floor(Math.random() * LANE_COUNT);
      attempts++;
    }

    const newBlock = {
      id: Date.now(),
      value: val,
      laneIndex: laneIndex,
      y: -10
    };

    currentBlockRef.current = newBlock;
    setCurrentBlock(newBlock);

    // Reset Hold ability
    setCanHold(true);
    canHoldRef.current = true;

    if (forcedValue === undefined) {
      const nextVal = getRandomValue();
      setNextBlockValue(nextVal);
      nextBlockValueRef.current = nextVal;
    }
  };

  const endGame = (reason: string) => {
    setGameState(GameState.GAME_OVER);
    gameStateRef.current = GameState.GAME_OVER;
    gameOverReason.current = reason;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    // Try to save score automatically if logged in
    handleAutoSave();
  };

  const handleAutoSave = async () => {
    if (user && scoreRef.current > 0) {
      setSaveMessage('SAVING SCORE...');
      try {
        await saveScore(scoreRef.current, user.id);
        setIsScoreSaved(true);
        setSaveMessage('SCORE SECURED');
      } catch (e) {
        console.error(e);
        setSaveMessage('SAVE FAILED');
      }
    }
  };

  const createParticles = (x: number, y: number, color: string, count: number, text?: string) => {
    const newParticles: Particle[] = [];
    if (text) {
      newParticles.push({ id: Math.random(), x, y, vx: 0, vy: -0.5, life: 60, color: '#FFF', text });
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      newParticles.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 20,
        color
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const processCollision = (block: Block) => {
    const lane = LANE_CONFIG[block.laneIndex];
    let newEnergy = energyRef.current;
    let scoreGain = 0;
    let effectText = "";

    hitStopRef.current = HIT_STOP_FRAMES;
    shakeRef.current = true;
    setTimeout(() => { shakeRef.current = false; }, 300);

    if (lane.type === LaneType.DIV) {
      flashRef.current = true;
      setTimeout(() => { flashRef.current = false; }, 100);
    }

    switch (lane.type) {
      case LaneType.ADD: newEnergy += block.value; effectText = `+${block.value} E`; break;
      case LaneType.SUB: newEnergy -= block.value; effectText = `-${block.value} E`; break;
      case LaneType.MUL: newEnergy *= block.value; effectText = `×${block.value} E`; break;
      case LaneType.DIV:
        // const prev = newEnergy; // Already have prevEnergy (which is energyRef.current)
        newEnergy = Math.floor(newEnergy / block.value);
        // scoreGain = prev - newEnergy; // Calculated below
        effectText = `+${Math.floor(energyRef.current - newEnergy)} PTS`; // Temp text, will update
        break;
    }

    const energyDiff = newEnergy - energyRef.current;

    // Calculate Base Score
    if (lane.type === LaneType.DIV) {
      scoreGain = energyRef.current - newEnergy;
    } else if (energyDiff > 0) {
      scoreGain = energyDiff;
    }

    // Apply Multiplier
    if (Math.abs(energyDiff) >= 50) {
      scoreGain = Math.floor(scoreGain * 1.5);
    }

    // Update effect text for DIV to show correct score if multiplied
    if (lane.type === LaneType.DIV) {
      effectText = `+${scoreGain} PTS`;
    }

    energyRef.current = newEnergy;
    setEnergy(newEnergy);

    // Zero Energy Bonus
    if (newEnergy === 0) {
      scoreGain += 500;
      effectText = "ZERO BONUS!";
      setShowZeroBonus(true);
      setTimeout(() => setShowZeroBonus(false), 1000);

      // Reset Energy for next block
      energyRef.current = INITIAL_ENERGY;
      setEnergy(INITIAL_ENERGY);
    }

    if (scoreGain > 0) {
      scoreRef.current += scoreGain;
      setScore(scoreRef.current);
    }

    const particleX = (block.laneIndex * 25) + 12.5;
    createParticles(particleX, 90, lane.color.replace('text-', '').replace('-400', ''), 10, effectText);

    if (newEnergy > MAX_ENERGY) endGame('SYSTEM OVERLOAD');
    else if (newEnergy < 0) endGame('SYSTEM BLACKOUT');
    else spawnBlock();
  };

  const gameLoop = (time: number) => {
    if (gameStateRef.current !== GameState.PLAYING) return;
    lastTimeRef.current = time;

    if (hitStopRef.current > 0) {
      hitStopRef.current--;
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Timer
    timeLeftRef.current -= (1 / 60);
    setTimeLeft(timeLeftRef.current);

    if (timeLeftRef.current <= 0) {
      endGame('TIME EXPIRED');
      return;
    }

    // Particles
    setParticles(prev => prev
      .map(p => ({ ...p, x: p.x + (p.vx * 0.2), y: p.y + (p.vy * 0.2), life: p.life - 1 }))
      .filter(p => p.life > 0)
    );

    // Block Logic
    if (currentBlockRef.current) {
      const moveSpeed = isFastDropping.current ? FAST_FALL_SPEED : BASE_FALL_SPEED;
      const newY = currentBlockRef.current.y + moveSpeed;

      if (newY >= 90) {
        processCollision(currentBlockRef.current);
        // processCollision calls spawnBlock which updates currentBlockRef
      } else {
        currentBlockRef.current = { ...currentBlockRef.current, y: newY };
        setCurrentBlock(currentBlockRef.current);
      }
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // -- Render Helpers --
  const getEnergyColor = (e: number) => {
    if (e > DANGER_THRESHOLD) return 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse';
    if (e < LOW_ENERGY_THRESHOLD) return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
    return 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]';
  };

  const isDanger = energy > DANGER_THRESHOLD || energy < 0;

  // -- Render --
  return (
    <div
      className={`relative w-full h-screen overflow-hidden flex items-center justify-center bg-black transition-colors duration-100 ${shakeRef.current ? 'animate-shake' : ''}`}
    >

      {/* Flash Overlay */}
      <div className={`absolute inset-0 z-40 bg-white pointer-events-none transition-opacity duration-100 ${flashRef.current ? 'opacity-20' : 'opacity-0'}`}></div>

      {/* Background Grid */}
      <div className="absolute inset-0 grid grid-cols-[repeat(4,1fr)] opacity-20 pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-r-2 border-white/30 h-full"></div>
        ))}
      </div>
      <div className="absolute inset-0 grid grid-rows-[repeat(10,1fr)] opacity-20 pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="border-b-2 border-white/30 w-full"></div>
        ))}
      </div>

      {/* MAIN LAYOUT CONTAINER */}
      <div className="relative z-10 flex flex-col md:flex-row w-full max-w-5xl h-[90vh] md:h-[80vh] gap-4 p-4">

        {/* HUD */}
        <div className="flex-none md:flex-1 flex flex-row md:flex-col justify-between items-center md:items-end text-right py-2 md:py-8 w-full md:w-auto order-1">
          <div className="flex md:block flex-col items-end">
            <h3 className="text-gray-500 text-[10px] md:text-sm mb-1 tracking-widest">SCORE</h3>
            <div className="text-2xl md:text-4xl font-bold text-white tabular-nums glow-text">{Math.floor(score).toString().padStart(6, '0')}</div>
          </div>

          <div className="my-0 md:my-8 flex md:block flex-col items-center">
            <h3 className="hidden md:block text-gray-500 text-sm mb-2 tracking-widest">NEXT OPERATOR</h3>
            <div className="w-12 h-12 md:w-24 md:h-24 border-2 md:border-4 border-white/50 bg-black/50 flex items-center justify-center relative">
              <div className="text-2xl md:text-5xl font-bold text-white">{nextBlockValue}</div>
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white"></div>
            </div>
          </div>

          <div className="flex md:block flex-col items-end">
            {/* Mobile-only Label */}
            <h3 className="text-gray-500 text-[10px] md:text-sm mb-1 tracking-widest">TIME</h3>
            <div className={`text-xl md:text-3xl font-bold tabular-nums ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {Math.max(0, timeLeft).toFixed(2)}
            </div>
          </div>
        </div>

        {/* CENTER: PLAY AREA & RIGHT: ENERGY TOWER WRAPPER */}
        <div className="flex-1 md:flex-[3] flex flex-row gap-4 h-full min-h-0 order-2">
          <div
            className={`relative flex-[6] md:flex-[2] border-x-4 border-white/30 bg-black/40 backdrop-blur-sm overflow-hidden ${isDanger ? 'border-red-500/50 animate-pulse' : ''}`}
            onTouchStart={handleSwipeTouchStart}
            onTouchMove={handleSwipeTouchMove}
            onTouchEnd={handleSwipeTouchEnd}
          >

            {/* Lanes Indicators (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-[10%] flex border-t-4 border-white/30">
              {LANE_CONFIG.map((lane, idx) => {
                const isActive = currentBlock?.laneIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`flex-1 flex flex-col items-center justify-center border-r-2 last:border-r-0 border-white/20 transition-all duration-100 touch-action-none ${isActive ? 'bg-white/5' : ''}`}
                    onTouchStart={(e) => handleLaneTouchStart(e, idx)}
                    onTouchEnd={handleLaneTouchEnd}
                    onMouseDown={(e) => handleLaneTouchStart(e, idx)}
                    onMouseUp={handleLaneTouchEnd}
                  >
                    <span className={`text-2xl md:text-6xl font-bold ${isActive ? lane.color : 'text-gray-700'} ${isActive ? lane.glow : ''}`}>
                      {lane.type}
                    </span>
                    {isActive && <div className={`w-full h-1 absolute bottom-0 ${lane.color.replace('text-', 'bg-')}`}></div>}
                  </div>
                );
              })}
            </div>

            {/* Falling Block */}
            {currentBlock && (
              <div
                className="absolute flex items-center justify-center w-[25%] transition-transform duration-75 ease-linear"
                style={{
                  left: `${currentBlock.laneIndex * 25}%`,
                  top: `${currentBlock.y}%`,
                  height: '10%' // Aspect ratio fix needed? Assume play area is roughly vertical
                }}
              >
                <div className="w-10 h-10 md:w-16 md:h-16 border-2 md:border-4 border-white bg-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)] relative group">
                  <span className="text-lg md:text-3xl font-bold text-white">{currentBlock.value}</span>
                  {/* Decorative corners */}
                  <div className="absolute top-[-2px] left-[-2px] w-1 md:w-2 h-1 md:h-2 bg-white"></div>
                  <div className="absolute bottom-[-2px] right-[-2px] w-1 md:w-2 h-1 md:h-2 bg-white"></div>
                </div>
                {/* Trail effect (simple opacity box above) */}
                <div className="absolute -top-8 w-12 h-8 bg-gradient-to-t from-white/20 to-transparent pointer-events-none"></div>
              </div>
            )}

            {/* Particles */}
            {particles.map((p) => (
              <div
                key={p.id}
                className="absolute pointer-events-none font-bold text-sm"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  color: p.text ? '#FFFFFF' : `rgba(${p.color === 'emerald' ? '52, 211, 153' : p.color === 'cyan' ? '34, 211, 238' : '255, 255, 255'}, ${p.life / 30})`,
                  opacity: p.life / 60,
                  transform: p.text ? 'scale(1.5)' : 'scale(1)',
                }}
              >
                {p.text ? p.text : (
                  <div className={`w-2 h-2 rounded-full ${p.color.startsWith('#') ? '' : `bg-${p.color}-400`}`} style={{ backgroundColor: p.color.startsWith('#') ? p.color : undefined }}></div>
                )}
              </div>
            ))}

          </div>

          {/* HOLD UI - Centered between Lanes (left) and Energy (right) */}
          <div className="flex flex-col justify-center items-center gap-2 w-16 md:w-20">
            <div className="text-gray-500 text-[10px] md:text-sm tracking-widest font-bold">HOLD</div>
            <div className={`w-12 h-12 md:w-16 md:h-16 border-2 border-white/30 flex items-center justify-center bg-black/50 transition-all ${canHold ? 'opacity-100' : 'opacity-50 grayscale'}`}>
              {holdBlock ? (
                <span className="text-2xl md:text-4xl font-bold text-white">{holdBlock}</span>
              ) : (
                <span className="text-gray-600 text-xs text-center px-1">EMPTY</span>
              )}
            </div>
            <div className="text-[10px] text-gray-600 text-center leading-tight hidden md:block">
              SPACE<br />(HOLD)
            </div>
          </div>

          {/* RIGHT: ENERGY TOWER */}
          <div className="flex-1 flex flex-col justify-end py-2 md:py-8 pl-0 md:pl-0 relative overflow-visible">
            {/* Threshold Markers */}
            <div className="absolute right-full top-[20%] w-4 h-[2px] bg-red-500/50"></div>
            <div className="absolute right-full bottom-[20%] w-4 h-[2px] bg-yellow-500/50"></div>

            <div className="w-8 md:w-16 h-full border-2 md:border-4 border-white/50 bg-black/50 relative overflow-hidden mx-auto">
              {/* Labels inside/outside? Let's put them outside aligned with top/bottom */}
              <div className="absolute top-0 right-full mr-1 md:mr-2 text-[10px] md:text-sm font-bold text-red-500 tracking-widest">MAX</div>
              <div className="absolute bottom-0 right-full mr-1 md:mr-2 text-[10px] md:text-sm font-bold text-yellow-500 tracking-widest">LOW</div>
              {/* Danger Flash Overlay */}
              {isDanger && <div className="absolute inset-0 bg-red-500/20 animate-pulse z-20"></div>}

              {/* Fill */}
              <div
                className={`absolute bottom-0 left-0 right-0 transition-all duration-200 ease-out ${getEnergyColor(energy)}`}
                style={{ height: `${Math.min(100, Math.max(0, energy))}%` }}
              ></div>

              {/* Grid Lines on Bar */}
              <div className="absolute inset-0 flex flex-col justify-between py-1 opacity-30 z-10">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="w-full h-[1px] bg-black/50"></div>
                ))}
              </div>
            </div>

            <div className="text-center mt-4 hidden md:block">
              <h3 className={`text-sm font-bold tracking-widest ${isDanger ? 'text-red-500 animate-pulse' : 'text-white'}`}>ENERGY</h3>
              <div className="text-2xl font-bold">{Math.floor(energy)}%</div>
            </div>
            {/* Mobile Energy Text */}
            <div className="text-center mt-2 block md:hidden">
              <div className="text-sm font-bold">{Math.floor(energy)}%</div>
            </div>
          </div>
        </div>

      </div>

      {/* OVERLAYS */}

      {/* Menu Overlay */}
      {gameState === GameState.MENU && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center py-12">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-2 tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
              TET <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">MATH</span>
            </h1>
            <p className="text-gray-400 tracking-[0.5em] text-sm mb-12">VOID CALCULATION PROTOCOL</p>

            <div className="space-y-6 text-center">
              <div className="grid grid-cols-2 gap-8 text-left text-sm text-gray-300 border border-white/20 p-6 bg-black">
                <div>
                  <span className="text-emerald-400 font-bold">[+]</span> CHARGE Energy<br />
                  <span className="text-yellow-400 font-bold">[-]</span> DRAIN Energy
                </div>
                <div>
                  <span className="text-fuchsia-400 font-bold">[×]</span> OVERCHARGE (Risk)<br />
                  <span className="text-cyan-400 font-bold">[÷]</span> SCORE (Energy → Points)
                </div>
              </div>
              <p className="text-red-500 text-xs uppercase tracking-widest">Warning: Keep Energy between 0 and 100</p>

              <button
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-bold text-xl hover:bg-gray-200 hover:scale-105 transition-transform"
              >
                Start
              </button>

              <div className="mt-8">
                {user ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-sm text-gray-400">
                      Logged in as <span className="text-white">
                        {user.user_metadata?.username || user.email}
                      </span>
                    </div>
                    <ProfileSettings />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Play to unlock Global Network</div>
                )}
              </div>

              <div className="mt-8 w-full max-w-sm mx-auto">
                <Leaderboard />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {
        gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-md">
            <h2 className="text-5xl font-bold text-red-500 mb-2 tracking-widest animate-pulse">TERMINATED</h2>
            <div className="text-gray-400 text-xl mb-8 tracking-[0.5em] uppercase">
              REASON: {gameOverReason.current}
            </div>

            <div className="text-center mb-8">
              <div className="text-sm text-gray-500 tracking-widest mb-1">FINAL SCORE</div>
              <div className="text-6xl font-bold text-white glow-text">{Math.floor(score).toString().padStart(6, '0')}</div>
              {saveMessage && <div className="text-emerald-400 mt-2 text-sm tracking-widest font-bold">{saveMessage}</div>}
            </div>

            <div className="flex flex-col items-center gap-6">
              {!user && !isScoreSaved && score > 0 && (
                <div className="mb-4">
                  <div className="text-yellow-400 text-sm mb-2 text-center">LOGIN TO SECURE DATA</div>
                  <AuthForm />
                </div>
              )}

              <button
                onClick={startGame}
                className="px-8 py-3 bg-white text-black font-bold hover:bg-gray-200 transition-colors"
              >
                REBOOT SYSTEM
              </button>

              <button
                onClick={() => setGameState(GameState.MENU)}
                className="px-6 py-2 border border-white/30 text-gray-300 text-sm hover:bg-white/10 hover:text-white transition-colors tracking-widest"
              >
                RETURN TO TITLE
              </button>

              <div className="mt-4">
                <Leaderboard key={isScoreSaved ? 'saved' : 'unsaved'} />
              </div>
            </div>
          </div>
        )
      }

      {/* Paused Overlay */}
      {
        gameState === GameState.PAUSED && (
          <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <h2 className="text-4xl font-bold text-white tracking-[0.5em]">PAUSED</h2>
          </div>
        )
      }

      {/* Zero Bonus Overlay */}
      {showZeroBonus && (
        <div className="absolute top-[20%] left-0 right-0 z-50 flex justify-center pointer-events-none">
          <h2 className="text-6xl md:text-8xl font-black text-yellow-400 tracking-tighter drop-shadow-[0_0_25px_rgba(250,204,21,0.8)] animate-bounce">
            Zero!
          </h2>
        </div>
      )}

    </div >
  );
};

export default App;
