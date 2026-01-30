import React, { useState, useEffect, useRef } from 'react';
import { GameState, LaneType, Block, Particle, LANE_CONFIG, MAX_ENERGY, GAME_DURATION, INITIAL_ENERGY } from './types';
import { BASE_FALL_SPEED, FAST_FALL_SPEED, HIT_STOP_FRAMES, DANGER_THRESHOLD, LOW_ENERGY_THRESHOLD, LANE_COUNT } from './constants';
import { useAuth } from './contexts/AuthContext';
import { saveScore } from './lib/scores';
import { AuthForm } from './components/AuthForm';
import { Leaderboard } from './components/Leaderboard';

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

  const shakeRef = useRef<boolean>(false);
  const flashRef = useRef<boolean>(false);

  // -- Input --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow typing in auth forms when game is over
      if (gameStateRef.current === GameState.GAME_OVER) return;

      if (gameStateRef.current !== GameState.PLAYING && gameStateRef.current !== GameState.PAUSED) {
        if ((e.code === 'Space' || e.code === 'Enter') && !authLoading) {
          startGame();
        }
        return;
      }

      if (e.code === 'Space') {
        if (gameStateRef.current === GameState.PLAYING) {
          setGameState(GameState.PAUSED);
          gameStateRef.current = GameState.PAUSED;
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
        } else if (gameStateRef.current === GameState.PAUSED) {
          setGameState(GameState.PLAYING);
          gameStateRef.current = GameState.PLAYING;
          lastTimeRef.current = performance.now(); // Reset time to avoid jump
          requestRef.current = requestAnimationFrame(gameLoop);
        }
        return;
      }

      if (gameStateRef.current === GameState.PAUSED) return;

      if (!currentBlockRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
          currentBlockRef.current = {
            ...currentBlockRef.current,
            laneIndex: Math.max(0, currentBlockRef.current.laneIndex - 1)
          };
          setCurrentBlock(currentBlockRef.current); // Sync to state
          break;
        case 'ArrowRight':
          currentBlockRef.current = {
            ...currentBlockRef.current,
            laneIndex: Math.min(LANE_COUNT - 1, currentBlockRef.current.laneIndex + 1)
          };
          setCurrentBlock(currentBlockRef.current); // Sync to state
          break;
        case 'ArrowDown':
          isFastDropping.current = true;
          break;
        case 'Enter':
          currentBlockRef.current = {
            ...currentBlockRef.current,
            y: 90 // Instant drop to bottom
          };
          setCurrentBlock(currentBlockRef.current);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') isFastDropping.current = false;
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

  const spawnBlock = () => {
    const val = nextBlockValueRef.current;
    const newBlock = {
      id: Date.now(),
      value: val,
      laneIndex: Math.floor(Math.random() * LANE_COUNT),
      y: -10
    };

    currentBlockRef.current = newBlock;
    setCurrentBlock(newBlock);

    const nextVal = getRandomValue();
    setNextBlockValue(nextVal);
    nextBlockValueRef.current = nextVal;
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
    <div className={`relative w-full h-screen overflow-hidden flex items-center justify-center bg-black transition-colors duration-100 ${flashRef.current ? 'bg-white invert' : ''} ${shakeRef.current ? 'animate-shake' : ''}`}>

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
      <div className="relative z-10 flex w-full max-w-5xl h-[80vh] gap-4 p-4">

        {/* LEFT: HUD */}
        <div className="flex-1 flex flex-col justify-between items-end text-right py-8">
          <div>
            <h3 className="text-gray-500 text-sm mb-1 tracking-widest">SCORE</h3>
            <div className="text-4xl font-bold text-white tabular-nums glow-text">{Math.floor(score).toString().padStart(6, '0')}</div>
          </div>

          <div className="my-8">
            <h3 className="text-gray-500 text-sm mb-2 tracking-widest">NEXT OPERATOR</h3>
            <div className="w-24 h-24 border-4 border-white/50 bg-black/50 flex items-center justify-center relative">
              <div className="text-5xl font-bold text-white">{nextBlockValue}</div>
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white"></div>
            </div>
          </div>

          <div>
            <h3 className="text-gray-500 text-sm mb-1 tracking-widest">TIME_REMAINING</h3>
            <div className={`text-3xl font-bold tabular-nums ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {Math.max(0, timeLeft).toFixed(2)}
            </div>
          </div>
        </div>

        {/* CENTER: PLAY AREA */}
        <div className={`relative flex-[2] border-x-4 border-white/30 bg-black/40 backdrop-blur-sm overflow-hidden ${isDanger ? 'border-red-500/50 animate-pulse' : ''}`}>

          {/* Lanes Indicators (Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 h-[10%] flex border-t-4 border-white/30">
            {LANE_CONFIG.map((lane, idx) => {
              const isActive = currentBlock?.laneIndex === idx;
              return (
                <div
                  key={idx}
                  className={`flex-1 flex flex-col items-center justify-center border-r-2 last:border-r-0 border-white/20 transition-all duration-100 ${isActive ? 'bg-white/5' : ''}`}
                >
                  <span className={`text-6xl font-bold ${isActive ? lane.color : 'text-gray-700'} ${isActive ? lane.glow : ''}`}>
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
              <div className="w-16 h-16 border-4 border-white bg-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)] relative group">
                <span className="text-3xl font-bold text-white">{currentBlock.value}</span>
                {/* Decorative corners */}
                <div className="absolute top-[-2px] left-[-2px] w-2 h-2 bg-white"></div>
                <div className="absolute bottom-[-2px] right-[-2px] w-2 h-2 bg-white"></div>
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

        {/* RIGHT: ENERGY TOWER */}
        <div className="flex-1 flex flex-col justify-end py-8 pl-8 relative">
          {/* Threshold Markers */}
          <div className="absolute right-full top-[20%] w-4 h-[2px] bg-red-500/50"></div>
          <div className="absolute right-full bottom-[20%] w-4 h-[2px] bg-yellow-500/50"></div>

          <div className="w-16 h-full border-4 border-white/50 bg-black/50 relative overflow-hidden mx-auto">
            {/* Labels inside/outside? Let's put them outside aligned with top/bottom */}
            <div className="absolute top-0 right-full mr-2 text-sm font-bold text-red-500 tracking-widest">MAX</div>
            <div className="absolute bottom-0 right-full mr-2 text-sm font-bold text-yellow-500 tracking-widest">LOW</div>
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

          <div className="text-center mt-4">
            <h3 className={`text-sm font-bold tracking-widest ${isDanger ? 'text-red-500 animate-pulse' : 'text-white'}`}>ENERGY</h3>
            <div className="text-2xl font-bold">{Math.floor(energy)}%</div>
          </div>
        </div>

      </div>

      {/* OVERLAYS */}

      {/* Menu Overlay */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
          <h1 className="text-6xl font-extrabold mb-2 tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
            NULL <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">GRID</span>
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
                <div className="text-sm text-gray-400">Logged in as <span className="text-white">{user.email}</span></div>
              ) : (
                <div className="text-sm text-gray-500">Play to unlock Global Network</div>
              )}
            </div>

            <div className="mt-8 w-full max-w-sm mx-auto">
              <Leaderboard />
            </div>

          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState === GameState.GAME_OVER && (
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

            <div className="mt-4">
              <Leaderboard />
            </div>
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {gameState === GameState.PAUSED && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <h2 className="text-4xl font-bold text-white tracking-[0.5em]">PAUSED</h2>
        </div>
      )}

    </div>
  );
};

export default App;
